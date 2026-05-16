import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://cwligyakhxevopxiksdm.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZG90ZHB6bWpibXN4dW5jZmRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk3Mzg4MywiZXhwIjoyMDc4NTQ5ODgzfQ.lRHYJGEeuVATe5dd1M_6808OsHhZVT506hRoAz5JXzs";

const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: "meerkat" } });

type CorsHeaders = {
  [key: string]: string;
};

export const handler = async (event: any) => {
  const corsHeaders: CorsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { token } = event.queryStringParameters || {};

    if (!token) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing token" }),
      };
    }

    const { data, error } = await supabase
      .from("article_access")
      .select("article_id, email")
      .eq("access_token", token)
      .single();

    if (error || !data) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid or expired token" }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        articleId: data.article_id,
        email: data.email,
      }),
    };
  } catch (error) {
    console.error("Unhandled error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
