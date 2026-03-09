'use strict';

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { compileArticle } = require('./lib/article-compiler');
const { insertLinks } = require('./lib/insert-links');
const { applyCompliance } = require('./lib/apply-compliance');
const { scoreArticle } = require('./lib/scoring');
const { upsertArticle } = require('./lib/supabase');
const { uploadToDrive } = require('./lib/drive-upload');
const { publishArticle } = require('./lib/github-publish');

const client = new Anthropic();

// Load prompts at startup
const PROMPTS_DIR = path.join(__dirname, 'prompts');
const prompts = {};
['section-writer', 'external-links', 'internal-links', 'title-meta', 'legal-compliance', 'schema-generator', 'slug-url'].forEach(name => {
  prompts[name] = fs.readFileSync(path.join(PROMPTS_DIR, `${name}.md`), 'utf8');
});

// Fill template placeholders
function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// Parse SYSTEM/USER sections from prompt file
function parsePrompt(template, vars) {
  const filled = fillTemplate(template, vars);
  const systemMatch = filled.match(/^SYSTEM:\s*([\s\S]+?)(?=\nUSER:)/m);
  const userMatch = filled.match(/\nUSER:\s*([\s\S]+)$/m);
  return {
    system: systemMatch ? systemMatch[1].trim() : '',
    user: userMatch ? userMatch[1].trim() : filled
  };
}

// Call Claude and return text output
async function callClaude(systemPrompt, userPrompt, model = 'claude-haiku-4-5-20251001') {
  const msg = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });
  return msg.content[0].text.trim();
}

// Parse JSON from Claude output (strips code fences if present)
function parseJSON(raw) {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

// Generate one section with QC retry loop
async function generateSection(payload, section) {
  const vars = {
    keyword: payload.keyword,
    clientName: payload.clientName,
    clientId: payload.clientId,
    website: payload.website,
    clientInfo: payload.clientInfo,
    articleId: payload.articleId,
    sectionNumber: section.sectionNumber,
    details: section.details,
    wordCount: section.wordCount
  };

  const { system, user } = parsePrompt(prompts['section-writer'], vars);

  let lastOutput = null;
  let lastScore = null;
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let userMsg = user;
    if (attempt > 0 && lastScore !== null) {
      userMsg += `\n\nPrevious output scored ${lastScore}/100. Shorten sentences. Simplify vocabulary.`;
    }

    const output = await callClaude(system, userMsg, 'claude-sonnet-4-6');
    const { rawScore } = scoreArticle(output);
    lastOutput = output;
    lastScore = rawScore;

    if (rawScore >= 70) break;

    if (attempt === MAX_RETRIES) {
      console.warn(`Section ${section.sectionNumber} scored ${rawScore} after ${MAX_RETRIES + 1} attempts — using as-is`);
    }
  }

  return { output: lastOutput, fleschScore: lastScore, sectionNumber: section.sectionNumber };
}

// Parse internal URLs from clientInfo (extract URLs)
function extractInternalUrls(clientInfo) {
  if (!clientInfo) return '';
  const urlRegex = /https?:\/\/[^\s,\]>)"}]+/g;
  const matches = clientInfo.match(urlRegex) || [];
  return matches.join('\n');
}

/**
 * Main pipeline: generate article from webhook payload.
 * @param {object} payload - Webhook body
 * @returns {Promise<object>} Final article data
 */
