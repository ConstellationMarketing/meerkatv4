#!/usr/bin/env node
/**
 * Step 4: Copy rows from old Meerkat (public.*) → master (<schema>.<table>).
 *
 * Per-table strategy:
 *   - Stream rows from source via SELECT *
 *   - Apply transformations (UUID remap, drop "user ID" column, null deprecated users)
 *   - INSERT in batches into master
 *
 * Idempotency:
 *   - Default: errors if any target table already has rows (don't overwrite).
 *   - --truncate: TRUNCATE all target tables first (safe pre-cutover repeat).
 *   - --skip-existing: skip tables that already have rows (resume after partial run).
 *
 * Usage:
 *   node scripts/migration/04-copy-data.js --truncate
 */
'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const {
  SCHEMA_MAP,
  USER_REMAP,
  DROP_TEAM_MEMBERS_FOR_USERS,
  DDL_TRANSFORMS,
} = require('./config');

const args = new Set(process.argv.slice(2));
const TRUNCATE = args.has('--truncate');
const SKIP_EXISTING = args.has('--skip-existing');

// Source-table column to drop during copy (legacy). Match DDL_TRANSFORMS.drop_columns.
const dropCols = DDL_TRANSFORMS.drop_columns || {};

// User-id columns we must remap. Each entry: [source_table, column].
// Built from the schema audit. team_members rows for deprecated users are dropped entirely
// (handled separately).
const USER_ID_COLUMNS = [
  ['article_outlines', 'user_id'],
  ['team_members', 'user_id'],
  ['client_folders', 'user_id'],
  ['templates', 'user_id'],
  ['chat_messages', 'user_id'],
  ['article_comments', 'user_id'],
  ['article_access', 'created_by'],
  ['batch_jobs', 'created_by'],
  ['admin_prompts', 'updated_by'],
];

const BATCH_SIZE = 500;

// Map: table name → user-id columns on that table (so we can remap during copy).
const userColsByTable = {};
for (const [t, c] of USER_ID_COLUMNS) {
  (userColsByTable[t] = userColsByTable[t] || []).push(c);
}

function remapUserId(uuid) {
  if (uuid == null) return null;
  if (uuid in USER_REMAP) return USER_REMAP[uuid]; // null when user is deprecated
  return uuid;
}

