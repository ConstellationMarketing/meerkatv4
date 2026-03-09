'use strict';

const GITHUB_API = 'https://api.github.com';
const REPO = 'ConstellationMarketing/internal';
const BRANCH = 'main';
const BASE_PATH = 'meerkat';

async function githubRequest(method, path, body) {
  const res = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

async function getFile(path) {
  const res = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${path}?ref=${BRANCH}`, {
    headers: {
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (res.status === 404) return null;
  return res.json();
}

async function putFile(path, content, message, sha) {
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: BRANCH
  };
  if (sha) body.sha = sha;
  return githubRequest('PUT', path, body);
}

function buildIndexHtml(articles) {
  const rows = articles
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(a => `
      <tr>
        <td><a href="/meerkat/${a.slug}/">${a.title}</a></td>
        <td>${a.clientName}</td>
        <td>${a.date}</td>
        <td><a href="/meerkat/${a.slug}/">View</a></td>
      </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Meerkat — Generated Articles</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 1000px; margin: 40px auto; padding: 0 24px; color: #222; }
  h1 { font-size: 22px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; padding: 10px 12px; background: #f4f6f8; border-bottom: 2px solid #ddd; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; }
  tr:hover td { background: #fafafa; }
  a { color: #0066cc; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
<h1>Meerkat — Generated Articles</h1>
<table>
  <thead>
    <tr>
      <th>Article</th>
      <th>Client</th>
      <th>Date</th>
      <th>Link</th>
    </tr>
  </thead>
  <tbody>${rows}
  </tbody>
</table>
</body>
</html>`;
}

async function publishArticle({ articleId, clientName, keyword, slug, htmlContent, fleschScore, wordCount, pageUrl, userId }) {
  if (!process.env.GITHUB_TOKEN) {
    console.log('[Publish] GITHUB_TOKEN not set — skipping publish');
    return null;
  }

  const date = new Date().toISOString().split('T')[0];
  const articlePath = `${BASE_PATH}/${slug}/index.html`;
  const manifestPath = `${BASE_PATH}/articles.json`;
  const indexPath = `${BASE_PATH}/index.html`;

  // ── 1. Get or create manifest ──────────────────────────────────────────────
  const manifestFile = await getFile(manifestPath);
  let articles = [];
  if (manifestFile && manifestFile.content) {
    articles = JSON.parse(Buffer.from(manifestFile.content, 'base64').toString('utf8'));
  }

  // Remove existing entry for this articleId if regenerating
  articles = articles.filter(a => a.articleId !== articleId);
  articles.push({ articleId, clientName, title: keyword, slug, date, userId: userId || '', pageUrl });

  // ── 2. Push article HTML ───────────────────────────────────────────────────
  const existingArticle = await getFile(articlePath);
  await putFile(
    articlePath,
    htmlContent,
    `Add article: ${keyword} (${clientName})`,
    existingArticle?.sha
  );
  console.log(`[Publish] Pushed article: ${articlePath}`);

  // ── 3. Push updated manifest ───────────────────────────────────────────────
  await putFile(
    manifestPath,
    JSON.stringify(articles, null, 2),
    `Update manifest: ${keyword}`,
    manifestFile?.sha
  );

  // ── 4. Push updated index ──────────────────────────────────────────────────
  const existingIndex = await getFile(indexPath);
  await putFile(
    indexPath,
    buildIndexHtml(articles),
    `Update index: ${keyword}`,
    existingIndex?.sha
  );
  console.log(`[Publish] Index updated (${articles.length} articles)`);

  const articleUrl = `https://internal.goconstellation.com/meerkat/${slug}/`;
  console.log(`[Publish] Live at: ${articleUrl}`);
  return articleUrl;
}

module.exports = { publishArticle };
