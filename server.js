'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { runPipeline } = require('./pipeline');
const { runTranslation, getTranslationStatus } = require('./lib/translate');
const { startBatch, cancelBatch, retryFailed, getBatchStatus } = require('./lib/batch');
const frontendApi = require('./routes/frontend-api');

const app = express();
app.use(express.json({ limit: '10mb' }));

// CORS — allow requests from internal.goconstellation.com
// Note: the VPS must be served over HTTPS for browser requests from an HTTPS page to work.
// Set TRANSLATE_API_URL in .env once HTTPS is configured (e.g. Nginx + Let's Encrypt).
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://internal.goconstellation.com',
    'https://meerkatv3.netlify.app'
  ];
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'meerkat-service', table: process.env.SUPABASE_TABLE || 'article_outlines' });
});

// Main generation endpoint — same path the web app will call
app.post('/generate', async (req, res) => {
  const payload = req.body;

  // Validate required fields
  const required = ['articleid', 'clientId', 'keyword', 'sections'];
  const missing = required.filter(f => !payload[f]);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  if (!Array.isArray(payload.sections) || payload.sections.length === 0) {
    return res.status(400).json({ error: 'sections must be a non-empty array' });
  }

  console.log(`\n[Server] POST /generate | articleId=${payload.articleid} | keyword="${payload.keyword}" | sections=${payload.sections.length}`);

  // Respond immediately — generation is async
  res.status(202).json({
    status: 'accepted',
    articleId: payload.articleid,
    message: 'Article generation started. Results will be written to Supabase.'
  });

  // Run pipeline in background
  runPipeline(payload)
    .then(result => {
      console.log(`[Server] Complete: articleId=${result.articleId} | words=${result.wordCount} | flesch=${result.fleschScore} | url=${result.pageUrl}`);
    })
    .catch(err => {
      console.error(`[Server] Pipeline failed for articleId=${payload.articleid}:`, err);
    });
});

// Trigger translation
app.post('/translate', async (req, res) => {
  const { articleId, language } = req.body;

  if (!articleId || !language) {
    return res.status(400).json({ error: 'Missing required fields: articleId, language' });
  }
  if (!['es', 'vi'].includes(language)) {
    return res.status(400).json({ error: 'Unsupported language. Accepted values: es, vi' });
  }

  console.log(`\n[Server] POST /translate | articleId=${articleId} | language=${language}`);

  res.status(202).json({
    status: 'accepted',
    articleId,
    language,
    message: 'Translation started. Poll /translate/status for progress.',
  });

  runTranslation(articleId, language)
    .then(() => console.log(`[Server] Translation complete: articleId=${articleId} lang=${language}`))
    .catch(err => console.error(`[Server] Translation failed: articleId=${articleId} lang=${language}:`, err));
});

