/**
 * DEPRECATED: This file is no longer used.
 *
 * The webhook callback is now handled by:
 * - netlify/functions/api/webhook-callback.js (used by default via Netlify redirects)
 * - netlify/functions/api.ts (alternative handler)
 *
 * Do not use this file. It is kept for backward compatibility only.
 * All webhook requests to /api/webhook-callback are routed to the handlers above.
 */

export const handler = async (event, context) => {
  return {
    statusCode: 410,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      error: "This endpoint is deprecated. Use /api/webhook-callback instead.",
      status: "deprecated",
    }),
  };
};
