# Meerkat v4 — Changelog

A plain-English log of every meaningful change to the pipeline, prompts, and tooling.
Most recent changes appear at the top. Each entry links to the Pull Request for full technical detail.

---

## [Unreleased]
<!-- Changes that are drafted or approved but not yet merged -->

---

## v4.0.3 — March 30, 2026 — Feedback-Driven Quality Improvements

Based on analysis of 10 V4 editor feedback submissions (avg 68 min edit time vs 60 min target). Structural/formatting issues from V3 are resolved — remaining feedback is content quality.

- **Word count enforcement** — sections now retry if output is under 80% of target word count, not just on Flesch score. Addresses thin articles (500–970 words) that required near-complete rewrites. (PR #18)
- **Intro filler ban** — prohibited "this guide will walk you through..." closers and article meta-commentary that editors were consistently deleting. (PR #18)
- **Lead with the point** — banned emotional filler openers ("Facing criminal charges can be daunting...") that buried substantive information. First sentence of every paragraph must contain actionable content. (PR #18)
- **Why Choose Us / What to Expect personalization** — these sections now require specific client details (attorney names, credentials, selling points) and jurisdiction-specific legal process steps. No generic trust language when client info is available. (PR #18)
- **Supporting page section gating** — "Why Choose Us" no longer appears on supporting/resource pages. Caught in both section generation and article review. (PR #18)
- **Format checker** — warns when client info is empty so editors know personalization sections will be generic. (PR #18)
- **Feedback data fixes** — fixed "Unknown Article" bug in feedback form by using `title_tag` as primary title source (meerkatv3 PR #9). Backfilled 6 feedback entries with correct titles and V4.0.2 version. Fixed section data overwrite issue where editor saves were clearing pipeline section instructions (meerkatv3 PR #10).

---

## March 9, 2026 — Translation Pipeline (Patrick Carver)

- Added Spanish and Vietnamese translation for any generated article
- Translations triggered from the article index table via a "Translate ▾" dropdown button
- Translation runs async on the VPS via Claude Haiku — neutral Latin American Spanish, Southern Vietnamese dialect, tone matched to source article
- Translated pages published to GitHub at `/meerkat/{slug}/es/` and `/meerkat/{slug}/vi/`
- Translation status stored as JSONB in the `translations` column of `article_outlines`
- Status polling updates the index table in real-time (translating… → clickable link)
- Re-translation supported — clicking a language that's already translated overwrites it cleanly
- Cloudflare Tunnel configured on VPS (`meerkat-api.goconstellation.com`) so the browser can call the VPS API from the HTTPS index page

---

## March 9, 2026 — Initial Build (Patrick Carver)

- Launched Meerkat v4 as a parallel Claude Code-based pipeline running alongside the existing n8n workflow
- Sections generated in parallel via Claude Sonnet with Flesch readability scoring and auto-retry
- Legal compliance check added as a dedicated pipeline step
- Articles saved to Supabase (article_outlines) and HTML previews uploaded to Google Drive
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
