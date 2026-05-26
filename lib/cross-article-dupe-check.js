'use strict';

/**
 * Cross-article duplicate-sentence detector.
 *
 * Editor feedback in May 2026 surfaced a recurring pattern: same boilerplate
 * sentences appearing across multiple articles for the same client (e.g.
 * Dostart Law's "$34.9 million jury award" claim showed up in 3 separate
 * Folsom articles; same Sabbeth Law intro fragments across 6 truck articles).
 *
 * This module fetches the N most recent articles for the same client and
 * flags any sentence in the new article that has >= 0.85 token overlap with
 * a sentence in a prior article. Warnings flow back through format-checker.
 *
 * Gated by CROSS_ARTICLE_DUPE_CHECK env var (default off). Off by default
 * because it adds a DB query per article generation and we want to verify
 * signal/noise rate before making it always-on.
 */

const { createClient } = require('@supabase/supabase-js');

const STOPWORDS = new Set([
  'a','an','the','and','or','but','if','of','in','on','at','to','for','from','by','with','as','is','are','was','were','be','been','being','this','that','these','those','it','its','our','your','their','his','her','we','you','they','i','our',
]);

let _client = null;
function getClient() {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      { db: { schema: 'meerkat' } }
    );
  }
  return _client;
}

function extractSentences(html) {
  if (!html) return [];
  // Strip HTML, collapse whitespace
  const text = String(html).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  // Sentence split on .!? followed by whitespace + capital letter (handles
  // abbreviations like "St. Louis" better than naive split)
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
  return parts.map(s => s.trim()).filter(s => s.length > 0);
}

function tokenize(sentence) {
  return sentence
    .toLowerCase()
    .replace(/[^\w\s$%.-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

// Jaccard similarity on content-word sets
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return intersection / union;
}

/**
 * Find sentences in newHtml that closely overlap with sentences in
 * any of priorArticles' content. Returns warning strings.
 *
 * @param {string} newHtml
 * @param {Array<{keyword:string, content:string}>} priorArticles
 * @param {object} [opts]
 * @param {number} [opts.minWords=8]       - skip sentences shorter than this
 * @param {number} [opts.threshold=0.85]   - Jaccard similarity threshold
 * @returns {string[]} warnings
 */
function findCrossArticleDuplicates(newHtml, priorArticles, opts = {}) {
  const minWords = opts.minWords ?? 8;
  // Threshold is verbatim-leaning. Real-world boilerplate like the Dostart
  // "$34.9 million jury award" sentence sits ~0.80 token overlap when the
  // surrounding sentence structure varies slightly. Tuneable via env var
  // CROSS_ARTICLE_DUPE_THRESHOLD (e.g. "0.75").
  const threshold = opts.threshold ?? Number(process.env.CROSS_ARTICLE_DUPE_THRESHOLD || 0.80);

  const newSentences = extractSentences(newHtml);
  const warnings = [];

  // Pre-tokenize prior sentences once per prior article
  const priorTokenized = priorArticles.map(p => ({
    keyword: p.keyword,
    sentences: extractSentences(p.content).map(s => ({
      raw: s,
      tokens: new Set(tokenize(s)),
    })).filter(s => s.tokens.size >= minWords),
  }));

  for (const newSentence of newSentences) {
    const tokens = tokenize(newSentence);
    if (tokens.size < minWords) continue;
    const tokenSet = new Set(tokens);

    let matched = false;
    for (const prior of priorTokenized) {
      if (matched) break;
      for (const priorSent of prior.sentences) {
        const sim = jaccard(tokenSet, priorSent.tokens);
        if (sim >= threshold) {
          // One warning per new-article sentence — report the first matching
          // prior and move on to the next new sentence.
          warnings.push(
            `CROSS-ARTICLE DUPE: "${newSentence.slice(0, 140)}${newSentence.length > 140 ? '…' : ''}" (${(sim * 100).toFixed(0)}% match with prior article "${prior.keyword}")`
          );
          matched = true;
          break;
        }
      }
    }
  }
  return warnings;
}

/**
 * Pipeline entry point. Fetches recent same-client articles and runs the
 * dupe check. Returns warnings (or [] if disabled / no prior articles).
 *
 * @param {string} html
 * @param {string} clientName
 * @param {string} [excludeArticleId]   - skip this article_id (the one being generated)
 * @param {number} [limit=5]
 * @returns {Promise<string[]>}
 */
async function checkCrossArticleDuplicates(html, clientName, excludeArticleId, limit = 5) {
  if (!process.env.CROSS_ARTICLE_DUPE_CHECK) return [];
  if (!clientName) return [];

  let prior = [];
  try {
    const table = process.env.SUPABASE_TABLE || 'article_outlines';
    let q = getClient()
      .from(table)
      .select('article_id, keyword, received_article, "cleaned content"')
      .eq('client_name', clientName)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // +1 in case the current article is already in the set
    if (excludeArticleId) q = q.neq('article_id', excludeArticleId);
    const { data, error } = await q;
    if (error) {
      console.warn('[CrossDupeCheck] fetch failed:', error.message);
      return [];
    }
    prior = (data || []).slice(0, limit).map(row => ({
      keyword: row.keyword || row.article_id,
      // Prefer editor's saved version (more representative of shipped boilerplate);
      // fall back to original generated content if nothing has been edited yet.
      content: row.received_article?.content || row['cleaned content'] || '',
    })).filter(p => p.content);
  } catch (e) {
    console.warn('[CrossDupeCheck] error fetching prior articles:', e.message);
    return [];
  }

  if (!prior.length) return [];

  return findCrossArticleDuplicates(html, prior);
}

module.exports = {
  findCrossArticleDuplicates,
  checkCrossArticleDuplicates,
  // exposed for testing
  _internals: { extractSentences, tokenize, jaccard },
};
