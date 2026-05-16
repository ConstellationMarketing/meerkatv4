import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://cwligyakhxevopxiksdm.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZG90ZHB6bWpibXN4dW5jZmRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk3Mzg4MywiZXhwIjoyMDc4NTQ5ODgzfQ.lRHYJGEeuVATe5dd1M_6808OsHhZVT506hRoAz5JXzs";

const createSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseKey, {
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

      console.log(
        `[article-access API] GET: Fetching accesses for article ${articleId}`,
      );

      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from("article_access")
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

      console.log(
        `[article-access API] GET: Found ${data?.length || 0} access records for article ${articleId}`,
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(data),
      };
    }

    if (method === "POST") {
      const { articleId, email, accessLevel, userId } = body;

      if (!articleId || !email || !accessLevel) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing required fields" }),
        };
      }

      const normalizedEmail = email.toLowerCase();

      console.log(
        `[article-access API] POST: Adding access for ${normalizedEmail} to article ${articleId}`,
      );

      // Generate a unique access token
      const accessToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const supabase = createSupabaseClient();

      // Check if this email already has access to this article
      const { data: existingAccess, error: checkError } = await supabase
        .from("article_access")
        .select("id")
        .eq("article_id", articleId)
        .eq("email", normalizedEmail)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        // PGRST116 = no rows returned (which is fine)
        console.error("Error checking existing access:", checkError);
      }

      if (existingAccess) {
        // Email already has access, update their level instead
        const { data: updatedData, error: updateError } = await supabase
          .from("article_access")
          .update({
            access_level: accessLevel,
          })
          .eq("id", existingAccess.id)
          .select();

        if (updateError) {
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: updateError.message }),
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(updatedData[0]),
        };
      }

      // Insert new access record
      const { data, error } = await supabase
        .from("article_access")
        .insert({
          article_id: articleId,
          email: normalizedEmail,
          access_level: accessLevel,
          access_token: accessToken,
        })
        .select();

      if (error) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: error.message }),
        };
      }

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(data[0]),
      };
    }

    if (method === "PATCH") {
      const { accessId, accessLevel } = body;

      if (!accessId || !accessLevel) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing required fields" }),
        };
      }

      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from("article_access")
        .update({ access_level: accessLevel })
        .eq("id", accessId)
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
      const { accessId } = body;

      if (!accessId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing accessId" }),
        };
      }

      const supabase = createSupabaseClient();
      const { error } = await supabase
        .from("article_access")
        .delete()
        .eq("id", accessId);

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
