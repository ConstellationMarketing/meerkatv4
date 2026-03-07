'use strict';

// Ported verbatim from n8n "scoring" code node

function countSyllables(word) {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;

  word = word.replace(/[^a-z]/g, '');

  const syllableMatches = word.match(/[aeiouy]+/g);
  let count = syllableMatches ? syllableMatches.length : 0;

  if (word.endsWith('e')) count--;

  return count > 0 ? count : 1;
}

/**
 * Calculate Flesch Reading Ease score and word count for HTML content.
 * @param {string} htmlContent
 * @returns {{ wordCount: number, sentenceCount: number, syllableCount: number, fleschScore: string }}
 */
function scoreArticle(htmlContent) {
  // Strip HTML tags
  const text = htmlContent
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Count words
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Count sentences
  const sentenceCount = (text.match(/[.!?]+/g) || []).length || 1;

  // Count syllables
  let syllableCount = 0;
  for (const w of words) {
    syllableCount += countSyllables(w);
  }

  // Flesch Score
  const score =
    206.835 -
    (1.015 * (wordCount / sentenceCount)) -
    (84.6 * (syllableCount / wordCount));

  const scoreRounded = Number(score.toFixed(2));

  const readability =
    score >= 90 ? 'Very easy (5th grade)' :
    score >= 80 ? 'Easy (6th grade)' :
    score >= 70 ? 'Fairly easy (7th grade)' :
    score >= 60 ? 'Plain English (8th–9th grade)' :
    score >= 50 ? 'Fairly difficult (10th–12th)' :
    score >= 30 ? 'Difficult (college level)' :
    'Very difficult (university level)';

  return {
    wordCount,
    sentenceCount,
    syllableCount,
    fleschScore: `${scoreRounded} - ${readability}`,
    rawScore: scoreRounded
  };
}

module.exports = { scoreArticle };
