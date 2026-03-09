# Meerkat v4 — Changelog

A plain-English log of every meaningful change to the pipeline, prompts, and tooling.
Most recent changes appear at the top. Each entry links to the Pull Request for full technical detail.

---

## [Unreleased]
<!-- Changes that are drafted or approved but not yet merged -->

---

## March 9, 2026 — Translation Pipeline (Patrick Carver)

- Added Spanish and Vietnamese translation for any generated article
- Translations triggered from the article index table via a "Translate ▾" dropdown button
- Translation runs async on the VPS via Claude Haiku — neutral Latin American Spanish, Southern Vietnamese dialect, tone matched to source article
- Translated pages published to GitHub at `/meerkat/{slug}/es/` and `/meerkat/{slug}/vi/`
- Translation status stored as JSONB in the `translations` column of `article_outlines_test`
- Status polling updates the index table in real-time (translating… → clickable link)
- Re-translation supported — clicking a language that's already translated overwrites it cleanly
- Cloudflare Tunnel configured on VPS (`meerkat-api.goconstellation.com`) so the browser can call the VPS API from the HTTPS index page

---

## March 9, 2026 — Initial Build (Patrick Carver)

- Launched Meerkat v4 as a parallel Claude Code-based pipeline running alongside the existing n8n workflow
- Sections generated in parallel via Claude Sonnet with Flesch readability scoring and auto-retry
- Legal compliance check added as a dedicated pipeline step
- Articles saved to Supabase (article_outlines_test) and HTML previews uploaded to Google Drive
- Auto-deploy via GitHub Actions on every push to main, with automatic rollback on failed health checks

---

## How to Read This File

Each entry describes:
- **What changed** — the prompt, pipeline step, or behavior that was modified
- **Why** — the editor feedback issue or decision that drove the change
- **PR** — a link to the Pull Request with full technical detail

---

## How to Add an Entry

When you merge a PR, add a new dated section at the top of this file (above [Unreleased]) with a plain-English summary. Keep it short — two or three lines per change is enough. Link to the PR number.