async function tableExists(client, schema, table) {
  const r = await client.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2) as ok`,
    [schema, table]
  );
  return r.rows[0].ok;
}

async function rowCount(client, schema, table) {
  const r = await client.query(`SELECT count(*)::int AS n FROM "${schema}"."${table}"`);
  return r.rows[0].n;
}

async function copyTable(srcPool, dstPool, sourceTable, destSchema) {
  const dstClient = await dstPool.connect();
  const srcClient = await srcPool.connect();
  try {
    // Sanity
    if (!(await tableExists(dstClient, destSchema, sourceTable))) {
      throw new Error(`Target ${destSchema}.${sourceTable} doesn't exist — re-run step 03`);
    }

    // Get source columns + types (excluding ones we drop)
    const colsRes = await srcClient.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1
       ORDER BY ordinal_position`,
      [sourceTable]
    );
    const dropList = dropCols[sourceTable] || [];
    const columnRows = colsRes.rows.filter(r => !dropList.includes(r.column_name));
    const columns = columnRows.map(r => r.column_name);
    const quotedCols = columns.map(c => `"${c}"`).join(', ');
    // pg returns json/jsonb values as parsed JS objects; we must stringify them on insert.
    const jsonColumns = new Set(columnRows.filter(r => ['json', 'jsonb'].includes(r.data_type)).map(r => r.column_name));

    // For team_members: filter out deprecated users
    const wherePart = sourceTable === 'team_members' && DROP_TEAM_MEMBERS_FOR_USERS.length > 0
      ? `WHERE "user_id"::text NOT IN (${DROP_TEAM_MEMBERS_FOR_USERS.map((_, i) => `$${i + 1}`).join(', ')})`
      : '';
    const whereParams = sourceTable === 'team_members' ? DROP_TEAM_MEMBERS_FOR_USERS : [];

    const srcQuery = `SELECT ${quotedCols} FROM "public"."${sourceTable}" ${wherePart}`;
    const srcRows = await srcClient.query(srcQuery, whereParams);

    if (srcRows.rows.length === 0) {
      console.log(`  ${destSchema}.${sourceTable}: 0 rows (nothing to copy)`);
      return { copied: 0 };
    }

    // Transform rows: remap user-id columns
    const remapColumns = userColsByTable[sourceTable] || [];
    const transformed = srcRows.rows.map(r => {
      const out = { ...r };
      for (const c of remapColumns) {
        if (c in out) out[c] = remapUserId(out[c]);
      }
      return out;
    });

    // Bulk insert in batches
    let copied = 0;
    for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
      const batch = transformed.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map((_, rowIdx) =>
        '(' + columns.map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`).join(', ') + ')'
      ).join(', ');
      const values = batch.flatMap(row => columns.map(c => {
        const v = row[c];
        // Stringify JSON columns (pg returns objects from jsonb but won't restringify on write)
        // jsonb values: always stringify so plain strings get re-quoted as JSON literals
        if (jsonColumns.has(c) && v != null) return JSON.stringify(v);
        return v;
      }));
      const insertSql = `INSERT INTO "${destSchema}"."${sourceTable}" (${quotedCols}) VALUES ${placeholders}`;
      try {
        await dstClient.query(insertSql, values);
      } catch (batchErr) {
        // Bisect: try one row at a time to find the offender
        for (let j = 0; j < batch.length; j++) {
          const row = batch[j];
          const rowVals = columns.map(c => {
            const v = row[c];
            // jsonb values: always stringify so plain strings get re-quoted as JSON literals
        if (jsonColumns.has(c) && v != null) return JSON.stringify(v);
            return v;
          });
          const ph = '(' + columns.map((_, k) => `$${k + 1}`).join(', ') + ')';
          try {
            await dstClient.query(`INSERT INTO "${destSchema}"."${sourceTable}" (${quotedCols}) VALUES ${ph}`, rowVals);
          } catch (e) {
            console.error(`\n  ROW ${i + j} FAILS:`);
            console.error(`  error:`, e.message);
            console.error(`  row keys + types:`);
            for (const c of columns) {
              const raw = row[c];
              const v = jsonColumns.has(c) && raw != null && typeof raw === 'object' ? JSON.stringify(raw).slice(0, 100) : raw;
              console.error(`    ${c.padEnd(25)} ${typeof raw} ${jsonColumns.has(c) ? '[JSON]' : ''} = ${typeof v === 'string' ? v.slice(0, 80) : v}`);
            }
            throw e;
          }
        }
      }
      copied += batch.length;
    }
    return { copied };
  } finally {
    srcClient.release();
    dstClient.release();
  }
}

(async () => {
  if (!process.env.MEERKAT_PG_URL || !process.env.MASTER_PG_URL) {
    console.error('Missing MEERKAT_PG_URL or MASTER_PG_URL in .env');
    process.exit(1);
  }

  const srcPool = new Pool({ connectionString: process.env.MEERKAT_PG_URL });
  const dstPool = new Pool({ connectionString: process.env.MASTER_PG_URL });

  try {
    if (TRUNCATE) {
      console.log('[04] --truncate: clearing all target tables');
      const dst = await dstPool.connect();
      try {
        for (const [schema, tables] of Object.entries(SCHEMA_MAP)) {
          for (const t of tables) {
            await dst.query(`TRUNCATE TABLE "${schema}"."${t}" CASCADE`).catch(() => {});
          }
        }
      } finally { dst.release(); }
    }

    let totalCopied = 0;
    let totalSkipped = 0;
    for (const [schema, tables] of Object.entries(SCHEMA_MAP)) {
      console.log(`\n[04] schema "${schema}":`);
      for (const t of tables) {
        const dst = await dstPool.connect();
        let existing;
        try {
          existing = await rowCount(dst, schema, t);
        } finally { dst.release(); }

        if (existing > 0 && !TRUNCATE) {
          if (SKIP_EXISTING) {
            console.log(`  ${schema}.${t}: skip (already has ${existing} rows)`);
            totalSkipped++;
            continue;
          }
          console.error(`  ${schema}.${t}: HAS ${existing} ROWS — refusing to copy. Use --truncate or --skip-existing.`);
          process.exit(1);
        }

        const { copied } = await copyTable(srcPool, dstPool, t, schema);
        console.log(`  ${schema}.${t}: copied ${copied}`);
        totalCopied += copied;
      }
    }

    console.log(`\n[04] Done. Copied ${totalCopied} rows total. Skipped ${totalSkipped} tables.`);
    console.log(`[04] Next: node scripts/migration/05-verify.js`);
  } finally {
    await srcPool.end();
    await dstPool.end();
  }
})().catch(e => { console.error('[04] FAILED:', e.message); process.exit(1); });
