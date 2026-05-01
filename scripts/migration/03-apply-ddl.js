#!/usr/bin/env node
/**
 * Step 3: Apply the transformed DDL to master.
 *
 *   node scripts/migration/03-apply-ddl.js           — apply (will fail if schemas exist)
 *   node scripts/migration/03-apply-ddl.js --reset   — DROP SCHEMA ... CASCADE first, then apply
 *
 * --reset is destructive: every table we manage in those 5 schemas is dropped.
 * Safe to use during pre-cutover testing because the schemas don't exist in
 * production master yet.
 */
'use strict';

require('dotenv').config();
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { SCHEMA_MAP } = require('./config');

const DDL = path.join(__dirname, 'out', 'master-ddl.sql');
const reset = process.argv.includes('--reset');

if (!process.env.MASTER_PG_URL) { console.error('Missing MASTER_PG_URL in .env'); process.exit(1); }
if (!fs.existsSync(DDL)) { console.error('Missing master-ddl.sql — run 02-transform-ddl.js'); process.exit(1); }

function psql(sqlOrFlag, ...extra) {
  const args = [process.env.MASTER_PG_URL, '-v', 'ON_ERROR_STOP=1', ...extra];
  if (typeof sqlOrFlag === 'string' && !extra.length) args.push('-c', sqlOrFlag);
  else if (Array.isArray(sqlOrFlag)) args.push(...sqlOrFlag);
  const result = spawnSync('psql', args, { encoding: 'utf8' });
  return result;
}

if (reset) {
  console.log(`[03] --reset: dropping schemas ${Object.keys(SCHEMA_MAP).join(', ')}`);
  const drops = [
    ...Object.keys(SCHEMA_MAP).map(s => `DROP SCHEMA IF EXISTS "${s}" CASCADE;`),
    // Also drop the cross-schema helpers we put in public so re-runs don't trip on
    // "already exists". Safe — these are only used by the schemas we just dropped.
    'DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;',
    'DROP FUNCTION IF EXISTS public.log_templates_change() CASCADE;',
    'DROP TYPE IF EXISTS public.folder_type CASCADE;',
  ].join('\n');
  const r = psql(drops);
  if (r.status !== 0) {
    console.error('[03] DROP failed:', r.stderr);
    process.exit(1);
  }
  console.log('[03] schemas + shared helpers dropped');
}

console.log(`[03] Applying ${DDL} to master`);
const apply = spawnSync('psql', [
  process.env.MASTER_PG_URL,
  '-v', 'ON_ERROR_STOP=1',
  '-f', DDL,
], { encoding: 'utf8' });

if (apply.status !== 0) {
  console.error('[03] APPLY FAILED');
  console.error('--- stderr ---');
  console.error(apply.stderr);
  console.error('--- last stdout ---');
  console.error(apply.stdout.slice(-2000));
  process.exit(1);
}

console.log('[03] DDL applied successfully');

// Verify: count tables in each new schema
const verify = spawnSync('psql', [
  process.env.MASTER_PG_URL,
  '-c',
  `SELECT n.nspname as schema, count(*) as tables
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relkind = 'r' AND n.nspname = ANY(ARRAY['${Object.keys(SCHEMA_MAP).join("','")}'])
   GROUP BY n.nspname ORDER BY n.nspname`,
], { encoding: 'utf8' });
console.log(verify.stdout);

console.log(`[03] Next: node scripts/migration/04-copy-data.js`);
