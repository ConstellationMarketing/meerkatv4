/**
 * Utility functions for safely parsing and handling the received_article JSON
 * from the Supabase article_outlines table.
 *
 * The received_article column contains:
 * {
 *   content: string (HTML content of the article),
 *   title?: string (SEO title),
 *   meta?: string (meta description),
 *   receivedAt?: string (ISO timestamp)
 * }
 */

export interface ReceivedArticle {
  content: string;
  title?: string | null;
  meta?: string | null;
  receivedAt?: string;
}

/**
 * Parse received_article JSON safely
 * Handles both string and object inputs
 */
export function parseReceivedArticle(data: any): ReceivedArticle | null {
  if (!data) return null;

  try {
    // If it's already an object, return it
    if (typeof data === "object" && data.content !== undefined) {
      return {
        content: String(data.content),
        title: data.title || null,
        meta: data.meta || null,
        receivedAt: data.receivedAt,
      };
    }

    // If it's a string, try to parse it as JSON
    if (typeof data === "string") {
      const parsed = JSON.parse(data);
      if (parsed.content) {
        return {
          content: String(parsed.content),
          title: parsed.title || null,
          meta: parsed.meta || null,
          receivedAt: parsed.receivedAt,
        };
      }
    }

    console.warn(
      "Invalid received_article format:",
      typeof data,
      data.constructor?.name,
    );
    return null;
  } catch (error) {
    console.error("Error parsing received_article JSON:", error);
    return null;
  }
}

/**
 * Check if a received_article has valid content
 */
export function hasValidContent(article: any): boolean {
  if (!article) return false;
  return typeof article.content === "string" && article.content.length > 0;
}

/**
 * Get the article content as HTML string
 */
export function getArticleContent(article: any): string {
  if (!article) return "";
  return (article.content as string) || "";
}

/**
 * Get the article title
 */
export function getArticleTitle(article: any): string | null {
  if (!article) return null;
  return (article.title as string) || null;
}

/**
 * Get the article meta description
 */
export function getArticleMeta(article: any): string | null {
  if (!article) return null;
  return (article.meta as string) || null;
}

/**
 * Get the timestamp when article was received
 */
export function getArticleReceivedAt(article: any): Date | null {
  if (!article || !article.receivedAt) return null;
  try {
    return new Date(article.receivedAt);
  } catch {
    return null;
  }
}

/**
 * Format the article data for display
 */
export function formatArticleForDisplay(article: any) {
  const parsed = parseReceivedArticle(article);
  if (!parsed) return null;

  return {
    content: parsed.content,
    title: parsed.title,
    meta: parsed.meta,
    receivedAt: parsed.receivedAt,
    hasContent: hasValidContent(parsed),
    displayDate: parsed.receivedAt
      ? new Date(parsed.receivedAt).toLocaleDateString()
      : "Unknown date",
  };
}
