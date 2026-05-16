export interface ArticleSection {
  id: string;
  title: string;
  description: string;
  examples?: string;
  targetWordCount?: number;
  content?: string;
}

export interface ArticleOutline {
  id: string;
  articleId: string; // Unique ID for webhook matching
  clientName: string;
  clientId?: string;
  keyword: string;
  sections: ArticleSection[];
  template?: string; // Template type used to create the article
  createdAt: string;
  updatedAt: string;
  webhookSent?: boolean;
  schema?: string; // JSON Schema for the article
  "word count"?: number; // Word count from Supabase
  "flesch score"?: string; // Flesch score from Supabase
  "Page URL"?: string; // Page URL from Supabase
  "URL Slug"?: string; // URL Slug from Supabase
  "page-update-type"?: "new" | "update"; // Page update type (new page or update existing)
  "page-url"?: string; // Page URL for updates
  userId?: string; // ID of the user who created the article
  receivedArticle?: {
    content: string;
    title?: string | null;
    meta?: string | null;
    receivedAt: string;
  };
  resourcePage?: string; // Resource page HTML content from Supabase
  version?: string; // Meerkat release version (e.g. V4.0.2)
  titleTag?: string; // Title tag from Supabase (e.g. "Keyword | Firm Name")
  translations?: {
    [lang: string]: {
      status: "pending" | "complete";
      translated_at: string | null;
      content: string | null;
      title?: string | null;
      meta?: string | null;
      slug?: string | null;
    };
  };
}
