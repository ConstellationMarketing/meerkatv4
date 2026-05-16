import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://cwligyakhxevopxiksdm.supabase.co";
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

export const handler = async (event: any) => {
  const corsHeaders: CorsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: "",
      };
    }

    if (event.httpMethod !== "DELETE") {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

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

    const { email, userId } = body;

    if (!email && !userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Must provide either email or userId",
        }),
      };
    }

    const supabase = createSupabaseClient();

    // Find the user to delete
    let userToDelete = null;

    if (userId) {
      console.log(`🔍 Searching for user by ID: ${userId}`);
      try {
        const response = await supabase.auth.admin.getUserById(userId);
        const { data, error } = response;

        if (error) {
          console.error(`❌ Error fetching user ${userId}:`, error);
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: "User not found" }),
          };
        }

        userToDelete = data.user;
      } catch (err) {
        console.error("❌ Error looking up user by ID:", err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Failed to look up user" }),
        };
      }
    } else if (email) {
      console.log(`🔍 Searching for user by email: ${email}`);
      try {
        const response = await supabase.auth.admin.listUsers();
        const { data, error } = response;

        if (error) {
          console.error("❌ Error listing users:", error);
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Failed to list users" }),
          };
        }

        if (data?.users) {
          userToDelete = data.users.find(
            (u) => u.email?.toLowerCase() === email.toLowerCase(),
          );
        }

        if (!userToDelete) {
          console.warn(`⚠️ User with email ${email} not found`);
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: "User not found" }),
          };
        }
      } catch (err) {
        console.error("❌ Error searching for user:", err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Failed to search for user" }),
        };
      }
    }

    if (!userToDelete) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    console.log(`📝 Removing user from Meerkat (team_members only): ${userToDelete.id} (${userToDelete.email})`);

    // Removes the user from Meerkat ONLY by deleting their team_members row.
    // Does NOT delete auth.users — that record is shared across every
    // Constellation OS app, and deleting here would lock the user out of
    // every other tool. Articles + comments stay intact.
    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("user_id", userToDelete.id);

      if (error) {
        console.error("❌ Error removing user from team_members:", error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            error: error.message || "Failed to remove user from Meerkat",
          }),
        };
      }

      console.log(
        `✅ Removed from Meerkat: ${userToDelete.id} (${userToDelete.email}). auth.users preserved.`,
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: `User ${userToDelete.email} has been removed from Meerkat. Their auth.users record is preserved (shared across all Constellation OS apps).`,
          removedFromMeerkat: {
            id: userToDelete.id,
            email: userToDelete.email,
          },
        }),
      };
    } catch (err) {
      console.error("❌ Unexpected error removing user:", err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: err instanceof Error ? err.message : "Failed to remove user",
        }),
      };
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
    };
  }
};
