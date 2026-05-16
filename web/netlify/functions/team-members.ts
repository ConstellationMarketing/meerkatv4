import { createClient } from "@supabase/supabase-js";

// Use service role key from environment, with fallback
const supabaseUrl = "https://cwligyakhxevopxiksdm.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZG90ZHB6bWpibXN4dW5jZmRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk3Mzg4MywiZXhwIjoyMDc4NTQ5ODgzfQ.lRHYJGEeuVATe5dd1M_6808OsHhZVT506hRoAz5JXzs";

// Create a fresh client for each request to avoid connection pooling issues
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
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

    // Handle the actual request method
    if (method === "GET") {
      console.log("🔍 Team members GET request");
      console.log("📍 Using Supabase URL:", supabaseUrl);
      console.log(
        "🔑 Using key type:",
        process.env.SUPABASE_SERVICE_KEY
          ? "ENV variable"
          : "Hardcoded fallback",
      );

      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Supabase error fetching team members:", {
          message: error.message,
          code: (error as any).code,
          details: (error as any).details,
        });
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            error: error.message,
            code: (error as any).code,
          }),
        };
      }

      console.log("✅ Successfully fetched team members:", {
        count: data?.length || 0,
        members:
          data?.map((m: any) => ({
            id: m.id,
            email: m.email_address,
            role: m.role,
            user_id: m.user_id,
          })) || [],
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(data),
      };
    }

    if (method === "POST") {
      const { email, role } = body;

      console.log("👤 Adding team member:", { email, role });

      if (!email || !role) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing required fields" }),
        };
      }

      if (!["admin", "member"].includes(role)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Invalid role" }),
        };
      }

      const supabase = createSupabaseClient();

      // Try to find an existing user by email and link them
      let userId: string | null = null;

      try {
        const response = await supabase.auth.admin.listUsers();
        const { data, error } = response;

        if (!error && data?.users) {
          const found = data.users.find(
            (u) => u.email?.toLowerCase() === email.toLowerCase(),
          );
          if (found?.id) {
            userId = found.id;
            console.log(
              `✅ Found existing user ${found.id} for email ${email}`,
            );
          }
        } else if (error) {
          console.warn("⚠️ Could not lookup existing users:", error);
        }
      } catch (err) {
        console.warn("⚠️ Could not lookup existing users:", err);
      }

      // Check if email already exists as a team member
      const { data: existingByEmail, error: existingError } = await supabase
        .from("team_members")
        .select("id, user_id")
        .eq("email_address", email.toLowerCase());

      if (existingError) {
        console.error("❌ Error checking existing member:", existingError);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: existingError.message }),
        };
      }

      if (existingByEmail && existingByEmail.length > 0) {
        const existing = existingByEmail[0];

        // If we found a user_id and the existing record doesn't have one, update it
        if (userId && !existing.user_id) {
          console.log("📝 Updating existing member with user_id");
          const { data: updatedData, error: updateError } = await supabase
            .from("team_members")
            .update({ user_id: userId })
            .eq("id", existing.id)
            .select();

          if (updateError) {
            console.error("❌ Error updating member:", updateError);
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

        // If it's the exact same user, return success (idempotent)
        console.log("ℹ️ Member already exists, returning existing record");
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(existingByEmail[0]),
        };
      }

      // Insert team member (user_id can be null if user hasn't signed up yet)
      console.log("➕ Creating new team member with userId:", userId);
      const { data: teamData, error: insertError } = await supabase
        .from("team_members")
        .insert({
          user_id: userId || null,
          email_address: email.toLowerCase(),
          role: role,
        })
        .select();

      if (insertError) {
        console.error("❌ Error inserting team member:", insertError);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: insertError.message }),
        };
      }

      console.log("✅ Team member created successfully");
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(teamData[0]),
      };
    }

    if (method === "PATCH") {
      const { memberId, role } = body;

      if (!memberId || !role) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing required fields" }),
        };
      }

      if (!["admin", "member"].includes(role)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Invalid role" }),
        };
      }

      const supabase = createSupabaseClient();
      const { data: updateData, error: updateError } = await supabase
        .from("team_members")
        .update({ role: role })
        .eq("id", memberId)
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
        body: JSON.stringify(updateData[0]),
      };
    }

    if (method === "DELETE") {
      const { memberId } = body;

      if (!memberId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing memberId" }),
        };
      }

      const supabase = createSupabaseClient();
      const { error: deleteError } = await supabase
        .from("team_members")
        .delete()
        .eq("id", memberId);

      if (deleteError) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: deleteError.message }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
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
