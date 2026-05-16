import "dotenv/config";
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import cron from "node-cron";
import { handleDemo } from "./routes/demo";
import { supabase } from "./supabase";

// Create a Supabase client with Service Role Key for server-side operations
// Falls back to anon key if service key is not available
const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://cwligyakhxevopxiksdm.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZG90ZHB6bWpibXN4dW5jZmRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NzM4ODMsImV4cCI6MjA3ODU0OTg4M30.aHMVupKq3oU9tqv5XUXkZXuqa33_5PR26XaOG6GcV7M";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: "meerkat" } });

/**
 * Send unedited articles to webhook
 * Gets all team members and identifies their unedited articles
 */
async function sendUneditedArticlesToWebhook() {
  try {
    console.log("🚀 [Scheduled Task] Starting unedited articles webhook send...");
    const timestamp = new Date().toISOString();

    // Fetch all team members
    const { data: teamMembers, error: teamError } = await supabaseAdmin
      .from("team_members")
      .select("*");

    if (teamError) {
      console.error("❌ [Scheduled Task] Error fetching team members:", teamError);
      return;
    }

    if (!teamMembers || teamMembers.length === 0) {
      console.warn("⚠️ [Scheduled Task] No team members found");
      return;
    }

    console.log(
      `✅ [Scheduled Task] Found ${teamMembers.length} team members`
    );

    // Fetch all articles once — the prior per-member fetch returned the same
    // unfiltered rows each iteration and was a meaningful share of the daily
    // Supabase Disk IO burn.
    const { data: allArticles, error: articlesError } = await supabaseAdmin
      .from("article_outlines")
      .select("article_id, keyword");

    if (articlesError) {
      console.error("❌ [Scheduled Task] Error fetching articles:", articlesError);
      return;
    }

    // For each team member, get their unedited articles
    const uneditedData = [];

    for (const member of teamMembers) {
      try {
        const email = member.email_address;
        const userId = member.user_id;

        // Get articles that have been edited by this user
        const { data: editedRecords, error: editError } = await supabaseAdmin
          .from("timer_and_feedbacks")
          .select("article_id")
          .eq("user", email);

        if (editError) {
          console.error(
            `❌ [Scheduled Task] Error fetching edited articles for ${email}:`,
            editError
          );
          continue;
        }

        const editedArticleIds = new Set(
          (editedRecords || []).map((record: any) => record.article_id)
        );

        // Filter to get unedited articles
        const uneditedArticles = (allArticles || [])
          .filter((article: any) => !editedArticleIds.has(article.article_id))
          .map((article: any) => ({
            article_id: article.article_id,
            article_title: article.keyword || "Untitled",
            article_link: `https://meerkatv3.netlify.app/editor/${article.article_id}`,
          }));

        uneditedData.push({
          email,
          uneditedArticles,
          count: uneditedArticles.length,
          timestamp,
        });

        console.log(
          `📊 [Scheduled Task] ${email}: ${uneditedArticles.length} unedited articles`
        );
      } catch (memberError) {
        console.error(
          `❌ [Scheduled Task] Error processing member ${member.email_address}:`,
          memberError
        );
        continue;
      }
    }

    if (uneditedData.length === 0) {
      console.warn("⚠️ [Scheduled Task] No unedited articles found for any user");
      return;
    }

    // Send to webhook
    const webhookUrl =
      "https://n8n-14lp.onrender.com/webhook/decb968b-7b9c-4046-a18e-933c6879fb8c";

    const payload = {
      data: uneditedData,
      sentAt: timestamp,
      userCount: uneditedData.length,
      totalUneditedArticles: uneditedData.reduce(
        (sum: number, user: any) => sum + user.count,
        0
      ),
      source: "meerkat-editor-scheduled",
      scheduledAt: "09:00:00 AM US Standard Time",
    };

    console.log(
      `📤 [Scheduled Task] Sending ${uneditedData.length} users to webhook...`
    );

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `❌ [Scheduled Task] Webhook error ${response.status}:`,
        errorText
      );
      return;
    }

    const responseText = await response.text();
    console.log(
      `✅ [Scheduled Task] Successfully sent to webhook:`,
      responseText.substring(0, 200)
    );
  } catch (error) {
    console.error("[Scheduled Task] Unhandled error:", error);
  }
}

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

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Schedule the unedited articles webhook task to run daily at 9:00 AM US time
  // Cron expression: "0 9 * * *" = 9 AM every day
  // Note: This runs at 9 AM server time. The server should be configured to run in US timezone
  // or adjust this cron expression based on your server's timezone offset
  const scheduledTask = cron.schedule("0 9 * * *", () => {
    console.log(
      "\n📅 [Cron Scheduler] Triggering daily unedited articles webhook at 9:00 AM..."
    );
    sendUneditedArticlesToWebhook();
  });

  console.log("✅ [Scheduler] Daily webhook task scheduled for 9:00 AM US time");

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  // Manual trigger endpoint for testing the webhook send
  // Can be called by admins to manually send unedited articles without waiting for 9 AM
  app.post("/api/trigger-webhook-send", async (req, res) => {
    try {
      console.log("🔔 Manual webhook trigger requested");
      await sendUneditedArticlesToWebhook();
      res.json({
        success: true,
        message: "Webhook send triggered successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error triggering webhook send:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  app.get("/api/demo", handleDemo);

  /**
   * WORKFLOW DOCUMENTATION:
   *
   * The article generation workflow follows these steps:
   *
   * 1. Frontend sends article outline to n8n via sendOutlineToWebhook()
   *    (client/lib/webhook.ts:sendOutlineToWebhook)
   *
   * 2. n8n processes the outline and generates article content
   *
   * 3. n8n sends webhook callback to: https://meerkatv3.netlify.app/api/webhook-callback
   *    (or local: http://localhost:3000/api/webhook-callback for development)
   *
   * 4. Webhook callback handler DIRECTLY UPDATES Supabase database
   *    with the generated article content (netlify/functions/api/webhook-callback.js)
   *
   * 5. Frontend polls Supabase for updates using:
   *    - client/hooks/use-article-updates.ts (shows toast notifications)
   *    - client/pages/EditOutline.tsx (updates the outline view)
   *
   * NOTE: These Express routes below are for LOCAL DEVELOPMENT ONLY.
   * In production, the Netlify Functions handle the webhook callbacks.
   */

  // LOCAL DEVELOPMENT: Webhook endpoint for sending outlines to n8n
  app.post("/api/webhook/send-outline", async (req, res) => {
    try {
      const payload = req.body;

      const webhookUrl =
        process.env.N8N_WEBHOOK_URL ||
        "https://n8n-14lp.onrender.com/webhook/7efaa419-4106-4ef4-91a1-cab3b70b1f3b";

      console.log("🚀 Sending outline to n8n:", webhookUrl);
      console.log("📦 Payload:", JSON.stringify(payload, null, 2));

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("📊 n8n response status:", response.status);

      if (!response.ok) {
        const responseText = await response.text();
        console.error("❌ n8n error response:", responseText);

        return res.status(response.status).json({
          success: false,
          error: `n8n returned ${response.status}: ${responseText}`,
          webhookUrl,
        });
      }

      await response.blob();

      res.json({
        success: true,
        message: "Outline sent to n8n successfully",
      });
    } catch (error) {
      console.error("❌ Error sending outline to n8n:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      res.status(500).json({
        success: false,
        error: errorMessage,
        details:
          "Failed to reach n8n webhook. Check that n8n is running and the webhook URL is correct.",
      });
    }
  });

  /**
   * LOCAL DEVELOPMENT: Webhook endpoint for receiving completed articles from n8n
   *
   * In production, use the Netlify Function at:
   * netlify/functions/api/webhook-callback.js
   */
  app.post("/api/webhook-callback", async (req, res) => {
    try {
      const data = req.body;

      console.log("🎯 Webhook callback received:", {
        articleid: data.articleid,
        status: data.status,
        clientName: data.clientName,
        keyword: data.keyword,
      });

      if (!data.articleid || !data.htmlContent) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: articleid and htmlContent",
        });
      }

      // Handle validation failures
      if (data.status === "validation_failed") {
        console.error("❌ Validation failed:", data.errors);
        return res.status(200).json({
          success: true,
          message: "Validation error recorded",
          errors: data.errors,
        });
      }

      // Handle successful completion
      if (
        data.status === "completed" ||
        data.status === "completed_with_warnings"
      ) {
        console.log("✅ Article completed, updating database...");

        // Find the article outline by articleId and update with received content
        const { data: existingArticles, error: selectError } = await supabase
          .from("article_outlines")
          .select("id, article_id")
          .eq("article_id", data.articleid);

        if (selectError) {
          console.error("❌ Error finding article:", selectError);
          return res.status(500).json({
            success: false,
            error: "Failed to find article outline",
            details: selectError.message,
          });
        }

        if (!existingArticles || existingArticles.length === 0) {
          return res.status(404).json({
            success: false,
            error: "Article outline not found for articleid: " + data.articleid,
          });
        }

        const internalId = existingArticles[0].id;

        // Always extract first two paragraphs for title and meta description
        let htmlContent = data.htmlContent || "";
        const { first, second, cleanedHtml } =
          extractFirstTwoParagraphsAndClean(htmlContent);

        let finalTitle = data.seoTitle || null;
        let finalMeta = data.seoMetaDescription || null;
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

        // Update the article with received content - DIRECT DATABASE WRITE
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
          console.error("❌ Error updating article:", updateError);
          return res.status(500).json({
            success: false,
            error: "Failed to update article with received content",
            details: updateError.message,
          });
        }

        console.log("✅ Article updated successfully in database");

        res.json({
          success: true,
          message: "Article received and saved to database",
          articleid: data.articleid,
          savedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("❌ Error processing webhook callback:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Netlify Functions handlers for development
  // These mirror the Netlify functions to work locally during development

  // Get article revisions
  app.get("/.netlify/functions/get-article-revisions", async (req, res) => {
    const articleId = req.query.article_id as string;

    if (!articleId) {
      return res.status(400).json({
        error: "Article ID is required",
      });
    }

    try {
      const { data: revisions, error } = await supabase
        .from("article_revisions")
        .select("*")
        .eq("article_id", articleId)
        .order("version_number", { ascending: false });

      if (error) {
        return res.status(500).json({
          error: "Failed to fetch revisions",
          message: error.message,
        });
      }

      return res.json({
        revisions: revisions || [],
      });
    } catch (error: any) {
      console.error("Error fetching revisions:", error);
      return res.status(500).json({
        error: "Failed to fetch revisions",
        message: error.message,
      });
    }
  });

  // Update article
  app.post("/.netlify/functions/update-article", async (req, res) => {
    const { id, html_content, create_revision } = req.body;

    if (!id || !html_content) {
      return res.status(400).json({
        error: "Article ID and html_content are required",
      });
    }

    try {
      console.log("📝 Updating article:", {
        id,
        contentLength: html_content?.length,
      });

      const { data: article, error: selectError } = await supabase
        .from("article_outlines")
        .select("*")
        .eq("id", id)
        .single();

      if (selectError) {
        console.error("❌ Error fetching article:", selectError);
        return res.status(404).json({
          error: "Article not found",
          details: selectError.message,
        });
      }

      if (!article) {
        console.error("❌ Article not found for id:", id);
        return res.status(404).json({
          error: "Article not found",
        });
      }

      const now = new Date().toISOString();

      if (create_revision !== false && article.received_article?.content) {
        console.log("📋 Creating revision");
        const { error: revisionError } = await supabase
          .from("article_revisions")
          .insert({
            id:
              Math.random().toString(36).substring(2, 15) +
              Math.random().toString(36).substring(2, 15),
            article_id: id,
            version_number: 0,
            html_content: article.received_article.content,
            edited_at: now,
          });

        if (revisionError) {
          console.error("⚠️ Error creating revision:", revisionError);
        }
      }

      console.log("🔄 Updating article with new content...");
      const { error: updateError } = await supabase
        .from("article_outlines")
        .update({
          received_article: {
            content: html_content,
            title: article.received_article?.title || null,
            meta: article.received_article?.meta || null,
            receivedAt: article.received_article?.receivedAt || now,
          },
          edit_count: (article.edit_count || 0) + 1,
          last_edited_at: now,
          updated_at: now,
        })
        .eq("id", id);

      if (updateError) {
        console.error("❌ Error updating article:", updateError);
        return res.status(500).json({
          error: "Failed to update article",
          message: updateError.message,
        });
      }

      console.log("✅ Article updated successfully");
      return res.json({
        success: true,
        updated_at: now,
      });
    } catch (error: any) {
      console.error("❌ Exception updating article:", error);
      return res.status(500).json({
        error: "Failed to update article",
        message: error.message,
      });
    }
  });

  // Helper functions for data normalization (same as storage.ts)
  function findHtmlInData(val: any, depth = 0): string | null {
    if (!val || depth > 3) return null;
    if (typeof val === "string") {
      if (val.includes("<") && val.length > 20) return val;
      return null;
    }
    if (Array.isArray(val)) {
      for (const v of val) {
        const found = findHtmlInData(v, depth + 1);
        if (found) return found;
      }
      return null;
    }
    if (typeof val === "object") {
      for (const k of Object.keys(val)) {
        const found = findHtmlInData(val[k], depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function normalizeReceivedArticle(raw: any, updatedAt?: string) {
    if (raw == null) return null;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        raw = parsed;
      } catch {
        return {
          content: raw,
          title: null,
          meta: null,
          receivedAt: updatedAt || null,
        };
      }
    }
    if (typeof raw !== "object") return null;

    const contentCandidate =
      (raw as any).content ??
      (raw as any).htmlContent ??
      (raw as any).html ??
      findHtmlInData(raw);

    return {
      content: typeof contentCandidate === "string" ? contentCandidate : "",
      title:
        (raw as any).title ??
        (raw as any).seoTitle ??
        (raw as any).seo_title ??
        null,
      meta:
        (raw as any).meta ??
        (raw as any).seoMetaDescription ??
        (raw as any).seo_meta_description ??
        null,
      receivedAt:
        (raw as any).receivedAt ??
        (raw as any).timestamp ??
        (raw as any).received_at ??
        updatedAt ??
        null,
    };
  }

  // Public endpoint for fetching articles by slug (for share links)
  // Uses admin client to bypass RLS policies
  app.get("/.netlify/functions/get-article", async (req, res) => {
    const articleId = req.query.id as string;
    const clientName = req.query.clientName as string;
    const keyword = req.query.keyword as string;

    console.log("get-article API called with:", {
      articleId,
      clientName,
      keyword,
    });

    try {
      let data: any = null;

      if (articleId) {
        console.log("Searching by article ID:", articleId);
        const { data: article, error } = await supabaseAdmin
          .from("article_outlines")
          .select("*")
          .eq("article_id", articleId)
          .single();

        if (error || !article) {
          console.error("Article not found by ID:", error);
          return res.status(404).json({ error: "Article not found" });
        }
        data = article;
      } else if (clientName && keyword) {
        console.log("Searching by clientName and keyword");
        // Fetch all and filter by client_name and keyword (case-insensitive)
        const { data: articles, error } = await supabaseAdmin
          .from("article_outlines")
          .select("*");

        console.log("Supabase query result:", {
          error: error?.message,
          count: articles?.length || 0,
          articles: articles?.map((a: any) => ({
            client_name: a.client_name,
            keyword: a.keyword,
          })),
        });

        if (error || !articles) {
          console.error("Error fetching articles:", error);
          return res
            .status(404)
            .json({ error: "Article not found", details: error?.message });
        }

        // Try exact match first
        const filtered = articles.find(
          (item: any) =>
            item.client_name?.toLowerCase() === clientName.toLowerCase() &&
            item.keyword?.toLowerCase() === keyword.toLowerCase(),
        );

        // If no exact match, try partial match
        data =
          filtered ||
          articles.find(
            (item: any) =>
              item.client_name
                ?.toLowerCase()
                .includes(clientName.toLowerCase()) &&
              item.keyword?.toLowerCase().includes(keyword.toLowerCase()),
          ) ||
          null;

        console.log("Search result:", { found: !!data });

        if (!data) {
          return res.status(404).json({ error: "Article not found" });
        }
      } else {
        return res.status(400).json({
          error: "Missing articleId or clientName/keyword",
        });
      }

      // Use smart normalization to extract content from various fields
      let receivedArticle = normalizeReceivedArticle(
        data.received_article,
        data.updated_at,
      );

      // If normalization didn't find content, try html_content
      if (!receivedArticle || !receivedArticle.content) {
        receivedArticle = {
          content: data.html_content || "",
          title: data.seo_title || null,
          meta: data.seo_meta_description || null,
          receivedAt: data.created_at || new Date().toISOString(),
        };
      }

      // Transform database fields to match ArticleOutline type expectations
      // Include all fields exactly as storage.ts does
      const article = {
        id: data.article_id || data.id,
        articleId: data.article_id,
        clientId: data.client_id,
        clientName: data.client_name,
        keyword: data.keyword,
        template: data.template,
        sections: data.sections,
        receivedArticle: receivedArticle,
        html_content: data.html_content,
        schema: data.schema,
        "word count": data["word count"],
        "flesch score": data["flesch score"],
        "Page URL": data["Page URL"],
        "URL Slug": data["URL Slug"],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        webhookSent: data.webhook_sent,
      };

      return res.json({ article });
    } catch (error: any) {
      console.error("Error fetching article:", error);
      return res.status(500).json({
        error: "Failed to fetch article",
        message: error.message,
      });
    }
  });

  // Comments API
  app.get("/api/comments", async (req, res) => {
    const articleId = req.query.articleId as string;

    if (!articleId) {
      return res.status(400).json({ error: "Missing articleId" });
    }

    try {
      const { data, error } = await supabase
        .from("article_comments")
        .select("*")
        .eq("article_id", articleId)
        .order("created_at", { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.json(data);
    } catch (error: any) {
      console.error("Error fetching comments:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/comments", async (req, res) => {
    const {
      articleId,
      userId,
      selectedText,
      comment,
      textPosition,
      section,
      userEmail,
    } = req.body;

    console.log("Adding comment:", { articleId, userId, comment });

    if (!articleId || !comment) {
      console.error("Missing required fields:", { articleId, comment });
      return res.status(400).json({
        error: "Missing required fields: articleId and comment are required",
      });
    }

    try {
      // Generate a UUID for user if not provided, use userId if it's a valid UUID format
      const isValidUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          userId,
        );
      const finalUserId = isValidUUID ? userId : generateUUID();

      console.log("Inserting with userId:", finalUserId);

      // Always include userEmail in text_position for tracking
      const positionData = textPosition
        ? { ...textPosition, userEmail }
        : { section, userEmail };

      const { data, error } = await supabase
        .from("article_comments")
        .insert({
          article_id: articleId,
          user_id: finalUserId,
          selected_text: selectedText || null,
          comment,
          text_position: positionData,
        })
        .select();

      if (error) {
        console.error("Supabase insert error:", error);
        return res.status(500).json({
          error: error.message,
          details: error,
        });
      }

      console.log("Comment added successfully:", data);
      return res.status(201).json(data[0]);
    } catch (error: any) {
      console.error("Unhandled error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/comments", async (req, res) => {
    const { commentId, resolved } = req.body;

    if (!commentId) {
      return res.status(400).json({ error: "Missing commentId" });
    }

    try {
      const { data, error } = await supabase
        .from("article_comments")
        .update({ resolved })
        .eq("id", commentId)
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.json(data[0]);
    } catch (error: any) {
      console.error("Error updating comment:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/comments", async (req, res) => {
    const { commentId } = req.body;

    if (!commentId) {
      return res.status(400).json({ error: "Missing commentId" });
    }

    try {
      const { error } = await supabase
        .from("article_comments")
        .delete()
        .eq("id", commentId);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(204).send("");
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Article Access API
  app.get("/api/article-access", async (req, res) => {
    const articleId = req.query.articleId as string;

    if (!articleId) {
      return res.status(400).json({ error: "Missing articleId" });
    }

    try {
      const { data, error } = await supabase
        .from("article_access")
        .select("*")
        .eq("article_id", articleId)
        .order("created_at", { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.json(data);
    } catch (error: any) {
      console.error("Error fetching article access:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/article-access", async (req, res) => {
    const { articleId, email, accessLevel, userId } = req.body;

    if (!articleId || !email || !accessLevel) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // Check if userId is a valid UUID format
      const isValidUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          userId,
        );

      const insertData: any = {
        article_id: articleId,
        email: email.toLowerCase(),
        access_level: accessLevel,
      };

      // Only include created_by if userId is a valid UUID
      if (isValidUUID) {
        insertData.created_by = userId;
      }

      const { data, error } = await supabase
        .from("article_access")
        .insert(insertData)
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json(data[0]);
    } catch (error: any) {
      console.error("Error creating article access:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/article-access", async (req, res) => {
    const { accessId, accessLevel } = req.body;

    if (!accessId || !accessLevel) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const { data, error } = await supabase
        .from("article_access")
        .update({ access_level: accessLevel })
        .eq("id", accessId)
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.json(data[0]);
    } catch (error: any) {
      console.error("Error updating article access:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/article-access", async (req, res) => {
    const { accessId } = req.body;

    if (!accessId) {
      return res.status(400).json({ error: "Missing accessId" });
    }

    try {
      const { error } = await supabase
        .from("article_access")
        .delete()
        .eq("id", accessId);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(204).send("");
    } catch (error: any) {
      console.error("Error deleting article access:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Articles endpoint (with user_id visible via service role)
  app.get("/api/articles", async (req, res) => {
    try {
      console.log("📚 /api/articles GET request");
      const { data, error } = await supabaseAdmin
        .from("article_outlines")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching articles:", error);
        return res.status(500).json({ error: error.message });
      }

      console.log("✅ Articles fetched successfully:", {
        count: data?.length || 0,
        hasuserIds: data?.some((a: any) => a.user_id),
      });

      // Log each article with its userId for debugging
      if (data && data.length > 0) {
        console.log("📋 DETAILED ARTICLE LIST:");
        data.forEach((article: any, idx: number) => {
          console.log(
            `   [${idx}] ID: ${article.id}, Article_ID: ${article.article_id}, Keyword: "${article.keyword}", Client: "${article.client_name}", User_ID: "${article.user_id || "NULL"}"`,
          );
        });
      }

      return res.json(data);
    } catch (error: any) {
      console.error("Error in /api/articles:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Team Members endpoints
  app.get("/api/team-members", async (req, res) => {
    try {
      console.log("📋 /api/team-members GET request");
      const { data, error } = await supabaseAdmin
        .from("team_members")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching team members:", error);
        return res.status(500).json({ error: error.message });
      }

      console.log("✅ Team members fetched:", {
        count: data?.length || 0,
        members: data?.map((m: any) => ({
          id: m.id,
          email: m.email_address,
          role: m.role,
          user_id: m.user_id,
        })),
      });
      return res.status(200).json(data);
    } catch (error: any) {
      console.error("❌ Error fetching team members:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/team-members", async (req, res) => {
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["admin", "member"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    try {
      // Try to find an existing user by email and link them
      let userId: string | null = null;

      try {
        const response = await supabaseAdmin.auth.admin.listUsers();
        const { data, error } = response;

        if (!error && data?.users) {
          const found = data.users.find(
            (u) => u.email?.toLowerCase() === email.toLowerCase(),
          );
          if (found?.id) {
            userId = found.id;
            console.log(`Found existing user ${found.id} for email ${email}`);
          }
        }
      } catch (err) {
        console.log(
          "Could not lookup existing users, will add with null user_id",
        );
      }

      // Check if email already exists as a team member
      const { data: existingByEmail, error: existingError } =
        await supabaseAdmin
          .from("team_members")
          .select("id, user_id")
          .eq("email_address", email.toLowerCase());

      if (existingError) {
        console.error("❌ Error checking existing member:", existingError);
        return res.status(500).json({ error: existingError.message });
      }

      if (existingByEmail && existingByEmail.length > 0) {
        const existing = existingByEmail[0];

        // If we found a user_id and the existing record doesn't have one, update it
        if (userId && !existing.user_id) {
          const { data: updatedData, error: updateError } = await supabaseAdmin
            .from("team_members")
            .update({ user_id: userId })
            .eq("id", existing.id)
            .select();

          if (updateError) {
            console.error("❌ Error updating member:", updateError);
            return res.status(500).json({ error: updateError.message });
          }

          return res.status(200).json(updatedData[0]);
        }

        // If it's the exact same user, return success (idempotent)
        return res.status(200).json(existingByEmail[0]);
      }

      // Insert team member (user_id can be null if user hasn't signed up yet)
      console.log("➕ Adding team member:", { email, role, userId });
      const { data: teamData, error: insertError } = await supabaseAdmin
        .from("team_members")
        .insert({
          user_id: userId || null,
          email_address: email.toLowerCase(),
          role: role,
        })
        .select();

      if (insertError) {
        console.error("❌ Error inserting member:", insertError);
        return res.status(500).json({ error: insertError.message });
      }

      console.log("✅ Team member created successfully");

      return res.status(201).json(teamData[0]);
    } catch (error: any) {
      console.error("Error adding team member:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/team-members", async (req, res) => {
    const { memberId, role } = req.body;

    if (!memberId || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["admin", "member"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    try {
      const { data: updateData, error: updateError } = await supabase
        .from("team_members")
        .update({ role: role })
        .eq("id", memberId)
        .select();

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      return res.status(200).json(updateData[0]);
    } catch (error: any) {
      console.error("Error updating team member:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/team-members", async (req, res) => {
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({ error: "Missing memberId" });
    }

    try {
      const { error: deleteError } = await supabase
        .from("team_members")
        .delete()
        .eq("id", memberId);

      if (deleteError) {
        return res.status(500).json({ error: deleteError.message });
      }

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Error deleting team member:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  return app;
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
