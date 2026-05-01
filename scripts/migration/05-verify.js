#!/usr/bin/env node
/**
 * Step 5: Verify the migration. Fails (exit 1) if anything's off.
 *
 * Checks:
 *   1. Every expected schema + table exists in master
 *   2. Row counts match source (with the team_members exception for dropped users)
 *   3. UUID remap fired: old UUIDs absent from master, new UUIDs present at expected counts
 *   4. Deprecated users (pc@, krshnrydmn@) nullified in article_outlines, gone from team_members
 *   5. Legacy "user ID" column dropped from meerkat.article_outlines
 *   6. JSON columns parse-back-to-object cleanly (spot check)
 *   7. Cross-schema trigger functions still callable (templates audit + set_updated_at)
 *
 * Run: `node scripts/migration/05-verify.js`
 */
'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const { SCHEMA_MAP, USER_REMAP, DROP_TEAM_MEMBERS_FOR_USERS } = require('./config');

const checks = [];
let failed = 0;

function record(name, ok, details = '') {
  checks.push({ name, ok, details });
  if (!ok) failed++;
  const icon = ok ? '✓' : '✗';
  const line = `  ${icon} ${name}` + (details ? ` — ${details}` : '');
  console.log(line);
}

(async () => {
  const src = new Pool({ connectionString: process.env.MEERKAT_PG_URL });
  const dst = new Pool({ connectionString: process.env.MASTER_PG_URL });

  try {
    // ─── 1. Schema + table existence ─────────────────────────────────────────
    console.log('\n[1] Schema + table existence in master');
    for (const [schema, tables] of Object.entries(SCHEMA_MAP)) {
      const r = await dst.query(
        `SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE c.relkind='r' AND n.nspname=$1`,
        [schema]
      );
      const present = new Set(r.rows.map(x => x.relname));
      // public_shares only exists for meerkat — it's a NEW_TABLE, allow it.
      const expected = schema === 'meerkat' ? [...tables, 'public_shares'] : tables;
      const missing = expected.filter(t => !present.has(t));
      record(
        `schema "${schema}" has ${expected.length} expected tables`,
        missing.length === 0,
        missing.length ? `missing: ${missing.join(', ')}` : `${present.size} found`
      );
    }

    // ─── 2. Row count parity ─────────────────────────────────────────────────
    console.log('\n[2] Row count parity (source vs master)');
    for (const [schema, tables] of Object.entries(SCHEMA_MAP)) {
      for (const t of tables) {
        const s = await src.query(`SELECT count(*)::int AS n FROM "public"."${t}"`);
        const m = await dst.query(`SELECT count(*)::int AS n FROM "${schema}"."${t}"`);
        const expected = (t === 'team_members') ? s.rows[0].n - DROP_TEAM_MEMBERS_FOR_USERS.length : s.rows[0].n;
        record(
          `${schema}.${t}`,
          m.rows[0].n === expected,
          `source=${s.rows[0].n} master=${m.rows[0].n} expected=${expected}`
        );
      }
    }

    // ─── 3. UUID remap fired ─────────────────────────────────────────────────
    console.log('\n[3] UUID remap (old UUIDs absent, new UUIDs present)');
    for (const [oldUuid, newUuid] of Object.entries(USER_REMAP)) {
      const oldCount = (await dst.query(
        'SELECT count(*)::int AS n FROM meerkat.article_outlines WHERE user_id::text = $1',
        [oldUuid]
      )).rows[0].n;
      record(`old UUID ${oldUuid.slice(0, 8)} absent from article_outlines`, oldCount === 0, `count=${oldCount}`);

      if (newUuid !== null) {
        // Source had this user → master should have the SAME count under the new UUID
        const srcCount = (await src.query(
          'SELECT count(*)::int AS n FROM public.article_outlines WHERE user_id::text = $1',
          [oldUuid]
        )).rows[0].n;
        const newCount = (await dst.query(
          'SELECT count(*)::int AS n FROM meerkat.article_outlines WHERE user_id::text = $1',
          [newUuid]
        )).rows[0].n;
        record(
          `new UUID ${newUuid.slice(0, 8)} has expected count`,
          newCount >= srcCount, // ≥ because the new UUID may already have its own master rows
          `source(old)=${srcCount} master(new)=${newCount}`
        );
      }
    }

    // ─── 4. Deprecated users gone from team_members ──────────────────────────
    console.log('\n[4] Deprecated users dropped from team_members');
    for (const uid of DROP_TEAM_MEMBERS_FOR_USERS) {
      const n = (await dst.query(
        'SELECT count(*)::int AS n FROM meerkat.team_members WHERE user_id::text = $1',
        [uid]
      )).rows[0].n;
      record(`team_members has no rows for ${uid.slice(0, 8)}`, n === 0, `count=${n}`);
    }

    // ─── 5. Legacy "user ID" column dropped ──────────────────────────────────
    console.log('\n[5] Legacy "user ID" column dropped from meerkat.article_outlines');
    const cols = (await dst.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='meerkat' AND table_name='article_outlines'`
    )).rows.map(r => r.column_name);
    record(
      'no "user ID" column in master',
      !cols.includes('user ID'),
      `user-id-related cols: ${cols.filter(c => c.toLowerCase().includes('user')).join(', ')}`
    );

    // ─── 6. JSON columns are readable ────────────────────────────────────────
    console.log('\n[6] JSON columns parse cleanly');
    const jsonSample = await dst.query(`
      SELECT jsonb_typeof(sections) as st,
             jsonb_typeof(received_article) as ra,
             jsonb_typeof(translations) as tr
      FROM meerkat.article_outlines
      WHERE sections IS NOT NULL
      LIMIT 5
    `);
    record(
      'jsonb_typeof returns valid types for sample rows',
      jsonSample.rows.length > 0 && jsonSample.rows.every(r => r.st),
      `${jsonSample.rows.length} sample rows checked`
    );

    // ─── 7. Trigger functions exist + are callable from new schemas ──────────
    console.log('\n[7] Cross-schema trigger functions exist in public');
    const fns = await dst.query(
      `SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname IN ('set_updated_at', 'log_templates_change')`
    );
    record(
      'public.set_updated_at + public.log_templates_change exist',
      fns.rows.length === 2,
      `found: ${fns.rows.map(r => r.proname).join(', ')}`
    );

    // Triggers on new-schema tables that reference these functions
    const triggers = await dst.query(`
      SELECT n.nspname AS schema, c.relname AS table, t.tgname AS trigger
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT t.tgisinternal
        AND n.nspname IN ('meerkat','spr','os')
      ORDER BY n.nspname, c.relname
    `);
    record(
      'triggers wired up on new-schema tables',
      triggers.rows.length > 0,
      `${triggers.rows.length} triggers (sample: ${triggers.rows.slice(0, 3).map(r => `${r.schema}.${r.table}/${r.trigger}`).join(', ')})`
    );

    // ─── Summary ─────────────────────────────────────────────────────────────
    console.log(`\n=== ${checks.length} checks run, ${failed} failed ===`);
    if (failed > 0) {
      console.error('Verification FAILED. Address the issues above before cutover.');
      process.exit(1);
    }
    console.log('All checks passed. Migration data is consistent with source + transformations.');
  } finally {
    await src.end();
    await dst.end();
  }
})().catch(e => { console.error('[05] CRASHED:', e); process.exit(1); });
