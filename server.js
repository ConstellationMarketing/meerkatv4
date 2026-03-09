'use strict';

require('dotenv').config();

const express = require('express');
const { runPipeline } = require('./pipeline');
const { runTranslation, getTranslationStatus } = require('./lib/translate');

const app = express();
app.use(express.json({ limit: '10mb' }));

// CORS — allow requests from internal.goconstellation.com
// Note: the VPS must be served over HTTPS for browser requests from an HTTPS page to work.
// Set TRANSLATE_API_URL in .env once HTTPS is configured (e.g. Nginx + Let's Encrypt).
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === 'https://internal.goconstellation.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'meerkat-service', table: process.env.SUPABASE_TABLE || 'article_outlines_test' });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Meerkat service running on port ${PORT}`);
  console.log(`Supabase table: ${process.env.SUPABASE_TABLE || 'article_outlines_test'}`);
});
