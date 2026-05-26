'use strict';

// Pure-function tests for the cross-article duplicate detector. Does not
// touch the database (the live-DB path is gated by CROSS_ARTICLE_DUPE_CHECK
// and verified separately on the VPS).

const { findCrossArticleDuplicates, _internals } = require('./lib/cross-article-dupe-check');

const cases = [
  {
    name: 'Verbatim repeated boilerplate flags',
    newHtml: '<p>The firm secured a $34.9 million jury award for its clients in a landmark personal injury case.</p>',
    prior: [{
      keyword: 'Folsom Drunk Driving',
      content: '<p>The firm secured a $34.9 million jury award for its clients in a landmark personal injury case.</p>',
    }],
    expectMatches: 1,
  },
  {
    name: 'Near-duplicate (same content words, different filler) flags',
    newHtml: '<p>The firm secured a $34.9 million jury award for clients in a personal injury case.</p>',
    prior: [{
      keyword: 'Folsom Slip Fall',
      content: '<p>This firm has secured a $34.9 million jury award for its clients in their personal injury case.</p>',
    }],
    expectMatches: 1,
  },
  {
    name: 'Unrelated sentence does not flag',
    newHtml: '<p>California comparative negligence law allocates fault among the parties involved in an accident.</p>',
    prior: [{
      keyword: 'Folsom Truck Accident',
      content: '<p>Pedestrian accidents in Folsom often involve commercial trucks turning right at controlled intersections.</p>',
    }],
    expectMatches: 0,
  },
  {
    name: 'Short sentence (under 8 content tokens) is ignored',
    newHtml: '<p>Contact us today.</p>',
    prior: [{
      keyword: 'Anything',
      content: '<p>Contact us today.</p>',
    }],
    expectMatches: 0,
  },
  {
    name: 'Match against multiple priors counts once per new-article sentence',
    newHtml: '<p>The firm secured a $34.9 million jury award for its clients in a landmark personal injury case.</p>',
    prior: [
      { keyword: 'Folsom A', content: '<p>The firm secured a $34.9 million jury award for its clients in a landmark personal injury case.</p>' },
      { keyword: 'Folsom B', content: '<p>The firm secured a $34.9 million jury award for its clients in a landmark personal injury case.</p>' },
    ],
    expectMatches: 1,
  },
  {
    name: 'Thematic rephrase (~67% token overlap) does NOT flag at 0.85 threshold',
    // Detector is tuned for verbatim / near-verbatim boilerplate (the
    // Dostart $34.9M-style repeat). Thematic rephrases below threshold
    // are out of scope and need a different approach (e.g. embeddings).
    newHtml: '<p>Evidence disappears quickly after a commercial truck crash, which is why early documentation matters so much for injured drivers.</p>',
    prior: [{
      keyword: 'Cargo Securement',
      content: '<p>Evidence disappears quickly after a commercial truck crash, which is why early documentation is essential for injured parties.</p>',
    }],
    expectMatches: 0,
  },
  {
    name: 'Real-world Dostart-style boilerplate fact flags across two articles',
    newHtml: '<p>The firm secured a landmark $34.9 million jury award in a serious personal injury case.</p>',
    prior: [{
      keyword: 'Folsom Tractor Trailer',
      content: '<p>The firm has secured a $34.9 million jury award in a serious personal injury case.</p>',
    }],
    expectMatches: 1,
  },
];

let failed = 0;
for (const c of cases) {
  const warnings = findCrossArticleDuplicates(c.newHtml, c.prior);
  const got = warnings.length;
  if (got !== c.expectMatches) {
    console.error(`FAIL: ${c.name}`);
    console.error(`  expected ${c.expectMatches} match(es), got ${got}`);
    warnings.forEach(w => console.error(`    - ${w}`));
    failed++;
  } else {
    console.log(`PASS: ${c.name}  (${got} match(es))`);
  }
}

// Sanity check on internals
const { extractSentences, jaccard } = _internals;
const sentences = extractSentences('<p>One sentence. Two sentences? Three sentences!</p>');
if (sentences.length !== 3) {
  console.error(`FAIL: extractSentences split — expected 3, got ${sentences.length}: ${JSON.stringify(sentences)}`);
  failed++;
} else {
  console.log('PASS: extractSentences splits on .!?');
}

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${cases.length + 1} tests passed`);
