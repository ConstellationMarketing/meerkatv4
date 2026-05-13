#!/usr/bin/env node
/**
 * One-off recovery script: restore article_outlines rows present in old Meerkat
 * but missing from master.meerkat (deleted by the rogue cleanup-script incident
 * on 2026-05-07).
 *
 * Idempotent: ON CONFLICT (article_id) DO NOTHING.
 * FK-safe: nulls user_id when the referenced auth.users row no longer exists in master.
 */
'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const { USER_REMAP } = require('./config');

const old = new Pool({ connectionString: process.env.MEERKAT_PG_URL });
const m = new Pool({ connectionString: process.env.MASTER_PG_URL });

(async () => {
  const masterIds = new Set(
    (await m.query('select article_id from meerkat.article_outlines')).rows.map(r => r.article_id)
  );

  const o = await old.query("select * from public.article_outlines where article_id is not null");
  const missing = o.rows.filter(r => !masterIds.has(r.article_id));
  console.log('Restoring', missing.length, 'articles');

  const validUserIds = new Set(
    (await m.query('select id from auth.users')).rows.map(r => r.id)
  );

  const gen = await m.query(
    "select column_name from information_schema.columns where table_schema='meerkat' and table_name='article_outlines' and is_generated <> 'NEVER'"
  );
  const skipCols = new Set(gen.rows.map(r => r.column_name));
  skipCols.add('user ID'); // legacy column dropped during migration

  const jsonCols = new Set(
    (await m.query(
      "select column_name from information_schema.columns where table_schema='meerkat' and table_name='article_outlines' and data_type in ('json','jsonb')"
    )).rows.map(r => r.column_name)
  );

  let inserted = 0, nulledUser = 0;
  const failed = [];
  for (const row of missing) {
    let userId = row.user_id;
    if (userId && userId in USER_REMAP) userId = USER_REMAP[userId];
    if (userId && !validUserIds.has(userId)) {
      userId = null;
      nulledUser++;
    }
    const rowToInsert = { ...row, user_id: userId };
    delete rowToInsert['user ID'];

    const cols = Object.keys(rowToInsert).filter(
      k => !skipCols.has(k) && rowToInsert[k] !== undefined
    );
    const vals = cols.map(k => {
      const v = rowToInsert[k];
      if (jsonCols.has(k) && v != null) return JSON.stringify(v);
      return v;
    });
    const ph = cols.map((_, i) => '$' + (i + 1));
    const sql =
      'insert into meerkat.article_outlines (' +
      cols.map(c => '"' + c + '"').join(',') +
      ') values (' +
      ph.join(',') +
      ') on conflict (article_id) do nothing';
    try {
      await m.query(sql, vals);
      inserted++;
    } catch (e) {
      failed.push({
        article_id: row.article_id,
        keyword: (row.keyword || '').slice(0, 40),
        err: e.message.slice(0, 120),
      });
    }
  }

  console.log();
  console.log('Inserted:', inserted, '| user_id NULLed (FK invalid):', nulledUser, '| failed:', failed.length);
  failed.slice(0, 5).forEach(f => console.log(' ', f.article_id, f.keyword, '|', f.err));

  const after = await m.query('select count(*)::int as n from meerkat.article_outlines');
  console.log('master.meerkat.article_outlines total after restore:', after.rows[0].n);

  await old.end();
  await m.end();
})();