async function runPipeline(payload) {
  const {
    articleid: articleId,
    clientId,
    clientName,
    clientInfo,
    website,
    keyword,
    sections,
    template,
    userId,
    webhookUrl
  } = payload;

  console.log(`[Pipeline] Starting: articleId=${articleId}, keyword="${keyword}", sections=${sections.length}`);

  // ─── 1. Parallel section generation ───────────────────────────────────────
  console.log(`[Pipeline] Generating ${sections.length} sections in parallel...`);
  const sectionResults = await Promise.all(
    sections.map(section =>
      generateSection({ articleId, clientId, clientName, clientInfo, website, keyword }, section)
        .catch(err => {
          console.error(`Section ${section.sectionNumber} failed:`, err.message);
          return { output: `[Section ${section.sectionNumber} generation failed]`, fleschScore: 0, sectionNumber: section.sectionNumber };
        })
    )
  );

  // Sort by original section order
  sectionResults.sort((a, b) => a.sectionNumber - b.sectionNumber);
  const sectionTexts = sectionResults.map(r => r.output);

  // ─── 2. Compile HTML ───────────────────────────────────────────────────────
  console.log('[Pipeline] Compiling HTML...');
  const htmlContent = compileArticle(sectionTexts);

  // ─── 3. Parallel: external links + internal links + title/meta ─────────────
  console.log('[Pipeline] Running link enrichment and title/meta in parallel...');
  const internalUrls = extractInternalUrls(clientInfo);

  const [externalLinksRaw, internalLinksRaw, titleMetaRaw] = await Promise.all([
    callClaude(
      ...Object.values(parsePrompt(prompts['external-links'], { htmlContent })),
      'claude-haiku-4-5-20251001'
    ).catch(err => { console.error('External links failed:', err.message); return '[]'; }),

    callClaude(
      ...Object.values(parsePrompt(prompts['internal-links'], { htmlContent, internalUrls })),
      'claude-haiku-4-5-20251001'
    ).catch(err => { console.error('Internal links failed:', err.message); return '[]'; }),

    callClaude(
      ...Object.values(parsePrompt(prompts['title-meta'], { keyword, htmlContent })),
      'claude-haiku-4-5-20251001'
    ).catch(err => { console.error('Title/meta failed:', err.message); return '{"titleTag":"","description":""}'; })
  ]);

  // ─── 4. Parse and merge links ──────────────────────────────────────────────
  let externalLinks = [];
  let internalLinks = [];
  try { externalLinks = parseJSON(externalLinksRaw); } catch (e) { console.error('Parse external links failed:', e.message); }
  try { internalLinks = parseJSON(internalLinksRaw); } catch (e) { console.error('Parse internal links failed:', e.message); }

  const allLinks = [...externalLinks, ...internalLinks];
  const { htmlContent: linkedHTML } = insertLinks(htmlContent, allLinks);

  // ─── 5. Build full content with SEO header ─────────────────────────────────
  let titleMeta = { titleTag: '', description: '' };
  try { titleMeta = parseJSON(titleMetaRaw); } catch (e) { console.error('Parse title/meta failed:', e.message); }

  const seoHeader = `\n<div class="seo-header">\n  <h1>${titleMeta.titleTag}</h1>\n  <p class="meta-description">${titleMeta.description}</p>\n</div>\n`;
  const fullContent = seoHeader + linkedHTML;

  // ─── 6. Legal ethics compliance ───────────────────────────────────────────
  console.log('[Pipeline] Running legal compliance check...');
  let complianceResult = { violations: [], total: 0, categories: [] };
  try {
    const complianceRaw = await callClaude(
      ...Object.values(parsePrompt(prompts['legal-compliance'], { htmlContent: fullContent })),
      'claude-sonnet-4-6'
    );
    complianceResult = parseJSON(complianceRaw);
  } catch (e) {
    console.error('Compliance check failed:', e.message);
  }

  const { htmlContent: cleanedContent } = applyCompliance(fullContent, complianceResult);

  // ─── 7. Parallel: schema + slug ────────────────────────────────────────────
  console.log('[Pipeline] Generating schema and slug in parallel...');
  const [schemaRaw, slugRaw] = await Promise.all([
    callClaude(
      ...Object.values(parsePrompt(prompts['schema-generator'], { htmlContent: cleanedContent })),
      'claude-haiku-4-5-20251001'
    ).catch(err => { console.error('Schema failed:', err.message); return ''; }),

    callClaude(
      ...Object.values(parsePrompt(prompts['slug-url'], { website, content: cleanedContent })),
      'claude-haiku-4-5-20251001'
    ).catch(err => { console.error('Slug failed:', err.message); return '{"articleTitle":"","urlSlug":"","pageUrl":""}'; })
  ]);

  let schema = null;
  let slugData = { articleTitle: '', urlSlug: '', pageUrl: '' };
  try { schema = schemaRaw; } catch (e) { console.error('Schema parse failed:', e.message); }
  try { slugData = parseJSON(slugRaw); } catch (e) { console.error('Slug parse failed:', e.message); }

  // ─── 8. Score final article ────────────────────────────────────────────────
  const scores = scoreArticle(cleanedContent);

  // ─── 9. Upsert to Supabase ────────────────────────────────────────────────
  console.log('[Pipeline] Upserting to Supabase...');
  const articleRecord = {
    received_article: cleanedContent,
    id: Math.random().toString(36).substring(2, 12),
    client_id: clientId,
    keyword,
    client_name: clientName,
    article_id: articleId,
    sections: JSON.stringify(sections),
    Schema: schema,
    template: template || null,
    'word count': scores.wordCount,
    'flesch score': scores.fleschScore,
    'Page URL': slugData.pageUrl,
    'URL Slug': slugData.urlSlug,
    user_id: userId,
    'cleaned content': cleanedContent
  };

  let supabaseError = null;
  try {
    await upsertArticle(articleRecord);
    console.log('[Pipeline] Supabase upsert success');
  } catch (err) {
    supabaseError = err.message;
    console.error('[Pipeline] Supabase upsert failed:', err.message);
  }

  // ─── 10. Upload HTML preview to Google Drive ──────────────────────────────
  try {
    await uploadToDrive({
      clientName,
      keyword,
      articleId,
      fleschScore: scores.fleschScore,
      wordCount: scores.wordCount,
      pageUrl: slugData.pageUrl,
      supabaseError,
      htmlContent: cleanedContent
    });
  } catch (err) {
    console.error('[Pipeline] Drive upload failed:', err.message);
  }

  // ─── 11. Publish to internal.goconstellation.com ──────────────────────────
  let publishedUrl = null;
  try {
    publishedUrl = await publishArticle({
      articleId,
      clientName,
      keyword,
      slug: slugData.urlSlug || articleId,
      htmlContent: cleanedContent,
      fleschScore: scores.fleschScore,
      wordCount: scores.wordCount,
      pageUrl: slugData.pageUrl,
      userId
    });
  } catch (err) {
    console.error('[Pipeline] Publish failed:', err.message);
  }

  return {
    articleId,
    keyword,
    wordCount: scores.wordCount,
    fleschScore: scores.fleschScore,
    pageUrl: slugData.pageUrl,
    urlSlug: slugData.urlSlug,
    supabaseError,
    publishedUrl,
    table: process.env.SUPABASE_TABLE || 'article_outlines_test'
  };
}

module.exports = { runPipeline };
