'use strict';

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { getArticle, updateTranslation } = require('./supabase');
const { publishTranslation } = require('./github-publish');

const client = new Anthropic();

const PROMPT_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '../prompts/translator.md'),
  'utf8'
);

const LANGUAGE_CONFIGS = {
  es: {
    name: 'Spanish',
    standard: 'standard neutral Spanish as understood across all Spanish-speaking communities',
    htmlLang: 'es',
    label: 'Español',
  },
  vi: {
    name: 'Vietnamese',
    standard: 'standard neutral Vietnamese as understood by Vietnamese speakers regardless of regional background',
    htmlLang: 'vi',
    label: 'Tiếng Việt',
  },
};

function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

function parsePrompt(template, vars) {
  const filled = fillTemplate(template, vars);
  const systemMatch = filled.match(/^SYSTEM:\s*([\s\S]+?)(?=\nUSER:)/m);
  const userMatch = filled.match(/\nUSER:\s*([\s\S]+)$/m);
  return {
    system: systemMatch ? systemMatch[1].trim() : '',
    user: userMatch ? userMatch[1].trim() : filled,
  };
}

async function runTranslation(articleId, language) {
  const config = LANGUAGE_CONFIGS[language];
  if (!config) throw new Error(`Unsupported language: ${language}`);

  console.log(`[Translate] Starting: articleId=${articleId} lang=${language}`);

  const article = await getArticle(articleId);
  if (!article) throw new Error(`Article not found: ${articleId}`);

  const sourceHtml = article['cleaned content'];
  if (!sourceHtml) throw new Error(`No cleaned content for article: ${articleId}`);

  // Mark as pending immediately
  await updateTranslation(articleId, language, {
    status: 'pending',
    translated_at: null,
    content: null,
  });

  // Build prompt
  const { system, user } = parsePrompt(PROMPT_TEMPLATE, {
    LANGUAGE: config.name,
    LANGUAGE_STANDARD: config.standard,
    HTML: sourceHtml,
  });

  // Translate with Claude Haiku
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const translatedHtml = response.content[0].text
    .trim()
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const translatedAt = new Date().toISOString();

  // Write to Supabase
  await updateTranslation(articleId, language, {
    status: 'complete',
    translated_at: translatedAt,
    content: translatedHtml,
  });

  console.log(`[Translate] Supabase updated: articleId=${articleId} lang=${language}`);

  // Publish to GitHub
  const slug = article['URL Slug'];
  if (slug && process.env.GITHUB_TOKEN) {
    await publishTranslation({
      articleId,
      language,
      config,
      slug,
      clientName: article.client_name,
      keyword: article.keyword,
      translatedHtml,
    });
  } else {
    console.log('[Translate] Skipping GitHub publish — no slug or GITHUB_TOKEN');
  }

  console.log(`[Translate] Complete: articleId=${articleId} lang=${language}`);
}

async function getTranslationStatus(articleId, language) {
  const article = await getArticle(articleId);
  if (!article) return { status: 'not_found' };

  const translations = article.translations || {};
  const lang = translations[language];
  if (!lang) return { status: 'none' };

  return { status: lang.status, translated_at: lang.translated_at };
}

module.exports = { runTranslation, getTranslationStatus };
