// DISABLED 2026-05-06.
//
// Previously did a hard delete of auth.users + cascaded into article_outlines,
// article_comments, article_revisions, article_access, public_shares,
// client_folders, etc. After the master DB cutover that's catastrophically
// destructive — auth.users is shared with every Constellation OS app, and
// cascading destroys article history.
//
// To remove a user from Meerkat, use DELETE /api/delete-user (removes from
// meerkat.team_members only; auth.users + articles are preserved).
//
// To truly purge a user across all OS apps, do it in the Supabase dashboard
// with full awareness of the blast radius.

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

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  return {
    statusCode: 410,
    headers: corsHeaders,
    body: JSON.stringify({
      error: "Endpoint disabled.",
      reason:
        "Hard-deleted auth.users (shared across all Constellation OS apps) and cascade-destroyed articles.",
      use_instead:
        "DELETE /api/delete-user (removes from meerkat.team_members only).",
    }),
  };
};
