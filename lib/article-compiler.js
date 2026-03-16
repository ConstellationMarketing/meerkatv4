'use strict';

// Ported verbatim from n8n "Article Compiler" code node
const unescapeContent = (text) => {
  if (!text) return '';

  let unescaped = text;
  let previousText;
  let iterations = 0;

  do {
    previousText = unescaped;
    unescaped = unescaped
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\\\/g, '\\');
    iterations++;
  } while (previousText !== unescaped && iterations < 5);

  return unescaped;
};

const convertToHTML = (text) => {
  if (!text) return '';

  text = unescapeContent(text);

  // Normalize spacing
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/\n\s*[*-]\s*\n/g, '\n');

  // Markdown links
  text = text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>'
  );

  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic (single asterisks)
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  const blocks = text.split('\n\n').filter(b => b.trim());

  return blocks.map(block => {
    const trimmed = block.trim();

    // Headings
    if (trimmed.startsWith('###')) {
      return '<h3>' + trimmed.replace(/^###\s*/, '') + '</h3>';
    }
    if (trimmed.startsWith('##')) {
      return '<h2>' + trimmed.replace(/^##\s*/, '') + '</h2>';
    }
    if (trimmed.startsWith('#')) {
      return '<h1>' + trimmed.replace(/^#\s*/, '') + '</h1>';
    }

    const lines = trimmed.split('\n');

    // Unordered list
    if (lines.every(l => l.trim().match(/^[-*]\s+/))) {
      return (
        '<ul>\n' +
        lines
          .map(l => '<li>' + l.replace(/^[-*]\s*/, '') + '</li>')
          .join('\n') +
        '\n</ul>'
      );
    }

    // Ordered list
    if (lines.every(l => l.trim().match(/^\d+\.\s+/))) {
      return (
        '<ol>\n' +
        lines
          .map(l => '<li>' + l.replace(/^\d+\.\s*/, '') + '</li>')
          .join('\n') +
        '\n</ol>'
      );
    }

    // Paragraph
    return '<p>' + lines.join('<br>\n') + '</p>';
  }).join('\n\n');
};

/**
 * Compile an array of section text outputs into a single HTML article.
 * @param {string[]} sectionOutputs - Raw text output from each section agent
 * @returns {string} Complete HTML article
 */
function compileArticle(sectionOutputs) {
  const htmlSections = sectionOutputs
    .map(content => convertToHTML(content))
    .join('\n\n');

  return '<article class="legal-content">\n' + htmlSections + '\n</article>';
}

module.exports = { compileArticle, convertToHTML };
