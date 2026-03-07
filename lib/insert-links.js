'use strict';

// Ported verbatim from n8n "Insert Authority Links" code node

/**
 * Insert hyperlinks into HTML content.
 * @param {string} htmlContent - The HTML article
 * @param {Array<{term: string, url: string, source: string, context: string}>} references
 * @returns {{ htmlContent: string, referencesAdded: number, references: Array }}
 */
function insertLinks(htmlContent, references) {
  if (!Array.isArray(references) || references.length === 0) {
    return { htmlContent, referencesAdded: 0, references: [] };
  }

  let enrichedHTML = htmlContent;
  const addedReferences = [];

  references.forEach((ref, index) => {
    if (!ref.term || !ref.url) return;

    const escapedTerm = ref.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'i');

    const match = regex.exec(enrichedHTML);
    if (!match) return;

    enrichedHTML =
      enrichedHTML.slice(0, match.index) +
      `<a href="${ref.url}" class="legal-reference" target="_blank" rel="noopener">${match[0]}</a>` +
      enrichedHTML.slice(match.index + match[0].length);

    addedReferences.push({
      number: index + 1,
      term: ref.term,
      url: ref.url,
      source: ref.source,
      context: ref.context
    });
  });

  return {
    htmlContent: enrichedHTML,
    referencesAdded: addedReferences.length,
    references: addedReferences
  };
}

module.exports = { insertLinks };
