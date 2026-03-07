'use strict';

const { createClient } = require('@supabase/supabase-js');

let _client = null;

function getClient() {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }
  return _client;
}

/**
 * Upsert article data to Supabase.
 * @param {object} articleData
 * @returns {Promise<object>}
 */
async function upsertArticle(articleData) {
  const table = process.env.SUPABASE_TABLE || 'article_outlines_test';
  const client = getClient();

  const { data, error } = await client
    .from(table)
    .upsert(articleData, { onConflict: 'article_id' });

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  return data;
}

module.exports = { upsertArticle };
