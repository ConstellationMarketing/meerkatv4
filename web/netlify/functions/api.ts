// This file has been moved to webhook-handler.ts to avoid conflicts with the api/ subdirectory functions.
// The netlify.toml redirects are configured to route /api/webhook* to webhook-handler.ts
export const handler = () => ({
  statusCode: 404,
  body: JSON.stringify({ error: "This handler has been moved" }),
});
