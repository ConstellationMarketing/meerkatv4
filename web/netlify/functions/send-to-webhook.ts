type CorsHeaders = {
  [key: string]: string;
};

export const handler = async (event: any) => {
  const corsHeaders: CorsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

  if (event.httpMethod !== "POST") {
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
    console.error("[send-to-webhook] Error parsing body:", parseError);
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  try {
    const { data, sentAt, userCount, totalUneditedArticles } = body;

    if (!data) {
      console.error("[send-to-webhook] Missing data in request body");
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing data in request body" }),
      };
    }

    console.log(
      `[send-to-webhook] Received request with ${userCount} users and ${totalUneditedArticles} total unedited articles`
    );

    // Construct the webhook URL
    const webhookUrl =
      "https://n8n-14lp.onrender.com/webhook/decb968b-7b9c-4046-a18e-933c6879fb8c";

    console.log(`[send-to-webhook] Sending to webhook: ${webhookUrl}`);

    // Send to webhook with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let webhookResponse;
    try {
      webhookResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data,
          sentAt,
          userCount,
          totalUneditedArticles,
          source: "meerkat-editor",
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    console.log(
      `[send-to-webhook] Webhook response status: ${webhookResponse.status}`
    );

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error(
        `[send-to-webhook] Webhook error (${webhookResponse.status}):`,
        errorText
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: `Webhook returned ${webhookResponse.status}`,
          webhookStatus: webhookResponse.status,
          details: errorText,
          userCount,
          totalUneditedArticles,
        }),
      };
    }

    let webhookData;
    const responseText = await webhookResponse.text();
    console.log(
      `[send-to-webhook] Webhook response body: ${responseText.substring(0, 200)}`
    );

    try {
      webhookData = responseText ? JSON.parse(responseText) : {};
    } catch {
      webhookData = { raw: responseText };
    }

    console.log(
      `[send-to-webhook] Successfully sent ${userCount} users to webhook`
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: "Data sent to webhook successfully",
        userCount,
        totalUneditedArticles,
        sentAt,
        webhookResponse: webhookData,
      }),
    };
  } catch (error) {
    console.error(
      "[send-to-webhook] Unhandled error:",
      error instanceof Error ? error.message : String(error)
    );
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
