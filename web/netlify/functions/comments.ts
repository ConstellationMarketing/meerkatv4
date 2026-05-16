import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://cwligyakhxevopxiksdm.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZG90ZHB6bWpibXN4dW5jZmRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk3Mzg4MywiZXhwIjoyMDc4NTQ5ODgzfQ.lRHYJGEeuVATe5dd1M_6808OsHhZVT506hRoAz5JXzs";

const createSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: "meerkat" },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

type CorsHeaders = {
  [key: string]: string;
};

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const handler = async (event: any) => {
  const corsHeaders: CorsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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

  const method = event.httpMethod;
  let body: any = {};

  try {
    if (event.body) {
      body = JSON.parse(event.body);
    }
  } catch (parseError) {
    console.error("Error parsing body:", parseError);
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  try {
    if (method === "GET") {
      const { articleId } = event.queryStringParameters || {};
      if (!articleId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing articleId" }),
        };
      }

      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from("article_comments")
        .select("*")
        .eq("article_id", articleId)
        .order("created_at", { ascending: false });

      if (error) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: error.message }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(data),
      };
    }

    if (method === "POST") {
      const {
        articleId,
        userId,
        selectedText,
        comment,
        textPosition,
        section,
        userEmail,
      } = body;

      console.log("Adding comment:", {
        articleId,
        userId,
        userEmail,
        comment: comment?.substring(0, 50),
      });

      if (!articleId || !comment) {
        console.error("Missing required fields:", { articleId, comment });
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            error:
              "Missing required fields: articleId and comment are required",
          }),
        };
      }

      // Always generate a UUID for user_id (database requires UUID format)
      // userEmail will be stored in text_position for reference
      const finalUserId = generateUUID();

      console.log("Inserting comment with:", {
        article_id: articleId,
        user_id: finalUserId,
        user_email: userEmail,
        comment: comment.substring(0, 50),
      });

      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from("article_comments")
        .insert({
          article_id: articleId,
          user_id: finalUserId,
          selected_text: selectedText || null,
          comment,
          text_position: textPosition || {
            section: section || null,
            userEmail,
          },
        })
        .select();

      if (error) {
        console.error("Supabase insert error:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            error: `Failed to save comment: ${error.message}`,
            details: error,
          }),
        };
      }

      console.log("Comment added successfully:", data);
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(data[0]),
      };
    }

    if (method === "PATCH") {
      const { commentId, resolved } = body;

      if (!commentId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing commentId" }),
        };
      }

      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from("article_comments")
        .update({ resolved })
        .eq("id", commentId)
        .select();

      if (error) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: error.message }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(data[0]),
      };
    }

    if (method === "DELETE") {
      const { commentId } = body;

      if (!commentId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing commentId" }),
        };
      }

      const supabase = createSupabaseClient();
      const { error } = await supabase
        .from("article_comments")
        .delete()
        .eq("id", commentId);

      if (error) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: error.message }),
        };
      }

      return {
        statusCode: 204,
        headers: corsHeaders,
        body: "",
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
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
