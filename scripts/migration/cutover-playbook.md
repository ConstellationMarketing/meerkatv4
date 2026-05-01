# Cutover playbook (Sunday)

Goal: switch every service from old Meerkat Supabase (`fcdotdpzmjbmsxuncfdg`) to master
(`cwligyakhxevopxiksdm`) with under ~10 minutes of write downtime.

## Pre-cutover (do these on a weekday, well before Sunday)

1. **Expose new schemas in master's API.** Master Supabase dashboard → Project Settings
   → API → Exposed schemas → add `meerkat,spr,super_audit,ai_visibility,os` to the list.
   Save. (One-time.)
2. **Reset master DDL+data once.** Run `01 → 02 → 03 --reset → 04 --truncate → 05`.
   Confirms the pipeline is reproducible from a blank slate.
3. **Pre-stage code changes.** For each of the 6 services in `code-changes.md`,
   prepare the diff but do NOT merge/deploy yet. PRs ready, awaiting trigger.
4. **Notify the team.** Heads-up that batch generation + editing will be unavailable
   during the cutover window. Pick a low-traffic Sunday morning.

## Cutover window (Sunday, ~30 min total)

### T-0: freeze writes (1 min)
Stop all VPS services that write to old Meerkat. From the VPS:
```sh
pm2 stop meerkat spr0 super-audit ai-visibility content-engine
```
The Netlify frontend will still be up — users will see the editor but saves will fail.
Acceptable for the window length. (Alternative: put up a maintenance page first.)

### T-1: final data sync (3-5 min)
Some rows may have been written to old Meerkat in the gap between the last test
sync and write-freeze. Re-run the data copy fresh:
```sh
cd ~/meerkatv4
node scripts/migration/01-extract-source-ddl.js
node scripts/migration/02-transform-ddl.js
node scripts/migration/03-apply-ddl.js --reset
node scripts/migration/04-copy-data.js --truncate
node scripts/migration/05-verify.js
```
Confirm all 55 verify checks pass. **If any fail, abort cutover, restart pm2 services,
investigate.**

### T-6: deploy code changes
For each of the 5 VPS services + meerkatv3 frontend, in this order:
1. **meerkatv3 frontend** — merge PR with createClient schema config + Netlify env var
   updates. Netlify deploy ~2 min.
2. **meerkat-service** — merge PR. VPS auto-deploy via GitHub Action. Update VPS .env
   in lockstep (env vars on VPS aren't part of the repo). Then `pm2 restart meerkat`.
3. **spr0-app** — same pattern.
4. **super-audit-app** — same pattern.
5. **ai-visibility-app** — same pattern.
6. **content-engine** — merge + restart.

For each service, watch `pm2 logs <service>` for 30 seconds after restart. Anything
that says `relation "<table>" does not exist` or `schema "..." not found` means
either the schema isn't exposed in the API, the schema wasn't set on the client, or
a `.from('xxx')` call is hitting the wrong schema.

### T-15: smoke test
- Frontend loads, can list articles
- Open one article in editor, make a change, save → verify the row updated in
  master meerkat.article_outlines (NOT old Meerkat)
- Trigger one batch upload validation flow → verify it lists clients (master
  meerkat.client_folders)
- Spot check one ai-visibility run save → verify lands in master ai_visibility.ai_visibility_runs

If any test fails, **rollback** by reverting .env changes per service and
`pm2 restart` — old Meerkat is still running and accepts writes.

### T-25: confirmation + cleanup
- Post in team chat: cutover complete, master is live, old Meerkat is read-only.
- DO NOT delete the old Meerkat Supabase project for at least 1 week. Keep it as
  emergency rollback.

## Post-cutover (within the next week)

- Monitor for any references to the deprecated Meerkat URL in error logs across all
  services. Anything that surfaces is a forgotten code path.
- Decommission `webhook-handler.ts` Netlify function (n8n callback path). Clean PR.
- Drop the orphan `ArticleScoreCard.tsx` (the dead UI for `8_scoring_dimensions`). Clean PR.
- Audit `team_members` rows in master for any new users that were added during
  cutover and need to also exist in master `auth.users`.
- After 1 week of healthy operation, archive the old Meerkat Supabase project.

## Rollback plan (if anything goes catastrophic)

Per-service rollback is single-line .env revert + `pm2 restart`. Old Meerkat is
fully operational and unchanged. Frontend rollback is reverting the Netlify env vars
+ triggering a redeploy.

The migration is non-destructive on the source side: nothing is deleted from old
Meerkat. The "cutover" is purely repointing reads and writes; rolling back means
repointing again.
