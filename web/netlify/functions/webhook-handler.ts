import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://cwligyakhxevopxiksdm.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZG90ZHB6bWpibXN4dW5jZmRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NzM4ODMsImV4cCI6MjA3ODU0OTg4M30.aHMVupKq3oU9tqv5XUXkZXuqa33_5PR26XaOG6GcV7M";

const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: "meerkat" } });

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

function extractFirstTwoParagraphsAndClean(html: string): {
  first: string;
  second: string;
  cleanedHtml: string;
} {
  if (!html) return { first: "", second: "", cleanedHtml: "" };

  // Use a more flexible regex that handles nested tags
  const paragraphRegex = /<(?:p|h[1-6])[^>]*>([\s\S]*?)<\/(?:p|h[1-6])>/gi;
  const matches = [];
  const matchInfo = [];
  let match;

  while ((match = paragraphRegex.exec(html)) !== null) {
    const text = extractTextFromHtml(match[1]).trim();
    if (text) {
      matches.push(text);
      matchInfo.push({
        start: match.index,
        end: match.index + match[0].length,
      });
      if (matches.length === 2) break;
    }
  }

  console.log("🔍 Extracted matches:", {
    count: matches.length,
    first: matches[0]?.substring(0, 50),
    second: matches[1]?.substring(0, 50),
  });

  let cleanedHtml = html;
  if (matchInfo.length === 2) {
    // Remove both paragraphs from the content
    cleanedHtml =
      html.substring(0, matchInfo[0].start) + html.substring(matchInfo[1].end);
  } else if (matchInfo.length === 1) {
    // Remove the first paragraph only
    cleanedHtml =
      html.substring(0, matchInfo[0].start) + html.substring(matchInfo[0].end);
  }

  return {
    first: matches[0] || "",
    second: matches[1] || "",
    cleanedHtml: cleanedHtml.trim(),
  };
}

async function logWebhookPayload(payload: any): Promise<void> {
  try {
    const { error } = await supabase.from("webhook_logs").insert([
      {
        articleid: payload.articleid || "unknown",
        clientid: payload.clientid || null,
        keyword: payload.keyword || "unknown",
        status: payload.status || "received",
        payload: payload,
        receivedat: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("Failed to log webhook payload:", error);
    } else {
      console.log("✓ Webhook payload logged successfully");
    }
  } catch (error) {
    console.error("Error logging webhook payload:", error);
  }
}

export const handler = async (event: any, context: any) => {
  // Parse the incoming request
  const method = event.httpMethod;
  const path = event.path;

  console.log("🎯 Webhook request received:", {
    method,
    path,
    timestamp: new Date().toISOString(),
  });

  // Handle GET request to /api/webhook-callback (health check)
  if (method === "GET" && path.includes("webhook-callback")) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        status: "success",
        message: "Webhook endpoint is active",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // Handle POST requests - webhook callback from n8n
  if (method === "POST" && path.includes("webhook-callback")) {
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      console.error("❌ Failed to parse webhook body:", e);
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          status: "error",
          message: "Invalid JSON body",
        }),
      };
    }

    console.log("📦 Webhook payload received:", {
      articleid: (body as any).articleid,
      status: (body as any).status,
      clientName: (body as any).clientName,
      keyword: (body as any).keyword,
    });

    // Handle validation failures
    if ((body as any).status === "validation_failed") {
      console.error("❌ Validation failed:", {
        errors: (body as any).errors,
        articleid: (body as any).articleid,
      });

      await logWebhookPayload(body);

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          status: "failed",
          message: "Validation failed",
          errors: (body as any).errors,
        }),
      };
    }

    // Handle successful completion
    if (
      (body as any).status === "completed" ||
      (body as any).status === "completed_with_warnings"
    ) {
      console.log("✅ Article processing completed:", {
        articleid: (body as any).articleid,
        keyword: (body as any).keyword,
        contentLength: (body as any).htmlContent?.length || 0,
        seoTitle: (body as any).seoTitle,
      });

      // Write the article directly to Supabase
      if ((body as any).articleid && (body as any).htmlContent) {
        console.log("💾 Saving article to Supabase...");

        // First, find the article by article_id
        const { data: existingArticles, error: selectError } = await supabase
          .from("article_outlines")
          .select("id, article_id")
          .eq("article_id", (body as any).articleid);

        if (selectError) {
          console.error("❌ Error finding article:", selectError);
          await logWebhookPayload(body);
          return {
            statusCode: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
              status: "error",
              message: "Failed to find article",
              error: selectError.message,
            }),
          };
        }

        if (!existingArticles || existingArticles.length === 0) {
          console.warn("⚠️ Article not found:", (body as any).articleid);
          await logWebhookPayload(body);
          return {
            statusCode: 404,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
              status: "error",
              message: "Article not found",
              articleid: (body as any).articleid,
            }),
          };
        }

        const internalId = existingArticles[0].id;
        console.log("🔑 Found article with internal ID:", internalId);

        // Always extract first two paragraphs for title and meta description
        let htmlContent = (body as any).htmlContent || "";
        const { first, second, cleanedHtml } =
          extractFirstTwoParagraphsAndClean(htmlContent);

        let finalTitle = (body as any).seoTitle || null;
        let finalMeta = (body as any).seoMetaDescription || null;
        let finalContent = htmlContent;

        console.log("🔍 Extraction debug:", {
          first: first?.substring(0, 50),
          second: second?.substring(0, 50),
          htmlLength: htmlContent.length,
        });

        if (!finalTitle && first) {
          finalTitle = first.substring(0, 70);
          console.log("✅ Set title from extraction:", finalTitle);
          finalContent = cleanedHtml;
        }

        if (!finalMeta && second) {
          finalMeta = second.substring(0, 156);
          console.log("✅ Set meta description from extraction:", finalMeta);
          finalContent = cleanedHtml;
        }

        console.log("📤 Saving to database:", {
          finalTitle: finalTitle?.substring(0, 40),
          finalMeta: finalMeta?.substring(0, 40),
          contentLength: finalContent.length,
        });

        // Update the article with the received content
        const { error: updateError } = await supabase
          .from("article_outlines")
          .update({
            received_article: {
              content: finalContent,
              title: finalTitle,
              meta: finalMeta,
              receivedAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", internalId);

        if (updateError) {
          console.error("❌ Error saving article to Supabase:", updateError);
          await logWebhookPayload(body);
          return {
            statusCode: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
              status: "error",
              message: "Failed to save article",
              error: updateError.message,
            }),
          };
        }

        console.log("✅ Article successfully saved to Supabase");
      }

      // Log the successful webhook payload
      await logWebhookPayload(body);

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          status: "success",
          message: "Article received and saved to database",
          articleid: (body as any).articleid,
          savedAt: new Date().toISOString(),
        }),
      };
    }

    // Handle unexpected status
    console.warn("⚠️ Unexpected webhook status:", (body as any).status);
    await logWebhookPayload(body);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        status: "success",
        message: "Webhook received",
        receivedAt: new Date().toISOString(),
      }),
    };
  }

  // Default 404 response
  return {
    statusCode: 404,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      error: "Endpoint not found",
      path: path,
      method: method,
    }),
  };
};
