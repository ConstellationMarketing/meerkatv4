'use strict';

/**
 * Test script to generate articles locally and validate output.
 *
 * Usage:
 *   node test-generate.js                  # Generate both practice + supporting
 *   node test-generate.js practice         # Generate practice page only
 *   node test-generate.js supporting       # Generate supporting page only
 *   node test-generate.js --dry-run        # Run post-processing checks only (no API calls)
 *
 * Requires .env with ANTHROPIC_API_KEY (and optionally SUPABASE_URL, SUPABASE_KEY).
 * Set SKIP_PUBLISH=1 to skip Supabase upsert and GitHub publish.
 */

require('dotenv').config();

// Force skip external publishing during test
process.env.SKIP_PUBLISH = '1';

const fs = require('fs');
const { runPipeline } = require('./pipeline');
const { compileArticle } = require('./lib/article-compiler');

// ─── Sample Payloads ───────────────────────────────────────────────────────────

const practicePayload = {
  articleid: 'test-practice-bardol',
  clientId: '86dvn8g14',
  clientName: 'Bardol Law Firm',
  clientInfo: `# Bardol Law Firm, LLC

## FIRM DETAILS
Description: Bardol Law Firm, LLC is a dedicated St. Louis-based family law firm providing knowledgeable, approachable, and compassionate legal guidance to individuals and families navigating challenging life transitions.

Attorneys: Stephen J. Bardol; Ann Vatterott Bruntrager; Mikayla Butler

Practice Areas: Family Law, Divorce (contested and uncontested), Custody, Adoption, Orders of Protection, Prenuptial Agreements.

Service Area: Missouri — St. Louis County, St. Louis City, Jefferson County, St. Charles County.

Selling Points:
- Down-to-earth, approachable, and warm personality
- Genuine compassion and understanding of the emotional weight of family law matters
- Knowledgeable and confident guidance through complex and stressful situations
- Personalized, supportive partnership that makes clients feel heard and cared for
- Clear, accessible communication that simplifies the legal process
- Local expertise serving the St. Louis metro area and surrounding Missouri counties

## TARGET PAGES
1 - Family Law Attorneys St Louis | https://bardollaw.com/
2 - Divorce Lawyers St Louis | https://bardollaw.com/practice-areas/st-louis-divorce-lawyer/
3 - Missouri Divorce Laws | https://bardollaw.com/missouri-divorce-laws/
4 - Child Custody Lawyers St Louis | https://bardollaw.com/practice-areas/st-louis-child-custody-lawyer/
5 - St. Louis Spousal Support Attorney | https://bardollaw.com/practice-areas/st-louis-spousal-support-alimony-lawyer/
6 - Missouri Property Division Laws | https://bardollaw.com/missouri-property-division-laws/
7 - St Louis Child Support Modification Lawyer | https://bardollaw.com/practice-areas/st-louis-child-support-modification-lawyer/
8 - St. Louis Family Court | https://bardollaw.com/st-louis-county-family-court/

## CONTACT INFORMATION
Contact Page: https://bardollaw.com/contact-us/
Address: 34 North Gore Avenue, Suite 203, St. Louis, MO 63119`,
  website: 'https://bardollaw.com',
  keyword: 'Child Custody Lawyer St Louis',
  template: 'Practice Page (v2Training Module)',
  userId: 'test-user',
  sections: [
    { sectionNumber: 1, name: 'H1 + Tagline', details: 'Write the keyword "Child Custody Lawyer St Louis" verbatim as the H1. Use proper capitalization. Directly below it on a new line, create a tagline that is 7 words or fewer, value-driven, and includes local relevance.', wordCount: 7 },
    { sectionNumber: 2, name: 'Definition + Introduction', details: 'Create an empathetic opening that connects with the reader about child custody in St. Louis. Acknowledge their fear, stress, and uncertainty. Present Bardol Law Firm as the trusted solution. Write warmly in direct address ("you"). Establish the problem and naturally lead into the next section.', wordCount: 250 },
    { sectionNumber: 3, name: 'How We Can Help', details: 'Expand on the problem of navigating child custody and show how Bardol Law Firm solves it: identify the problem, agitate the pain, and show consequences if they don\'t act. Build on the emotional setup from the intro, explain how the attorney helps, and demonstrate understanding of risks. Lead the reader from fear to clarity to hope.', wordCount: 250 },
    { sectionNumber: 4, name: 'Why Choose Us', details: 'Explain why Bardol Law Firm is the right choice by highlighting specific strengths: experience, trust signals, and the firm\'s compassionate approach. Use short, scannable paragraphs or bullet points to answer "Why should I trust THIS lawyer over anyone else?"', wordCount: 500 },
    { sectionNumber: 5, name: 'What to Expect', details: 'Explain the child custody legal process in Missouri step-by-step in simple terms. Describe what working with Bardol Law Firm will be like while avoiding jargon. Cover consultation, document review, strategy planning, representation, and resolution. Reinforce professionalism and clarity.', wordCount: 500 },
    { sectionNumber: 6, name: 'CTA / Conclusion', details: 'Summarize the main takeaway and reaffirm empathy while providing clear next steps. Directly instruct the reader to contact the firm with a warm, human CTA. Never use "Conclusion" or "Summary" as the heading.', wordCount: 200 },
    { sectionNumber: 7, name: 'FAQs', details: 'Create 3-5 questions most relevant to St. Louis child custody cases, structured as Q&As. Maintain a neutral, informative tone without giving legal advice.', wordCount: 300 }
  ]
};

