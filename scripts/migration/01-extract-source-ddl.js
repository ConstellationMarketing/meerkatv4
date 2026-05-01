#!/usr/bin/env node
/**
 * Step 1: Dump schema-only DDL for every in-scope table from old Meerkat.
 *
 * Output: ./out/source-ddl.sql — raw pg_dump output (still references public.<table>;
 * step 02 transforms schema names).
 *
 * Run: `node scripts/migration/01-extract-source-ddl.js`
 *
 * Requires MEERKAT_PG_URL in .env.
 */
'use strict';

require('dotenv').config();
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out', 'source-ddl.sql');

if (!process.env.MEERKAT_PG_URL) {
  console.error('Missing MEERKAT_PG_URL in .env');
  process.exit(1);
}

// Dump the entire public schema (not --table filtered) so we pick up trigger functions,
// custom types, and sequences along with the tables. The transform step (02) then
// strips out tables we deliberately skip and rewrites kept tables into their
// destination schemas.
const args = [
  '--schema-only',
  '--schema=public',
  '--no-owner',
  '--no-privileges',
  '--no-publications',
  '--no-subscriptions',
  '--no-comments',           // Avoid pg_dump emitting comments that reference roles
  '--quote-all-identifiers', // Survive odd table/column names like "user ID"
];
args.push(process.env.MEERKAT_PG_URL);

console.log(`[01] Dumping full public schema → ${OUT}`);

const result = spawnSync('pg_dump', args, { encoding: 'utf8' });
if (result.status !== 0) {
  console.error('pg_dump failed:', result.stderr);
  process.exit(1);
}

// New tables (e.g., public_shares) are added in step 02, not here — keep this output
// purely the raw source dump.
fs.writeFileSync(OUT, result.stdout);
const lines = result.stdout.split('\n').length;
console.log(`[01] Wrote ${lines} lines (${(result.stdout.length / 1024).toFixed(1)} KB)`);
console.log(`[01] Next: node scripts/migration/02-transform-ddl.js`);
