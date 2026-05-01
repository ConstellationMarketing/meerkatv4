#!/usr/bin/env node
/**
 * Step 2: Rewrite the source DDL into target-schema DDL ready for master.
 *
 * Pipeline:
 *   - Strip every statement that references a SKIPPED table (8_scoring_dimensions,
 *     webhook_logs, clients, article_outlines_test). pg_dump's structured per-object
 *     comment headers ("-- Name: <obj>; Type: <type>; ...") let us delete entire
 *     CREATE TABLE / ALTER / INDEX / TRIGGER / SEQUENCE blocks cleanly.
 *   - Rewrite "public"."<table>" → "<dest_schema>"."<table>" per SCHEMA_MAP.
 *   - Rewrite "public"."<seq>" → "<dest_schema>"."<seq>" by following each
 *     sequence's `OWNED BY "<schema>"."<table>"` clause back to the owning table.
 *   - Drop the legacy "user ID" column from article_outlines.
 *   - Functions (set_updated_at, log_templates_change) and the folder_type enum
 *     stay in `public` since they're cross-schema-callable; triggers in the new
 *     schemas reference them as public.<fn>().
 *
 * Output: ./out/master-ddl.sql
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { SCHEMA_MAP, SKIP_REASONS, NEW_TABLES, DDL_TRANSFORMS } = require('./config');

const IN = path.join(__dirname, 'out', 'source-ddl.sql');
const OUT = path.join(__dirname, 'out', 'master-ddl.sql');

if (!fs.existsSync(IN)) {
  console.error('Missing source DDL — run 01-extract-source-ddl.js first.');
  process.exit(1);
}

let ddl = fs.readFileSync(IN, 'utf8');

// 1. Strip pg_dump-specific \restrict / \unrestrict directives.
ddl = ddl.replace(/^\\(restrict|unrestrict).*$/gm, '');

// 1b. Drop the `CREATE SCHEMA "public";` line — `public` already exists everywhere.
ddl = ddl.replace(/^CREATE SCHEMA "public";\s*$/gm, '');

// 2. Build table → schema lookup
const tableToSchema = {};
for (const [schema, tables] of Object.entries(SCHEMA_MAP)) {
  for (const t of tables) tableToSchema[t] = schema;
}

// 3. Remove every statement block that references a SKIPPED table.
// pg_dump emits structured headers we can split on:
//   --
//   -- Name: <obj_name>; Type: <obj_type>; Schema: public; ...
//   --
//
//   <body — multi-line until next "--\n" header or EOF>
const skipNames = new Set(Object.keys(SKIP_REASONS));
const blocks = ddl.split(/(?=^--\n-- Name:)/m);
const kept = [];
let stripped = 0;
for (const block of blocks) {
  const m = block.match(/^--\n-- Name: ([^;]+); Type: ([^;]+);/);
  if (!m) {
    kept.push(block);
    continue;
  }
  const [, fullName, objType] = m;
  // Object names are like:
  //   "article_outlines"  (table)
  //   "article_outlines pkey"  (index/constraint - "<table> <constraint_name>")
  //   "article_outlines_id_seq"  (sequence — table name embedded as prefix)
  //   "article_outlines x_set_updated_at"  (trigger — "<table> <trigger_name>")
  // Match against any skipped table appearing as a prefix (word-boundary).
  const tableRef = fullName.split(' ')[0];
  // Skip if the object name *is* a skipped table or *belongs to* one.
  // Cover sequences, indexes, constraints, triggers — all of which have the
  // table name as a prefix (with '_' separator).
  const skip = skipNames.has(tableRef) || [...skipNames].some(t => tableRef.startsWith(t + '_'));
  if (skip) {
    stripped++;
    continue;
  }
  kept.push(block);
}
ddl = kept.join('');
console.log(`[02] Stripped ${stripped} statement blocks for skipped tables: ${[...skipNames].join(', ')}`);

// 4. Rewrite "public"."<table>" → "<schema>"."<table>" for kept tables.
ddl = ddl.replace(/"public"\."([^"]+)"/g, (full, name) => {
  const schema = tableToSchema[name];
  if (!schema) return full;
  return `"${schema}"."${name}"`;
});

// 5. Find sequences and rewrite them to follow their owning table's schema.
// Two ways pg_dump expresses ownership:
//   a) ALTER SEQUENCE "public"."<seq>" OWNED BY "<schema>"."<table>"."<col>";
//   b) ALTER TABLE "<schema>"."<table>" ALTER COLUMN "<col>" ADD GENERATED ... AS IDENTITY (... SEQUENCE NAME "public"."<seq>" ...);
// Build a sequence → target-schema map covering both forms.
const seqToSchema = {};
const ownedByRe = /ALTER SEQUENCE "public"\."([^"]+)" OWNED BY "([^"]+)"\.[^;]+/g;
for (const m of ddl.matchAll(ownedByRe)) {
  const [, seqName, ownerSchema] = m;
  if (ownerSchema && ownerSchema !== 'public') seqToSchema[seqName] = ownerSchema;
}
const identityRe = /ALTER TABLE "([^"]+)"\."[^"]+" ALTER COLUMN "[^"]+" ADD GENERATED[\s\S]*?SEQUENCE NAME "public"\."([^"]+)"/g;
for (const m of ddl.matchAll(identityRe)) {
  const [, ownerSchema, seqName] = m;
  if (ownerSchema && ownerSchema !== 'public') seqToSchema[seqName] = ownerSchema;
}
let seqRewrites = 0;
for (const [seq, schema] of Object.entries(seqToSchema)) {
  const re = new RegExp(`"public"\\."${seq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
  const before = ddl;
  ddl = ddl.replace(re, `"${schema}"."${seq}"`);
  if (ddl !== before) seqRewrites++;
}
console.log(`[02] Rewrote ${seqRewrites} sequences to their owning table's schema`);

// 6. Drop the "user ID" column from article_outlines (consolidating to user_id).
for (const [table, dropCols] of Object.entries(DDL_TRANSFORMS.drop_columns || {})) {
  const schema = tableToSchema[table];
  if (!schema) continue;
  const tableHeader = `CREATE TABLE "${schema}"."${table}"`;
  const start = ddl.indexOf(tableHeader);
  if (start === -1) {
    console.warn(`[02] WARN: ${tableHeader} not found — skipping column drops`);
    continue;
  }
  const end = ddl.indexOf(');', start);
  const before = ddl.slice(0, start);
  const block = ddl.slice(start, end + 2);
  const after = ddl.slice(end + 2);
  let trimmed = block;
  for (const col of dropCols) {
    const escaped = col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\s*"${escaped}"[^\\n]*?\\n`, 'g');
    const next = trimmed.replace(re, '\n');
    if (next !== trimmed) {
      trimmed = next;
      console.log(`[02] dropped column "${col}" from ${schema}.${table}`);
    }
  }
  // Repair the closing parenthesis if the dropped column was last (had no trailing comma)
  trimmed = trimmed.replace(/,(\s*)\);/, '$1);');
  ddl = before + trimmed + after;
}

// 7. Detect any straggling "public"."<table>" refs we didn't rewrite — flag for review.
const stragglers = [...ddl.matchAll(/"public"\."([^"]+)"/g)].map(m => m[1]);
const expected = new Set(['set_updated_at', 'log_templates_change', 'folder_type', 'gen_random_uuid', 'now', 'uuid', 'text', 'jsonb', 'regclass']);
const unexpected = [...new Set(stragglers)].filter(s => !expected.has(s));
if (unexpected.length > 0) {
  console.warn(`[02] WARN: unrewritten public.* refs (review before applying):`, unexpected.join(', '));
}

// 8. Inject NEW_TABLES (public_shares).
let newTableSql = '\n\n-- ─── New tables (no source — created fresh in master) ───────────────\n';
for (const [schema, defs] of Object.entries(NEW_TABLES)) {
  for (const [name, body] of Object.entries(defs)) {
    newTableSql += `-- NEW: ${schema}.${name}\n${body.trim()}\n\n`;
  }
}
ddl += newTableSql;

// 9. Prepend CREATE SCHEMA statements
const schemas = Object.keys(SCHEMA_MAP);
const header = [
  '-- Generated by 02-transform-ddl.js',
  `-- Date: ${new Date().toISOString()}`,
  `-- Source: public schema in fcdotdpzmjbmsxuncfdg (old Meerkat)`,
  `-- Destination: schemas ${schemas.join(', ')} in cwligyakhxevopxiksdm (master)`,
  `-- Skipped tables: ${[...skipNames].join(', ')}`,
  '',
  ...schemas.map(s => `CREATE SCHEMA IF NOT EXISTS "${s}";`),
  '',
  '',
].join('\n');

fs.writeFileSync(OUT, header + ddl);
console.log(`[02] Wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
console.log(`[02] Next: node scripts/migration/03-apply-ddl.js`);
