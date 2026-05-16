import { createClient } from "@supabase/supabase-js";

function createSupabaseClient() {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL || "https://cwligyakhxevopxiksdm.supabase.co";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZG90ZHB6bWpibXN4dW5jZmRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk3Mzg4MywiZXhwIjoyMDc4NTQ5ODgzfQ.lRHYJGEeuVATe5dd1M_6808OsHhZVT506hRoAz5JXzs";
  return createClient(supabaseUrl, supabaseKey, { db: { schema: "meerkat" } });
}

function findHtmlString(val: any, depth = 0): string | null {
  if (!val || depth > 3) return null;
  if (typeof val === "string") {
    if (val.includes("<") && val.length > 20) return val;
    return null;
  }
  if (Array.isArray(val)) {
    for (const v of val) {
      const found = findHtmlString(v, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof val === "object") {
    for (const k of Object.keys(val)) {
      const found = findHtmlString(val[k], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function normalizeReceived(raw: any, updatedAt?: string) {
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
    findHtmlString(raw);

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

export const handler = async (event: any, context: any) => {
  const supabase = createSupabaseClient();
  const method = event.httpMethod;
  const queryStringParameters = event.queryStringParameters || {};
  const articleId = queryStringParameters.id;
  const clientName = queryStringParameters.clientName;
  const keyword = queryStringParameters.keyword;

  console.log("get-article API called with:", { articleId, clientName, keyword });

  if (method !== "GET") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Method not allowed",
      }),
    };
  }

  if (!articleId && (!clientName || !keyword)) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Article ID or (clientName and keyword) is required",
      }),
    };
  }

  try {
    let data: any = null;
    let error: any = null;

    if (articleId) {
      console.log("Searching by article ID:", articleId);
      const result = await supabase
        .from("article_outlines")
        .select("*")
        .eq("article_id", articleId)
        .maybeSingle();
      data = result.data;
      error = result.error;
      if (error) {
        console.log("Article not found by ID:", error);
      } else {
        console.log("Found article:", { id: data?.id, keyword: data?.keyword });
      }
    } else if (clientName && keyword) {
      // Fetch all and filter by client_name and keyword (case-insensitive)
      const result = await supabase
        .from("article_outlines")
        .select("*");

      if (!result.error && result.data && result.data.length > 0) {
        // Try exact match first
        const filtered = result.data.find((item: any) =>
          item.client_name?.toLowerCase() === clientName.toLowerCase() &&
          item.keyword?.toLowerCase() === keyword.toLowerCase()
        );

        // If no exact match, try partial match (in case of encoding issues)
        data = filtered || result.data.find((item: any) =>
          item.client_name?.toLowerCase().includes(clientName.toLowerCase()) &&
          item.keyword?.toLowerCase().includes(keyword.toLowerCase())
        ) || null;
      } else {
        error = result.error;
      }
    } else {
      error = { message: "Missing articleId or clientName/keyword" };
    }

    if (error || !data) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Article not found",
        }),
      };
    }

    // Use smart normalization to extract content from various fields
    let receivedArticle = normalizeReceived(data.received_article, data.updated_at);

    // If normalization didn't find content, try html_content
    if (!receivedArticle || !receivedArticle.content) {
      receivedArticle = {
        content: data.html_content || "",
        title: data.seo_title || null,
        meta: data.seo_meta_description || null,
        receivedAt: data.created_at || new Date().toISOString(),
      };
    }

    const article = {
      id: data.article_id,
      articleId: data.article_id,
      clientName: data.client_name,
      clientId: data.client_id,
      keyword: data.keyword,
      template: data.template,
      sections: data.sections,
      receivedArticle: receivedArticle,
      html_content: data.html_content,
      schema: data.schema,
      translations: data.translations,
      "word count": data["word count"],
      "flesch score": data["flesch score"],
      "Page URL": data["Page URL"],
      "URL Slug": data["URL Slug"],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      webhookSent: data.webhook_sent,
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ article }),
    };
  } catch (error: any) {
    console.error("Error fetching article:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to fetch article",
        message: error.message,
      }),
    };
  }
};