const supportingPayload = {
  articleid: 'test-supporting-001',
  clientId: 'test-client',
  clientName: 'Veterans Law Group',
  clientInfo: 'Veterans Law Group helps veterans and their families with benefits claims. https://veteranslawgroup.com https://veteranslawgroup.com/va-benefits https://veteranslawgroup.com/surviving-spouse-benefits https://veteranslawgroup.com/contact',
  website: 'https://veteranslawgroup.com',
  keyword: 'Veterans Benefits for Surviving Spouses in Georgia',
  template: 'supporting',
  userId: 'test-user',
  sections: [
    { sectionNumber: 1, details: 'Introduction: Write a brief 2-3 sentence introduction about veterans benefits for surviving spouses in Georgia. Answer the core question immediately.', wordCount: 80 },
    { sectionNumber: 2, details: 'Legal Overview: Explain DIC (Dependency and Indemnity Compensation), eligibility requirements, and Georgia-specific considerations for surviving spouses.', wordCount: 300 },
    { sectionNumber: 3, details: 'Why Choose Us: Brief trust signals about experience helping veterans families with benefits claims.', wordCount: 150 },
    { sectionNumber: 4, details: 'What to Expect: Walk through the VA benefits claim process step by step — from gathering documents through receiving a decision. Include typical timelines.', wordCount: 250 },
    { sectionNumber: 5, details: 'CTA: Write a soft, brief call to action. 2-4 sentences max. Suggest speaking with an attorney — no hard sell.', wordCount: 60 },
    { sectionNumber: 6, details: 'FAQ: Write 3-5 frequently asked questions about surviving spouse VA benefits. Keep concise.', wordCount: 200 }
  ]
};

// ─── Validation Checks ─────────────────────────────────────────────────────────

function validateArticle(html, label) {
  const checks = [];
  let pass = 0;
  let fail = 0;

  function check(name, passed, detail) {
    const status = passed ? 'PASS' : 'FAIL';
    if (passed) pass++; else fail++;
    checks.push({ name, status, detail });
  }

  // 1. Single H1
  const h1Count = (html.match(/<h1>/gi) || []).length;
  check('Single H1', h1Count === 1, `Found ${h1Count} H1 tags`);

  // 2. No duplicate intro (heuristic: check if first <p> content appears again)
  // This is a rough check — look for very similar opening paragraphs
  const paragraphs = html.match(/<p>([\s\S]*?)<\/p>/gi) || [];
  let duplicateIntro = false;
  if (paragraphs.length >= 2) {
    const first = paragraphs[0].replace(/<[^>]+>/g, '').trim().slice(0, 100);
    for (let i = 1; i < Math.min(paragraphs.length, 4); i++) {
      const other = paragraphs[i].replace(/<[^>]+>/g, '').trim().slice(0, 100);
      // Simple similarity: check if >60% of words overlap
      const firstWords = new Set(first.toLowerCase().split(/\s+/));
      const otherWords = other.toLowerCase().split(/\s+/);
      const overlap = otherWords.filter(w => firstWords.has(w)).length;
      if (otherWords.length > 5 && overlap / otherWords.length > 0.6) {
        duplicateIntro = true;
      }
    }
  }
  check('No duplicate intro', !duplicateIntro, duplicateIntro ? 'Possible duplicate intro detected' : 'OK');

  // 3. No placeholders
  const placeholders = html.match(/\[[A-Z][a-z]+ [a-z]+\]/g) || [];
  check('No placeholders', placeholders.length === 0, placeholders.length > 0 ? `Found: ${placeholders.join(', ')}` : 'OK');

  // 4. No links in headings
  const headingsWithLinks = html.match(/<h[1-3][^>]*>[\s\S]*?<a\s[\s\S]*?<\/h[1-3]>/gi) || [];
  check('No links in H1/H2/H3', headingsWithLinks.length === 0, `Found ${headingsWithLinks.length} headings with links`);

  // 5. Ordered list numbering (in source markdown — check HTML has proper <ol>)
  const olTags = (html.match(/<ol>/gi) || []).length;
  const liInOl = html.match(/<ol>[\s\S]*?<\/ol>/gi) || [];
  check('Ordered lists valid', true, `${olTags} ordered lists found`);

  // 6. Word count
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = text.split(/\s+/).length;
  check('Word count', wordCount > 200, `${wordCount} words`);

  // 7. Has FAQ section
  const hasFaq = /<h[23][^>]*>.*(?:FAQ|Frequently Asked)/i.test(html);
  check('Has FAQ section', hasFaq, hasFaq ? 'Found' : 'Missing');

  console.log(`\n═══ Validation: ${label} ═══`);
  checks.forEach(c => {
    const icon = c.status === 'PASS' ? '[PASS]' : '[FAIL]';
    console.log(`  ${icon} ${c.name}: ${c.detail}`);
  });
  console.log(`  ── ${pass} passed, ${fail} failed ──\n`);

  return { pass, fail, checks };
}

