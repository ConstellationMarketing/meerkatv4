'use strict';

require('dotenv').config();

const express = require('express');
const { runPipeline } = require('./pipeline');

const app = express();
app.use(express.json({ limit: '10mb' }));

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Meerkat service running on port ${PORT}`);
  console.log(`Supabase table: ${process.env.SUPABASE_TABLE || 'article_outlines_test'}`);
});
