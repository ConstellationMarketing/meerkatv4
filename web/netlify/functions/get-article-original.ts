import { createClient } from "@supabase/supabase-js";

function createSupabaseClient() {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL || "https://cwligyakhxevopxiksdm.supabase.co";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZG90ZHB6bWpibXN4dW5jZmRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk3Mzg4MywiZXhwIjoyMDc4NTQ5ODgzfQ.lRHYJGEeuVATe5dd1M_6808OsHhZVT506hRoAz5JXzs";
  return createClient(supabaseUrl, supabaseKey, { db: { schema: "meerkat" } });
}

/**
 * Returns the originally generated article content from the "cleaned content"
 * column, which is written once by the pipeline and never modified by editors.
 */
export const handler = async (event: any) => {
  const supabase = createSupabaseClient();
  const articleId = event.queryStringParameters?.id;

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  if (!articleId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Article ID is required" }),
    };
  }

  try {
    const { data, error } = await supabase
      .from("article_outlines")
      .select('article_id, client_name, keyword, template, "cleaned content", "word count", "flesch score", "Page URL", "URL Slug", created_at')
      .eq("article_id", articleId)
      .maybeSingle();

    if (error || !data) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Article not found" }),
      };
    }

    const originalContent = data["cleaned content"];
    if (!originalContent) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Original content not available" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        article: {
          id: data.article_id,
          articleId: data.article_id,
          clientName: data.client_name,
          keyword: data.keyword,
          template: data.template,
          receivedArticle: { content: originalContent, title: null, meta: null, receivedAt: data.created_at },
          "word count": data["word count"],
          "flesch score": data["flesch score"],
          "Page URL": data["Page URL"],
          "URL Slug": data["URL Slug"],
          createdAt: data.created_at,
          isOriginal: true,
        },
      }),
    };
  } catch (error: any) {
    console.error("Error fetching original article:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Failed to fetch article" }),
    };
  }
};
