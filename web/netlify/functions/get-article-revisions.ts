import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://cwligyakhxevopxiksdm.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZG90ZHB6bWpibXN4dW5jZmRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NzM4ODMsImV4cCI6MjA3ODU0OTg4M30.aHMVupKq3oU9tqv5XUXkZXuqa33_5PR26XaOG6GcV7M";

const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: "meerkat" } });

export const handler = async (event: any, context: any) => {
  const method = event.httpMethod;
  const queryStringParameters = event.queryStringParameters || {};
  const articleId = queryStringParameters.article_id;

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

  if (!articleId) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Article ID is required",
      }),
    };
  }

  try {
    const { data: revisions, error } = await supabase
      .from("article_revisions")
      .select("*")
      .eq("article_id", articleId)
      .order("version_number", { ascending: false });

    if (error) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Failed to fetch revisions",
          message: error.message,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        revisions: revisions || [],
      }),
    };
  } catch (error: any) {
    console.error("Error fetching revisions:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to fetch revisions",
        message: error.message,
      }),
    };
  }
};
