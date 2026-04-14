# Meerkat (v4)

> AI-powered legal article generation pipeline. Takes a topic brief and produces a compliance-checked, scored, link-inserted article — then publishes it to GitHub and Google Drive.

---

## What It Does

Full pipeline from brief to published article:
1. Receives a job via API (topic, client, keyword targets)
2. Drafts the article using Claude (Anthropic)
3. Applies legal compliance pass
4. Scores content quality
5. Inserts internal links
6. Uploads HTML preview to Google Drive
7. Publishes finished article to client GitHub repo

Triggered via n8n workflow or direct API call.

---

## Hosting

| Field | Value |
|-------|-------|
| **VPS** | `45.55.248.2` (DigitalOcean) |
| **VPS path** | `/root/meerkat-service/` |
| **Port** | `3000` |
| **Process manager** | PM2 cluster mode — service name: `meerkat` |

**Restart with env reload:** `pm2 restart meerkat --update-env`

---

## Tech Stack

| | |
|---|---|
| **Language** | JavaScript |
| **Runtime** | Node.js 22 |
| **Framework** | Express |
| **AI** | Anthropic Claude API (`@anthropic-ai/sdk`) |

---

## Repository

**GitHub:** https://github.com/ConstellationMarketing/meerkatv4

**Local clone:** `~/meerkat-service/`

---

## Database

| Field | Value |
|-------|-------|
| **Supabase project ref** | `fcdotdpzmjbmsxuncfdg` |
| **Production table** | `article_outlines` |
| **Test table** | `article_outlines_test` |

---

## Key Integrations

- **Anthropic Claude API** — article drafting and compliance
- **Google Drive** — HTML preview uploads via OAuth2 refresh token
- **GitHub** — publishes finished articles to client repos
- **n8n** — workflow `8MC0W3ht4IQE2CiJ` fires payload to VPS in parallel

---

## Project Structure

```
meerkat-service/
├── server.js
├── lib/
│   ├── article-compiler.js
│   ├── apply-compliance.js
│   ├── scoring.js
│   ├── insert-links.js
│   ├── drive-upload.js
│   ├── github-publish.js
│   ├── translate.js
│   └── supabase.js
└── package.json
```

---

## Environment Variables (names only)

`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GITHUB_TOKEN`

---

## Deployment

Auto-deploys on push to `main` via GitHub Actions.

```bash
# Manual deploy
ssh root@45.55.248.2 "cd /root/meerkat-service && git pull origin main && npm install --omit=dev && pm2 restart meerkat --update-env"

# Check status
ssh root@45.55.248.2 "pm2 status && pm2 logs meerkat --lines 50"
```

> Always use `--update-env` when `.env` has changed.

---

## Related

- **Wiki doc:** `wiki/infrastructure/infra-meerkat.md`
- **Google Drive folder:** `1azI3ux5ctzJvszKPbo3wyhKFJ7sw9fwe`
