# Meerkat v4 — Developer Guide

## What This Is

Meerkat is a Node.js service that generates SEO articles for legal clients using the Claude API. It runs in parallel with an existing n8n workflow, writing outputs to a separate Supabase table (`article_outlines_test`) for quality comparison before full cutover.

When an article job is triggered from the web app, the n8n workflow (Meerkatv3.3) fires the payload simultaneously to both the original pipeline and this service. This service generates the article, saves it to Supabase, and uploads a styled HTML preview to Google Drive.

---

## Stack

- **Runtime:** Node.js 22
- **Framework:** Express
- **AI:** Anthropic Claude API (`@anthropic-ai/sdk`)
- **Database:** Supabase (`@supabase/supabase-js`)
- **Process manager (VPS):** PM2
- **Deploy:** GitHub Actions → VPS via SSH

---

## Repository

```
https://github.com/ConstellationMarketing/meerkatv4.git
```

---

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/ConstellationMarketing/meerkatv4.git ~/meerkat-service
cd ~/meerkat-service
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `.env`

Copy `.env.example` to `.env` and fill in the values (get from 1Password — stored as "Meerkat v4 .env"):

```
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_TABLE=article_outlines_test
PORT=3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
```

`GOOGLE_*` vars are only needed for Drive uploads. The pipeline skips Drive silently if `GOOGLE_REFRESH_TOKEN` is not set.

### 4. Run locally

```bash
npm run dev      # auto-restarts on file changes
# or
npm start
```

Service runs at `http://localhost:3000`.

---

## Project Structure

```
meerkat-service/
├── server.js               # Express server, routes
├── pipeline.js             # Main article generation pipeline
├── lib/
│   ├── article-compiler.js # Combines section HTML into full article
│   ├── apply-compliance.js # Applies legal compliance fixes to HTML
│   ├── drive-upload.js     # Google Drive OAuth2 + file upload
│   ├── insert-links.js     # Injects external/internal links into HTML
│   ├── scoring.js          # Flesch readability + word count scoring
│   └── supabase.js         # Supabase upsert helper
├── prompts/                # Markdown prompt templates for each Claude call
│   ├── section-writer.md
│   ├── external-links.md
│   ├── internal-links.md
│   ├── title-meta.md
│   ├── legal-compliance.md
│   ├── schema-generator.md
│   └── slug-url.md
├── .env.example
├── ecosystem.config.js     # PM2 config (VPS only)
└── .github/workflows/
    └── deploy.yml          # GitHub Actions auto-deploy
```

---

## API

### `GET /`
Health check.
```json
{ "status": "ok", "service": "meerkat-service", "table": "article_outlines_test" }
```

### `POST /generate`
Triggers article generation. Responds immediately with `202 Accepted` — generation runs async in the background.

**Required fields:**
```json
{
  "articleid": "string",
  "clientId": "string",
  "clientName": "string",
  "clientInfo": "string",
  "website": "https://example.com",
  "keyword": "personal injury lawyer atlanta",
  "sections": [
    {
      "sectionNumber": 1,
      "details": "Intro section covering...",
      "wordCount": 200
    }
  ],
  "template": "optional",
  "userId": "optional"
}
```

**Response:**
```json
{ "status": "accepted", "articleId": "abc123", "message": "Article generation started." }
```

Results are written to Supabase and an HTML preview is uploaded to Google Drive.

---

## Pipeline Steps

All steps run in `pipeline.js`. The order:

1. **Section generation** — each section sent to Claude Sonnet in parallel, with up to 2 retries if Flesch score < 70
2. **Compile HTML** — sections joined into full article HTML
3. **Parallel enrichment** — external links, internal links, and title/meta generated simultaneously via Claude Haiku
4. **Merge links** — links injected into HTML
5. **Legal compliance** — Claude Sonnet scans for compliance violations, `applyCompliance()` removes flagged content
6. **Parallel: schema + slug** — JSON-LD schema and URL slug generated simultaneously
7. **Score article** — Flesch readability score and word count calculated
8. **Supabase upsert** — full article record saved to `article_outlines_test`
9. **Drive upload** — styled HTML preview uploaded to Google Drive folder `1azI3ux5ctzJvszKPbo3wyhKFJ7sw9fwe`

---

## Prompts

All Claude prompts live in `/prompts/` as markdown files. Each uses `SYSTEM:` and `USER:` sections with `{{placeholder}}` variables filled at runtime. To change how Claude writes sections, edit `prompts/section-writer.md`. To change link behavior, edit `prompts/external-links.md` or `prompts/internal-links.md`.

---

## Development Workflow

1. Make changes locally
2. Test if needed: `npm run dev` and POST to `/generate`
3. Push to `main`:
   ```bash
   git add -A && git commit -m "describe change" && git push
   ```
4. GitHub Actions auto-deploys to VPS in ~15 seconds

No manual SSH required for deploys.

---

## Deployment

**VPS:** `45.55.248.2` — Node.js 22, PM2 process named `meerkat`

**Auto-deploy flow (GitHub Actions):**
- Triggers on every push to `main`
- SSHs into VPS, runs `git pull && npm install --production && pm2 restart meerkat --update-env`
- Health checks `http://localhost:3000/` up to 5 times
- Rolls back to previous commit automatically if health check fails

**Manual deploy (if needed):**
```bash
ssh root@45.55.248.2
cd /root/meerkat-service
git pull
npm install --production
pm2 restart meerkat --update-env
```

**View live logs:**
```bash
ssh root@45.55.248.2 "pm2 logs meerkat --lines 50"
```

---

## Rollback

GitHub Actions rolls back automatically on failed health checks. To manually revert to a previous version:

```bash
git revert <commit-hash>
git push
```

Full commit history: `https://github.com/ConstellationMarketing/meerkatv4/commits/main`

---

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase service role key |
| `SUPABASE_TABLE` | Table to write to (default: `article_outlines_test`) |
| `PORT` | Server port (default: 3000) |
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret |
| `GOOGLE_REFRESH_TOKEN` | OAuth2 refresh token with `drive.file` scope |

---

## n8n Integration

The service is called from the **Meerkatv3.3** workflow on n8n (`https://n8n-14lp.onrender.com`, workflow ID `8MC0W3ht4IQE2CiJ`). A node called **"VPS Generate"** fires a parallel POST to `http://45.55.248.2:3000/generate` with the same payload the Webhook node receives, with `continueOnFail: true` so n8n never breaks if the VPS is unreachable.

The original n8n pipeline writes to `article_outlines`. This service writes to `article_outlines_test`. Both run on every article job.
