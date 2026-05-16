// Netlify Function — /api/chat
// Server-side proxy for the AI Assistant chat tool in the article editor.
// Replaces the dead n8n webhook the frontend used to call.
//
// Keeps the OpenRouter API key on the server (env var OPENROUTER_API_KEY)
// so it never ships to the browser. The frontend's existing AIAssistantSidePanel
// only changes its fetch URL — the request/response shape stays compatible.
//
// Request:  POST { message: string, sessionId?: string }
// Response: { output: string }  (200) or { error: string } (4xx/5xx)

type CorsHeaders = {
  [key: string]: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Model id on OpenRouter. Kimi K2 is the cheap default. Swap to
// `anthropic/claude-sonnet-4.6` for higher quality.
const MODEL = "moonshotai/kimi-k2";

const SYSTEM_PROMPT = `You are an editing assistant inside Meerkat, an article editor for law firm content.

Help the writer improve their article. Common asks include:
- Improving readability and grammar
- Making content more engaging
- Changing tone and style
- Reorganizing sections
- Expanding or condensing content

Reply in plain prose with practical edits and short examples. Be concise.`;

export const handler = async (event: any) => {
  const corsHeaders: CorsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
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
    if (event.body) body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  const message = String(body?.message || "").trim();
  if (!message) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "message is required" }),
    };
  }
  if (message.length > 8000) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "message too long (max 8000 chars)" }),
    };
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error("[chat] OPENROUTER_API_KEY env var is missing");
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Server misconfigured: missing OPENROUTER_API_KEY" }),
    };
  }

  try {
    const r = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://meerkatv3.netlify.app",
        "X-Title":       "Meerkat",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: message      },
        ],
      }),
    });

    const text = await r.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* keep null */ }

    if (!r.ok) {
      const msg =
        (json && (json.error?.message || json.error || json.message)) ||
        text || r.statusText;
      console.error("[chat] OpenRouter error:", r.status, msg);
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({
          error: `OpenRouter ${r.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`,
        }),
      };
    }

    const output = String(json?.choices?.[0]?.message?.content || "").trim();
    if (!output) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: "OpenRouter returned an empty response" }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ output }),
    };
  } catch (err: any) {
    console.error("[chat] fetch failed:", err);
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || "OpenRouter call failed" }),
    };
  }
};
