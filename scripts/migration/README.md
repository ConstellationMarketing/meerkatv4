# Master DB migration tooling

Migrates the entire old Meerkat Supabase project (`fcdotdpzmjbmsxuncfdg`) into
namespaced schemas in the master Constellation OS Supabase project
(`cwligyakhxevopxiksdm`), then retires the old project.

## Scope

34 tables across 5 destination schemas:

| Schema | Tables |
|---|---|
| `meerkat` | 11 source tables + new `public_shares` |
| `spr` | 11 |
| `super_audit` | 1 |
| `ai_visibility` | 1 |
| `os` | 10 (mostly empty scaffolding) |

Skipped (dead/disposable): `8_scoring_dimensions`, `webhook_logs`, `clients`,
`article_outlines_test`. See `config.js` for the canonical map and reasoning.

## Prerequisites

- `pg_dump` / `psql` installed locally (`brew install libpq && brew link --force libpq`)
- Node `pg` package (`npm install pg` in the meerkatv4 repo, already done)
- `.env` populated with `MEERKAT_PG_URL` and `MASTER_PG_URL` (Postgres direct connection
  strings, password URL-encoded)
- Master Supabase API exposes all 5 destination schemas (Project Settings → API →
  Exposed schemas)

## Run order

```sh
node scripts/migration/01-extract-source-ddl.js   # pg_dump full public schema → out/source-ddl.sql
node scripts/migration/02-transform-ddl.js        # rewrite to target schemas → out/master-ddl.sql
node scripts/migration/03-apply-ddl.js --reset    # drop+recreate target schemas in master
node scripts/migration/04-copy-data.js --truncate # copy rows old → master with UUID remap
node scripts/migration/05-verify.js               # 55-check parity + remap audit
```

End-to-end runs in ~10 seconds. Fully reproducible from any state.

## Files

| File | Purpose |
|---|---|
| `config.js` | Schema map, UUID remap, drop columns, skipped tables — single source of truth |
| `01-extract-source-ddl.js` | pg_dump of source public schema |
| `02-transform-ddl.js` | Rewrites public.* → schema.* + drops legacy "user ID" column |
| `03-apply-ddl.js` | Applies transformed DDL to master (`--reset` drops first) |
| `04-copy-data.js` | Streams rows old → master with UUID remap (`--truncate` clears first) |
| `05-verify.js` | 55 checks: row parity, remap correctness, deprecated user nullification, JSON integrity, trigger wiring |
| `code-changes.md` | Per-service `.env` + client init edits (6 services) |
| `cutover-playbook.md` | Sunday checklist with rollback plan |
| `out/` | Generated SQL artifacts (gitignored) |

## Key decisions encoded here

- **UUID remap** — 4 users have new UUIDs in master (Patrick, Lindsay, Omar,
  omaralcos2001). Their old UUIDs in source data are rewritten on copy.
- **Deprecated users** — `pc@goconstellation.com` and `krshnrydmn@gmail.com` haven't
  had activity in months. Dropped from `team_members`; their `user_id` refs in
  `article_outlines` are nulled (articles preserved, attribution lost).
- **Legacy column drop** — `article_outlines."user ID"` (with a space, slightly out of
  sync with `user_id`) is consolidated away during the DDL transform.
- **`public_shares` pre-created** — Live code path in production but the source
  table never existed (silently broken feature). DDL fresh-created in master.
- **Cross-schema helpers** — `set_updated_at()` and `log_templates_change()` trigger
  functions plus the `folder_type` enum stay in master `public` since they're called
  from triggers in multiple destination schemas.

## What this tooling does NOT do

- Decommission the old Meerkat Supabase project — keep it for ≥1 week as rollback.
- Migrate `auth.users` — already done in an earlier partial migration. The remap table
  in `config.js` reflects the actual UUID drift discovered 2026-05-01.
- Update sibling-service code (`meerkat-service`, `spr0-app`, etc.) — see
  `code-changes.md` for those manual edits.
- Repoint Netlify env vars for the frontend — see `code-changes.md`.
