#!/usr/bin/env node
/**
 * One-shot migration: loosen template section names so they read as topic
 * briefs rather than literal H2 headings. Paired with the prompt change in
 * prompts/section-writer.md (no more verbatim H2 enforcement).
 *
 * Changes:
 *   practice-page
 *     - "CTA / Conclusion" → "CTA"   (slash was being rendered literally as
 *                                     an H2 and rejected by editors 85% of
 *                                     the time in recent batches)
 *
 *   template-1767975904572 (Supporting Page)
 *     - "Introduction" instructions: add language that makes it clear the
 *       section must emit a contextual H2 after the H1+Tagline section.
 *     - "Key Information" / "Additional Context" / "Get Legal Guidance":
 *       clarify in instructions that each section's heading should be a
 *       contextual, topic-specific H2 (editors consistently replace these
 *       with 4-5 contextual sub-topics, so we at least surface the
 *       expectation in the brief).
 *
 * Run with:   node scripts/update-template-section-briefs.js
 * Idempotent — safe to re-run.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const INTRODUCTION_NOTE =
  ' The H2 heading for this section should be a contextual, reader-facing heading that frames the article topic for this specific keyword and jurisdiction — not a generic label like "Introduction".';

const CONTEXTUAL_H2_NOTE =
  ' The H2 heading should be a contextual, reader-facing heading tied to this specific topic — not a generic template label.';

function extendInstructions(section, note) {
  const current = section.instructions || section.details || '';
  if (current.includes(note.trim())) return section; // idempotent
  const next = current ? `${current}${note}` : note.trim();
  return { ...section, instructions: next };
}

async function updateTemplate(id, transform) {
  const { data, error } = await supabase
    .from('templates')
    .select('id, sections')
    .eq('id', id)
    .single();
  if (error) throw new Error(`Fetch ${id}: ${error.message}`);

  const nextSections = transform(Array.isArray(data.sections) ? data.sections : []);

  const { error: updateError } = await supabase
    .from('templates')
    .update({ sections: nextSections })
    .eq('id', id);
  if (updateError) throw new Error(`Update ${id}: ${updateError.message}`);

  return nextSections;
}

(async () => {
  try {
    // practice-page
    const practiceNext = await updateTemplate('practice-page', (sections) =>
      sections.map((s) => {
        const name = s.title || s.name || '';
        if (/^cta\s*\/\s*conclusion$/i.test(name.trim())) {
          return { ...s, title: 'CTA', name: 'CTA' };
        }
        if (/^introduction$/i.test(name.trim())) {
          return extendInstructions(s, INTRODUCTION_NOTE);
        }
        return s;
      }),
    );

    console.log('practice-page sections after update:');
    practiceNext.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.title || s.name}`);
    });

    // supporting page (template-1767975904572)
    const supportingNext = await updateTemplate('template-1767975904572', (sections) =>
      sections.map((s) => {
        const name = (s.title || s.name || '').trim();
        if (/^introduction$/i.test(name)) {
          return extendInstructions(s, INTRODUCTION_NOTE);
        }
        if (/^(key information|additional context|get legal guidance)$/i.test(name)) {
          return extendInstructions(s, CONTEXTUAL_H2_NOTE);
        }
        return s;
      }),
    );

    console.log('\ntemplate-1767975904572 (Supporting) sections after update:');
    supportingNext.forEach((s, i) => {
      const name = s.title || s.name;
      const hasNote = (s.instructions || '').includes(CONTEXTUAL_H2_NOTE.trim()) ||
        (s.instructions || '').includes(INTRODUCTION_NOTE.trim());
      console.log(`  ${i + 1}. ${name}${hasNote ? '  [+ H2 guidance]' : ''}`);
    });

    console.log('\nDone.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
})();
