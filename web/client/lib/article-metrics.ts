/**
 * Article Metrics Calculation Utility
 * Automatically calculates word count, Flesch reading score, and generates schema
 */

// ============================================================================
// WORD COUNT
// ============================================================================

export function calculateWordCount(html: string): number {
  if (!html) return 0;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.split(/\s+/).filter(Boolean).length;
}

// ============================================================================
// SENTENCE COUNT
// ============================================================================

function countSentences(html: string): number {
  if (!html) return 0;

  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  // Split by sentence-ending punctuation
  const sentences = text.match(/[.!?]+/g) || [];
  return Math.max(1, sentences.length);
}

// ============================================================================
// SYLLABLE COUNTING
// ============================================================================

function countSyllables(word: string): number {
  word = word.toLowerCase();

  // Remove non-alphabetic characters
  word = word.replace(/[^a-z]/g, "");

  if (word.length <= 3) return 1;

  // Vowel groups (consecutive vowels count as one syllable)
  const vowels = "aeiou";
  let syllableCount = 0;
  let previousWasVowel = false;

  for (let i = 0; i < word.length; i++) {
    const isVowel = vowels.includes(word[i]);

    if (isVowel && !previousWasVowel) {
      syllableCount++;
    }

    previousWasVowel = isVowel;
  }

  // Adjust for silent 'e'
  if (word.endsWith("e")) {
    syllableCount--;
  }

  // Adjust for 'le' at the end
  if (
    word.endsWith("le") &&
    word.length > 2 &&
    !vowels.includes(word[word.length - 3])
  ) {
    syllableCount++;
  }

  // Ensure at least one syllable
  return Math.max(1, syllableCount);
}

function countTotalSyllables(html: string): number {
  if (!html) return 0;

  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = text.split(/\s+/).filter(Boolean);
  return words.reduce((sum, word) => sum + countSyllables(word), 0);
}

// ============================================================================
// FLESCH READING EASE SCORE
// ============================================================================

export interface FleschScore {
  score: number;
  scoreRounded: number;
  readability: string;
}

export function calculateFleschScore(html: string): FleschScore {
  const wordCount = calculateWordCount(html);
  const sentenceCount = countSentences(html);
  const syllableCount = countTotalSyllables(html);

  // Prevent division by zero
  if (wordCount === 0 || sentenceCount === 0) {
    return {
      score: 0,
      scoreRounded: 0,
      readability: "Unknown",
    };
  }

  // Flesch Reading Ease formula:
  // 206.835 - (1.015 × (words / sentences)) - (84.6 × (syllables / words))
  const score =
    206.835 -
    1.015 * (wordCount / sentenceCount) -
    84.6 * (syllableCount / wordCount);

  const scoreRounded = Number(score.toFixed(2));

  // Readability label
  const readability =
    score >= 90
      ? "Very easy (5th grade)"
      : score >= 80
        ? "Easy (6th grade)"
        : score >= 70
          ? "Fairly easy (7th grade)"
          : score >= 60
            ? "Plain English (8th–9th grade)"
            : score >= 50
              ? "Fairly difficult (10th–12th)"
              : score >= 30
                ? "Difficult (college level)"
                : "Very difficult (university level)";

  return {
    score,
    scoreRounded,
    readability,
  };
}

// ============================================================================
// SCHEMA GENERATION
// ============================================================================

export interface SchemaSection {
  title: string;
  wordCount: number;
  subsections?: string[];
}

export interface GeneratedSchema {
  type: string;
  mainHeading: string;
  description: string;
  sections: SchemaSection[];
  wordCount: number;
  estimatedReadTime: number;
}

export function generateSchema(
  html: string,
  keyword: string = "",
): GeneratedSchema {
  if (!html) {
    return {
      type: "Article",
      mainHeading: "Untitled",
      description: "",
      sections: [],
      wordCount: 0,
      estimatedReadTime: 0,
    };
  }

  const wordCount = calculateWordCount(html);
  const estimatedReadTime = Math.ceil(wordCount / 200); // Average 200 words per minute

  // Extract headings (h1, h2, h3) and paragraphs
  const headingRegex = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;

  const sections: SchemaSection[] = [];
  let currentSection: SchemaSection | null = null;
  const subsectionsList: string[] = [];

  let headingMatch;
  let paragraphCount = 0;

  // Extract main heading (first h1) and description (first paragraph)
  let mainHeading = keyword || "Article";
  let description = "";

  const firstParagraphMatch = paragraphRegex.exec(html);
  if (firstParagraphMatch) {
    const paragraphText = extractTextFromHtml(firstParagraphMatch[1]).trim();
    description = paragraphText.substring(0, 200); // First 200 characters
  }

  const firstHeadingMatch = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (firstHeadingMatch) {
    mainHeading =
      extractTextFromHtml(firstHeadingMatch[1]).trim() || mainHeading;
  }

  // Extract sections from h2 headings
  while ((headingMatch = headingRegex.exec(html)) !== null) {
    const headingLevel = parseInt(headingMatch[1]);
    const headingText = extractTextFromHtml(headingMatch[2]).trim();

    if (headingLevel === 2) {
      // Save previous section
      if (currentSection) {
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        title: headingText,
        wordCount: 0,
        subsections: [],
      };
      subsectionsList.length = 0;
      paragraphCount = 0;
    } else if (headingLevel === 3 && currentSection) {
      // Add subsection to current section
      subsectionsList.push(headingText);
      if (currentSection.subsections) {
        currentSection.subsections = subsectionsList;
      }
    }
  }

  // Save last section
  if (currentSection) {
    sections.push(currentSection);
  }

  // Estimate word count per section (distribute equally if no clear boundaries)
  const wordCountPerSection =
    sections.length > 0 ? Math.floor(wordCount / sections.length) : wordCount;
  sections.forEach((section) => {
    section.wordCount = wordCountPerSection;
  });

  return {
    type: "Article",
    mainHeading,
    description,
    sections,
    wordCount,
    estimatedReadTime,
  };
}

// ============================================================================
// HELPER FUNCTION
// ============================================================================

function extractTextFromHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
