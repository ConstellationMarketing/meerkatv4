import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://cpiyellkprzcyjhhcmqd.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwaXllbGxrcHJ6Y3lqaGhjbXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4MzAyOTUsImV4cCI6MjA1NTQwNjI5NX0.IVQMe8PskIsCU8eZjoJQKQoSUK1_ZUt9slOh6JKj_bw";

const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: "meerkat" } });

/**
 * Webhook callback handler for n8n article generation workflow
 *
 * This function receives webhook callbacks from n8n when article generation
 * completes and writes the article content directly to the Supabase database.
 *
 * The frontend then polls the database for updates and displays them to users.
 *
 * Expected webhook payload:
 * {
 *   articleid: string (unique article ID),
 *   status: "completed" | "completed_with_warnings" | "validation_failed",
 *   clientName: string,
 *   keyword: string,
 *   htmlContent: string (the generated article HTML),
 *   seoTitle?: string,
 *   seoMetaDescription?: string,
 *   timestamp: string (ISO format)
 * }
 */
export const handler = async (event, context) => {
  // Only accept POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Parse the incoming data from n8n
    const data = JSON.parse(event.body);

    console.log("🎯 Webhook callback received from n8n:", {
      articleid: data.articleid,
      status: data.status,
      clientName: data.clientName,
      keyword: data.keyword,
      contentLength: data.htmlContent?.length || 0,
    });

    // Handle validation failures
    if (data.status === "validation_failed") {
      console.error("❌ Validation failed:", {
        errors: data.errors,
        articleid: data.articleid,
      });

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          received: true,
          action: "validation_failed",
          errors: data.errors,
        }),
      };
    }

    // Handle successful completion
    if (
      data.status === "completed" ||
      data.status === "completed_with_warnings"
    ) {
      console.log("✅ Article generation completed:", {
        articleid: data.articleid,
        keyword: data.keyword,
        seoTitle: data.seoTitle,
      });

      // Write the article directly to Supabase database
      if (data.articleid && data.htmlContent) {
        console.log(
          "🔍 Finding article in database with article_id:",
          data.articleid,
        );

        // Find the article by article_id
        const { data: existingArticle, error: selectError } = await supabase
          .from("article_outlines")
          .select("id, article_id, client_name, keyword")
          .eq("article_id", data.articleid);

        if (selectError) {
          console.error("❌ Error finding article:", selectError);
          return {
            statusCode: 500,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              received: true,
              action: "find_failed",
              error: selectError.message,
            }),
          };
        }

        if (!existingArticle || existingArticle.length === 0) {
          console.warn("⚠️ Article not found in database:", data.articleid);
          return {
            statusCode: 404,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              received: true,
              action: "article_not_found",
              articleid: data.articleid,
            }),
          };
        }

        const internalId = existingArticle[0].id;
        console.log("🔑 Found article with internal ID:", internalId);

        // Update the article with received content - DIRECT DATABASE WRITE
        const { error: updateError } = await supabase
          .from("article_outlines")
          .update({
            received_article: {
              content: data.htmlContent,
              title: data.seoTitle || null,
              meta: data.seoMetaDescription || null,
              receivedAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", internalId);

        if (updateError) {
          console.error("❌ Error saving article to database:", updateError);
          return {
            statusCode: 500,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              received: true,
              action: "save_failed",
              error: updateError.message,
            }),
          };
        }

        console.log(
          "✅ Article saved successfully to Supabase database:",
          internalId,
        );
      }

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          received: true,
          action: "content_saved",
          articleid: data.articleid,
          savedAt: new Date().toISOString(),
        }),
      };
    }

    // Handle unexpected status
    console.warn("⚠️ Unexpected webhook status:", data.status);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        received: true,
        action: "unknown_status",
        status: data.status,
      }),
    };
  } catch (error) {
    console.error("❌ Webhook processing error:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        received: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
