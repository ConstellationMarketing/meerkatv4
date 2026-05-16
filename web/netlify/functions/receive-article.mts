import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    if (!body.htmlContent || !body.clientName || !body.keyword) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: htmlContent, clientName, keyword",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Netlify.env.get("SUPABASE_URL");
    const supabaseKey =
      Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Netlify.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({
          error: "Server configuration error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const payloadData = {
      article_id: body.articleid || null,
      client_id: body.clientid || null,
      keyword: body.keyword,
      client_name: body.clientName,
      user_id: body.userId || null,
      received_article: {
        content: body.htmlContent,
        title: body.seoTitle || null,
        meta: body.seoMetaDescription || null,
        receivedAt: new Date().toISOString(),
      },
      seo_title: body.seoTitle || null,
      seo_meta_description: body.seoMetaDescription || null,
      content_summary: body.validationReport
        ? JSON.stringify(body.validationReport)
        : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Try to update existing record first (preserves userId from frontend)
    // If no record exists, insert a new one
    const articleId = body.articleid || body.id;

    // First, try to update the existing record
    let upsertResponse = await fetch(
      `${supabaseUrl}/rest/v1/article_outlines?id=eq.${articleId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=representation",
        },
        // Don't overwrite user_id if it already exists
        body: JSON.stringify({
          article_id: payloadData.article_id,
          client_id: payloadData.client_id,
          keyword: payloadData.keyword,
          client_name: payloadData.client_name,
          received_article: payloadData.received_article,
          seo_title: payloadData.seo_title,
          seo_meta_description: payloadData.seo_meta_description,
          content_summary: payloadData.content_summary,
          updated_at: payloadData.updated_at,
        }),
      },
    );

    let result: any;

    if (upsertResponse.ok) {
      // Existing record was updated
      result = await upsertResponse.json();
      console.log("✓ Article updated successfully:", {
        articleId,
        clientId: body.clientid,
        keyword: body.keyword,
        updated: true,
      });
    } else {
      // No existing record found by articleId
      // Try to find by clientName + keyword (in case outlineId wasn't passed)
      console.log("ℹ️ No existing record found by ID, searching by clientName + keyword...");

      let foundOutlineId: string | null = null;
      try {
        const searchParams = new URLSearchParams({
          client_name: `eq.${body.clientName}`,
          keyword: `eq.${body.keyword}`,
          select: "id,article_id,keyword,client_name",
        });

        const searchResponse = await fetch(
          `${supabaseUrl}/rest/v1/article_outlines?${searchParams}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
          },
        );

        if (searchResponse.ok) {
          const matchingOutlines = await searchResponse.json();
          console.log(`Found ${matchingOutlines.length} outlines matching client_name + keyword`);
          if (matchingOutlines.length > 0) {
            foundOutlineId = matchingOutlines[0].id;
            console.log(`Using outline ID: ${foundOutlineId}`);
          }
        }
      } catch (searchError) {
        console.warn(`Search by clientName+keyword failed:`, searchError);
      }

      // If found, update it; otherwise insert new
      if (foundOutlineId) {
        console.log(`Updating found outline: ${foundOutlineId}`);
        const updateResponse = await fetch(
          `${supabaseUrl}/rest/v1/article_outlines?id=eq.${foundOutlineId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              article_id: payloadData.article_id,
              client_id: payloadData.client_id,
              keyword: payloadData.keyword,
              client_name: payloadData.client_name,
              received_article: payloadData.received_article,
              seo_title: payloadData.seo_title,
              seo_meta_description: payloadData.seo_meta_description,
              content_summary: payloadData.content_summary,
              updated_at: payloadData.updated_at,
            }),
          },
        );

        if (!updateResponse.ok) {
          const errorData = await updateResponse.text();
          console.error("Supabase update error:", {
            status: updateResponse.status,
            body: errorData,
            foundOutlineId,
          });

          return new Response(
            JSON.stringify({
              error: "Failed to update article in database",
              details: errorData,
            }),
            {
              status: updateResponse.status,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        result = await updateResponse.json();
        console.log("✓ Article updated successfully (by clientName+keyword):", {
          foundOutlineId,
          articleId,
          keyword: body.keyword,
        });
      } else {
        // No existing record, insert a new one
        console.log("No outline found, inserting new article record");
        const insertResponse = await fetch(
          `${supabaseUrl}/rest/v1/article_outlines`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: "return=representation",
            },
            body: JSON.stringify(payloadData),
          },
        );

        if (!insertResponse.ok) {
          const errorData = await insertResponse.text();
          console.error("Supabase insert error:", {
            status: insertResponse.status,
            body: errorData,
            articleId,
          });

          return new Response(
            JSON.stringify({
              error: "Failed to insert article into database",
              details: errorData,
            }),
            {
              status: insertResponse.status,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        result = await insertResponse.json();
        console.log("✓ Article created successfully:", {
          articleId,
          clientId: body.clientid,
          keyword: body.keyword,
          userId: body.userId || "none",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Article processed successfully",
        data: result,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Webhook error:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = {
  path: "/api/webhook/receive-article",
};
