// Netlify Function — exposes /health for the OS Health Check Bot Worker.
//
// Why a Netlify Function: Netlify only serves the built SPA + Functions,
// so without this the monitor's probe of /health fell through to the SPA
// fallback and got HTML instead of JSON (red flag on every run).
//
// netlify.toml's /health redirect routes here. Serves the canonical
// contract from the OS repo's wiki/infra-health-protocol.md:
//   { ok: true, ts: <epoch ms>, build: <tag>, env: { KEY: bool, ... } }
// Boolean env-var presence only — never the values.

const BUILD_TAG = "meerkatv4-2026-06-11";

export const handler = async () => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ok: true,
    ts: Date.now(),
    build: BUILD_TAG,
    env: {
      SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
      OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
      VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: !!process.env.VITE_SUPABASE_ANON_KEY,
    },
  }),
});
