# Meerkat v4 — Changelog

A plain-English log of every meaningful change to the pipeline, prompts, and tooling.
Most recent changes appear at the top. Each entry links to the Pull Request for full technical detail.

---

## [Unreleased]
<!-- Changes that are drafted or approved but not yet merged -->

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
