#!/usr/bin/env node
/**
 * Restore a template row from templates_history.
 *
 * Use cases:
 *   - A template got accidentally deleted. Find the most recent snapshot in
 *     history and restore it.
 *   - A template got corrupted by a bad UPDATE. Roll it back to the previous
 *     state.
 *
 * Usage:
 *   node scripts/restore-template.js --list
 *     List every distinct template_id that has history (good for "what got
 *     deleted recently?").
 *
 *   node scripts/restore-template.js --template-id supporting-page
 *     Show the most recent history entry for that template_id (dry run —
 *     does NOT modify anything).
 *
 *   node scripts/restore-template.js --template-id supporting-page --commit
 *     Actually upsert the template back into the templates table from its
 *     most recent history snapshot.
 *
 *   node scripts/restore-template.js --template-id supporting-page --at "2026-04-29T15:00:00Z"
 *     Use the most recent snapshot AT OR BEFORE the given timestamp (ISO 8601
 *     UTC). Useful for restoring to a specific point before a known-bad event.
 *     Add --commit to actually write.
 *
 * Requires SUPABASE_URL and SUPABASE_KEY in the environment (service role).
 */
'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true);
};

const list = args.includes('--list');
const commit = args.includes('--commit');
const templateId = flag('--template-id');
const atArg = flag('--at');

async function listHistory() {
  // Distinct templates in history with their most recent change.
  const { data, error } = await supabase
    .from('templates_history')
    .select('template_id, operation, changed_at, changed_by')
    .order('changed_at', { ascending: false });
  if (error) throw error;

  const seen = new Map();
  for (const row of data || []) {
    if (!seen.has(row.template_id)) seen.set(row.template_id, row);
  }

  if (seen.size === 0) {
    console.log('No history entries found.');
    return;
  }

  console.log(`\nDistinct template_ids in history (most-recent change shown):`);
  console.log(`${'template_id'.padEnd(30)}  ${'operation'.padEnd(10)}  changed_at`);
  console.log('-'.repeat(80));
  for (const row of seen.values()) {
    console.log(`${row.template_id.padEnd(30)}  ${row.operation.padEnd(10)}  ${row.changed_at}`);
  }
}

async function findSnapshot(id, beforeTimestamp) {
  let query = supabase
    .from('templates_history')
    .select('*')
    .eq('template_id', id)
    .order('changed_at', { ascending: false })
    .limit(1);

  if (beforeTimestamp) {
    query = query.lte('changed_at', beforeTimestamp);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data && data[0] ? data[0] : null;
}

async function checkExists(id) {
  const { data, error } = await supabase
    .from('templates')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function restore(id, atTimestamp, doCommit) {
  const snapshot = await findSnapshot(id, atTimestamp);
  if (!snapshot) {
    console.log(`No history snapshot found for template_id="${id}"${atTimestamp ? ` at or before ${atTimestamp}` : ''}.`);
    return;
  }

  console.log(`\n--- Snapshot found ---`);
  console.log(`  history.id:    ${snapshot.id}`);
  console.log(`  template_id:   ${snapshot.template_id}`);
  console.log(`  operation:     ${snapshot.operation}`);
  console.log(`  changed_at:    ${snapshot.changed_at}`);
  console.log(`  changed_by:    ${snapshot.changed_by || '(null)'}`);

  const row = snapshot.row_data;
  console.log(`\n--- Row data to be restored ---`);
  console.log(`  id:            ${row.id}`);
  console.log(`  name:          ${row.name}`);
  console.log(`  description:   ${(row.description || '').slice(0, 80)}`);
  console.log(`  sections:      ${Array.isArray(row.sections) ? row.sections.length : '?'} sections`);
  if (Array.isArray(row.sections)) {
    row.sections.forEach((s, i) => {
      console.log(`    ${i + 1}. ${s.title || s.name || '?'}`);
    });
  }

  const exists = await checkExists(id);
  console.log(`\n--- Restore plan ---`);
  console.log(`  templates row currently exists: ${exists ? 'YES (will UPDATE)' : 'NO (will INSERT)'}`);

  if (!doCommit) {
    console.log(`\nDry run — no changes made. Re-run with --commit to apply.`);
    return;
  }

  // Build payload for upsert. Only the fields we want to restore.
  const payload = {
    id: row.id,
    name: row.name,
    description: row.description,
    sections: row.sections,
    user_id: row.user_id ?? null,
  };

  const { error } = await supabase
    .from('templates')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error(`\nRestore failed:`, error);
    process.exit(1);
  }

  console.log(`\nRestored template_id="${id}" from history snapshot ${snapshot.id} (changed_at ${snapshot.changed_at}).`);
}

(async () => {
  try {
    if (list) {
      await listHistory();
      return;
    }
    if (!templateId) {
      console.error('Usage:');
      console.error('  node scripts/restore-template.js --list');
      console.error('  node scripts/restore-template.js --template-id <id> [--at <ISO timestamp>] [--commit]');
      process.exit(2);
    }
    await restore(templateId, atArg && atArg !== true ? atArg : null, commit);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
