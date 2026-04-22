#!/usr/bin/env node
/**
 * One-shot migration: tighten the Supporting Page template (template-1767975904572)
 * section briefs so that each body section has a distinct topical focus. Before
 * this change, "Key Information", "Additional Context", and "Get Legal Guidance"
 * all carried the same generic H2-guidance note, which caused recent test
 * generations to produce near-duplicate H2s ("Your Next Steps…" and "Your Next
 * Step…") and overlapping content across sections.
 *
 * Differentiation after this migration:
 *   - Key Information  → core substantive answer to the keyword
 *   - Additional Context → adjacent nuance / related considerations (must not
 *                          repeat Key Information)
 *   - Get Legal Guidance → soft CTA only (supporting pages); no firm promotion
 *                           in body sections
 *
 * Run with:   node scripts/tighten-supporting-briefs.js
 * Idempotent — writes fresh instructions each run but only flips if content differs.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const TEMPLATE_ID = 'template-1767975904572';

const BRIEFS = {
  Introduction:
    'Frame the article for the reader: what the topic is, who this matters to, and what the reader will get out of reading it. Do NOT preview later sections as a table of contents. The H2 heading must be a contextual, reader-facing heading that reflects this specific keyword and jurisdiction — not a generic label like "Introduction".',

  'Key Information':
    'This is the core substantive answer to the keyword question. Cover the primary facts, legal rules, definitions, or steps that a reader searching this keyword is looking for. Go deep on the central topic — do NOT drift into peripheral scenarios or related-but-distinct issues (those belong in Additional Context). The H2 heading must directly address the primary question of the article and must be clearly different from the Introduction H2.',

  'Additional Context':
    'Add depth beyond the core answer given in the previous "Key Information" section. Cover adjacent considerations: common complications, edge cases, jurisdictional nuances, how this interacts with related legal concepts, or scenarios where the standard answer shifts. You MUST NOT repeat points already made in Key Information — build on that section, do not restate it. The H2 heading must reflect the specific angle or nuance this section covers and must be clearly distinct from every other H2 in the article.',

  'Get Legal Guidance':
    'Soft CTA only. 2–4 sentences, 50–70 words total. Suggest speaking with an attorney about the topic — do NOT hard-sell, do NOT say "call now" or "schedule a free consultation", and do NOT promote the firm aggressively. Per supporting-page rules, this is the only section where the firm name may appear. The H2 heading should be a natural prompt to seek guidance (e.g., "When to Speak With an Attorney About [Topic]"), not the literal phrase "Get Legal Guidance".',
};

(async () => {
  try {
    const { data, error } = await supabase
      .from('templates')
      .select('id, sections')
      .eq('id', TEMPLATE_ID)
      .single();
    if (error) throw new Error(`Fetch: ${error.message}`);

    const updated = (data.sections || []).map((s) => {
      const name = (s.title || s.name || '').trim();
      const brief = BRIEFS[name];
      if (!brief) return s;
      if ((s.instructions || '') === brief) return s; // idempotent
      return { ...s, instructions: brief };
    });

    const changed = updated.some((s, i) => (s.instructions || '') !== (data.sections[i].instructions || ''));
    if (!changed) {
      console.log('No changes needed — briefs already current.');
      return;
    }

    const { error: updateError } = await supabase
      .from('templates')
      .update({ sections: updated })
      .eq('id', TEMPLATE_ID);
    if (updateError) throw new Error(`Update: ${updateError.message}`);

    console.log(`${TEMPLATE_ID} sections after update:`);
    updated.forEach((s, i) => {
      const name = s.title || s.name;
      const changed = (s.instructions || '') !== (data.sections[i].instructions || '');
      console.log(`  ${i + 1}. ${name}${changed ? '  [brief updated]' : ''}`);
    });
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
})();
