'use strict';

// Ported verbatim from n8n "Insert Legal Compliance Changes" code node

/**
 * Apply compliance violation replacements to HTML.
 * @param {string} htmlContent
 * @param {{ violations: Array<{term: string, replacement: string}>, total: number }} complianceResult
 * @returns {{ htmlContent: string, changesApplied: number, changes: Array }}
 */
function applyCompliance(htmlContent, complianceResult) {
  if (!complianceResult || !complianceResult.violations || complianceResult.violations.length === 0) {
    return { htmlContent, changesApplied: 0, changes: [] };
  }

  let correctedHTML = htmlContent;
  const appliedChanges = [];

  complianceResult.violations.forEach((violation, index) => {
    const original = violation.term;
    const replacement = violation.replacement;

    if (!original || !replacement) return;

    const actualReplacement = replacement === '[REMOVE]' ? '' : replacement;
    const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedOriginal}\\b`, 'gi');

    if (regex.test(correctedHTML)) {
      regex.lastIndex = 0;
      correctedHTML = correctedHTML.replace(regex, actualReplacement);

      appliedChanges.push({
        number: index + 1,
        original,
        replacement: actualReplacement || '[REMOVED]',
        category: violation.category,
        excerpt: violation.excerpt
      });
    }
  });

  return {
    htmlContent: correctedHTML,
    changesApplied: appliedChanges.length,
    changes: appliedChanges
  };
}

module.exports = { applyCompliance };
