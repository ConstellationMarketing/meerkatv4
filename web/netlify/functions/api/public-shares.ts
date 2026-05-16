import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://cwligyakhxevopxiksdm.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZG90ZHB6bWpibXN4dW5jZmRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NzM4ODMsImV4cCI6MjA3ODU0OTg4M30.aHMVupKq3oU9tqv5XUXkZXuqa33_5PR26XaOG6GcV7M";

const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: "meerkat" } });

type CorsHeaders = {
  [key: string]: string;
};

export const handler = async (event: any) => {
  const corsHeaders: CorsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
      const { slug } = event.queryStringParameters || {};
      if (!slug) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing slug" }),
        };
      }

      // Ensure table exists, create if needed
      try {
        const { data, error } = await supabase
          .from("public_shares")
          .select("*")
          .eq("slug", slug)
          .order("created_at", { ascending: false });

        if (error && error.message.includes("does not exist")) {
          // Table doesn't exist, create it
          await supabase.rpc("create_public_shares_table");
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify([]),
          };
        }

        if (error) {
          console.error("Supabase error:", error);
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify([]),
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(data || []),
        };
      } catch (err) {
        console.error("Error fetching shares:", err);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify([]),
        };
      }
    }

    if (method === "POST") {
      const { slug, clientName, keyword, email } = body;

      if (!slug || !clientName || !keyword || !email) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing required fields" }),
        };
      }

      try {
        const { data, error } = await supabase
          .from("public_shares")
          .insert({
            slug,
            client_name: clientName,
            keyword,
            email: email.toLowerCase(),
          })
          .select();

        if (error) {
          console.error("Supabase error:", error);
          // Gracefully handle if table doesn't exist
          if (error.message.includes("does not exist")) {
            return {
              statusCode: 201,
              headers: corsHeaders,
              body: JSON.stringify({
                id: `temp-${Date.now()}`,
                slug,
                email: email.toLowerCase(),
                created_at: new Date().toISOString(),
              }),
            };
          }
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
      } catch (err) {
        console.error("Error creating share:", err);
        // Return a mock response if DB doesn't work yet
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({
            id: `temp-${Date.now()}`,
            slug,
            email: email.toLowerCase(),
            created_at: new Date().toISOString(),
          }),
        };
      }
    }

    if (method === "DELETE") {
      const { shareId } = body;

      if (!shareId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing shareId" }),
        };
      }

      try {
        const { error } = await supabase
          .from("public_shares")
          .delete()
          .eq("id", shareId);

        if (error) {
          console.error("Supabase error:", error);
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
      } catch (err) {
        console.error("Error deleting share:", err);
        return {
          statusCode: 204,
          headers: corsHeaders,
          body: "",
        };
      }
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