// Poll translation status
app.get('/translate/status', async (req, res) => {
  const { articleId, language } = req.query;

  if (!articleId || !language) {
    return res.status(400).json({ error: 'Missing query params: articleId, language' });
  }

  try {
    const status = await getTranslationStatus(articleId, language);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Batch generation endpoints ───────────────────────────────────────────

// Start a batch run
app.post('/batch/start', async (req, res) => {
  const { articles, userId } = req.body;

  if (!articles || !Array.isArray(articles) || articles.length === 0) {
    return res.status(400).json({ error: 'articles must be a non-empty array' });
  }

  // Validate each article has required fields
  const invalid = articles.filter(a => !a.keyword || !a.clientName);
  if (invalid.length > 0) {
    return res.status(400).json({
      error: `${invalid.length} article(s) missing required fields (keyword, clientName)`,
      invalid: invalid.map(a => ({ keyword: a.keyword, clientName: a.clientName }))
    });
  }

  const batchId = `batch-${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}`;
  console.log(`\n[Server] POST /batch/start | batchId=${batchId} | articles=${articles.length}`);

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    // Resolve clientInfo, website, clientId from client_folders for each unique client
    const uniqueClients = [...new Set(articles.map(a => a.clientName))];
    const { data: folders, error: folderError } = await supabase
      .from('client_folders')
      .select('name, id, website, client_info')
      .in('name', uniqueClients);

    if (folderError) {
      return res.status(500).json({ error: `Failed to lookup clients: ${folderError.message}` });
    }

    const clientMap = {};
    (folders || []).forEach(f => {
      clientMap[f.name] = { clientId: f.id, website: f.website, clientInfo: f.client_info };
    });

    // Check for unresolved clients
    const unresolved = uniqueClients.filter(c => !clientMap[c]);
    if (unresolved.length > 0) {
      return res.status(400).json({
        error: `${unresolved.length} client(s) not found in client_folders`,
        unresolved
      });
    }

    // Resolve template sections
    const templateIds = [...new Set(articles.map(a => a.template || 'practice-page'))];
    const { data: templates } = await supabase
      .from('templates')
      .select('id, sections')
      .in('id', templateIds);

    const templateMap = {};
    (templates || []).forEach(t => { templateMap[t.id] = t.sections; });

    // Enrich each article
    const enrichedArticles = articles.map(a => {
      const client = clientMap[a.clientName];
      const templateId = a.template || 'practice-page';
      const sections = templateMap[templateId] || [];

      return {
        keyword: a.keyword,
        clientName: a.clientName,
        clientId: client.clientId,
        clientInfo: client.clientInfo || '',
        website: client.website || '',
        template: templateId === 'practice-page' ? 'Practice Page' : 'Supporting/Resource Page',
        userId: userId || null,
        sections: sections.map((s, idx) => ({
          sectionNumber: idx + 1,
          name: s.title || s.name || `Section ${idx + 1}`,
          details: s.description || s.details || '',
          wordCount: s.wordCount || null,
        })),
      };
    });

    // Create batch_jobs row
    const { error: insertError } = await supabase.from('batch_jobs').insert({
      batch_id: batchId,
      created_by: userId || null,
      total_articles: enrichedArticles.length,
      csv_data: articles, // store original CSV data for retry
    });

    if (insertError) {
      return res.status(500).json({ error: `Failed to create batch job: ${insertError.message}` });
    }

    // Respond immediately
    res.status(202).json({
      status: 'accepted',
      batchId,
      totalArticles: enrichedArticles.length,
      message: 'Batch generation started. Poll /batch/status for progress.'
    });

    // Fire batch processing in background
    startBatch(batchId, enrichedArticles)
      .then(() => console.log(`[Server] Batch "${batchId}" processing complete`))
      .catch(err => console.error(`[Server] Batch "${batchId}" failed:`, err));

  } catch (err) {
    console.error('[Server] Batch start error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Poll batch status
app.get('/batch/status', async (req, res) => {
  const { batchId } = req.query;
  if (!batchId) return res.status(400).json({ error: 'Missing query param: batchId' });

  try {
    const status = await getBatchStatus(batchId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel a running batch
app.post('/batch/cancel', async (req, res) => {
  const { batchId } = req.body;
  if (!batchId) return res.status(400).json({ error: 'Missing field: batchId' });

  try {
    await cancelBatch(batchId);
    res.json({ status: 'cancelled', batchId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retry failed articles from a batch
app.post('/batch/retry', async (req, res) => {
  const { batchId } = req.body;
  if (!batchId) return res.status(400).json({ error: 'Missing field: batchId' });

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const { data: job } = await supabase.from('batch_jobs').select('csv_data, errors').eq('batch_id', batchId).single();

    if (!job || !job.errors || job.errors.length === 0) {
      return res.status(400).json({ error: 'No failed articles to retry' });
    }

    // Re-resolve client data for failed articles
    const failedKeywords = new Set(job.errors.map(e => e.keyword));
    const failedArticles = (job.csv_data || []).filter(a => failedKeywords.has(a.keyword));

    const uniqueClients = [...new Set(failedArticles.map(a => a.clientName))];
    const { data: folders } = await supabase.from('client_folders').select('name, id, website, client_info').in('name', uniqueClients);

    const clientMap = {};
    (folders || []).forEach(f => { clientMap[f.name] = { clientId: f.id, website: f.website, clientInfo: f.client_info }; });

    const templateIds = [...new Set(failedArticles.map(a => a.template || 'practice-page'))];
    const { data: templates } = await supabase.from('templates').select('id, sections').in('id', templateIds);
    const templateMap = {};
    (templates || []).forEach(t => { templateMap[t.id] = t.sections; });

    const enrichedArticles = failedArticles.map(a => {
      const client = clientMap[a.clientName] || {};
      const templateId = a.template || 'practice-page';
      const sections = templateMap[templateId] || [];
      return {
        keyword: a.keyword,
        clientName: a.clientName,
        clientId: client.clientId || null,
        clientInfo: client.clientInfo || '',
        website: client.website || '',
        template: templateId === 'practice-page' ? 'Practice Page' : 'Supporting/Resource Page',
        userId: null,
        sections: sections.map((s, idx) => ({
          sectionNumber: idx + 1,
          name: s.title || s.name || `Section ${idx + 1}`,
          details: s.description || s.details || '',
          wordCount: s.wordCount || null,
        })),
      };
    });

    res.status(202).json({
      status: 'retrying',
      batchId,
      retryCount: enrichedArticles.length,
      message: 'Retry started. Poll /batch/status for progress.'
    });

    retryFailed(batchId, enrichedArticles)
      .then(() => console.log(`[Server] Batch "${batchId}" retry complete`))
      .catch(err => console.error(`[Server] Batch "${batchId}" retry failed:`, err));

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Frontend API routes (ported from Netlify Functions) ──────────────────
app.use('/api', frontendApi);

// Also mount get-article and get-article-revisions at their legacy paths
// so the frontend can call /.netlify/functions/get-article → /get-article
app.use('/.netlify/functions', frontendApi);

// ─── Serve frontend static files ──────────────────────────────────────────
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// SPA fallback — serve index.html for all non-API routes (client-side routing)
app.get('*', (req, res) => {
  // Don't serve index.html for API or health check routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/generate') ||
      req.path.startsWith('/translate') || req.path.startsWith('/batch') ||
      req.path.startsWith('/.netlify/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Meerkat service running on port ${PORT}`);
  console.log(`Supabase table: ${process.env.SUPABASE_TABLE || 'article_outlines'}`);
  console.log(`Static files: ${publicDir}`);
});