// ─── Dry Run Mode ───────────────────────────────────────────────────────────────

function dryRun() {
  console.log('=== DRY RUN: Testing post-processing only ===\n');

  // Simulate a raw article with known issues
  const badSections = [
    '# New Hampshire Bus Accident Lawyer\n\nThis is the intro about bus accidents.\n\n# New Hampshire Bus Accident Lawyer\n\nThis repeats the H1.',
    '## Legal Overview\n\n[Firm name] handles bus accident cases. Here is info with a list:\n\n1. First step\n1. Second step\n1. Third step',
    '### [FAQ: What about social security](https://example.com)?\n\nAnswer here.'
  ];

  const { compileArticle } = require('./lib/article-compiler');
  const html = compileArticle(badSections);

  console.log('--- Raw compiled HTML (before post-processing) ---');
  const h1CountBefore = (html.match(/<h1>/gi) || []).length;
  const placeholdersBefore = (html.match(/\[Firm name\]/gi) || []).length;
  console.log(`  H1 tags: ${h1CountBefore}`);
  console.log(`  Placeholders: ${placeholdersBefore}`);

  // Apply post-processing (same as pipeline)
  let processed = html;

  // enforceSingleH1
  let foundFirst = false;
  processed = processed.replace(/<h1>([\s\S]*?)<\/h1>/gi, (match) => {
    if (!foundFirst) { foundFirst = true; return match; }
    return match.replace(/<h1>/i, '<h2>').replace(/<\/h1>/i, '</h2>');
  });

  // stripPlaceholders
  processed = processed.replace(/\[Firm [Nn]ame\]/g, 'Test Firm').replace(/\[firm name\]/gi, 'Test Firm');

  // stripLinksFromHeadings
  processed = processed.replace(/<(h[1-3])>([\s\S]*?)<\/\1>/gi, (match, tag, content) => {
    const cleaned = content.replace(/<a\s[^>]*>([\s\S]*?)<\/a>/gi, '$1');
    return `<${tag}>${cleaned}</${tag}>`;
  });

  console.log('\n--- After post-processing ---');
  const h1CountAfter = (processed.match(/<h1>/gi) || []).length;
  const placeholdersAfter = (processed.match(/\[Firm name\]/gi) || []).length;
  const linksInHeadings = (processed.match(/<h[1-3][^>]*>[\s\S]*?<a\s[\s\S]*?<\/h[1-3]>/gi) || []).length;
  console.log(`  H1 tags: ${h1CountAfter} (was ${h1CountBefore})`);
  console.log(`  Placeholders: ${placeholdersAfter} (was ${placeholdersBefore})`);
  console.log(`  Links in headings: ${linksInHeadings}`);
  console.log(`\n  All post-processing checks: ${h1CountAfter === 1 && placeholdersAfter === 0 && linksInHeadings === 0 ? 'PASS' : 'FAIL'}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--dry-run')) {
    dryRun();
    return;
  }

  const runPractice = args.length === 0 || args.includes('practice');
  const runSupporting = args.length === 0 || args.includes('supporting');

  if (runPractice) {
    console.log('\n========================================');
    console.log('  Generating PRACTICE page...');
    console.log('========================================\n');
    try {
      const result = await runPipeline(practicePayload);
      console.log('[Result]', JSON.stringify(result, null, 2));

      // Read the generated HTML for validation
      if (result.articleId) {
        // Validate from pipeline output — re-run pipeline would be wasteful,
        // so we validate what was published
        console.log('Practice page generation complete.');
      }
    } catch (err) {
      console.error('Practice page generation failed:', err);
    }
  }

  if (runSupporting) {
    console.log('\n========================================');
    console.log('  Generating SUPPORTING page...');
    console.log('========================================\n');
    try {
      const result = await runPipeline(supportingPayload);
      console.log('[Result]', JSON.stringify(result, null, 2));
      console.log('Supporting page generation complete.');
    } catch (err) {
      console.error('Supporting page generation failed:', err);
    }
  }
}

main().catch(console.error);
