'use strict';

const GITHUB_API = 'https://api.github.com';
const REPO = 'ConstellationMarketing/internal';
const BRANCH = 'main';
const BASE_PATH = 'meerkat';

const SHARED_STYLES = `
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap">
  <style>
    :root {
      --background: #faf6f6;
      --foreground: #0E3057;
      --card: #ffffff;
      --primary: #4fbc85;
      --primary-light: #78d5a5;
      --muted: #f3f4f4;
      --muted-foreground: #687684;
      --border: #e5e7e8;
      --radius: 12px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', ui-sans-serif, system-ui; background: var(--background); color: var(--foreground); max-width: 860px; margin: 0 auto; padding: 32px 24px; line-height: 1.7; }
    h1, h2, h3, h4 { font-family: 'Poppins', ui-sans-serif, system-ui; color: var(--foreground); font-weight: 600; margin: 1.5em 0 0.5em; }
    h1 { font-size: 1.75rem; }
    h2 { font-size: 1.35rem; }
    h3 { font-size: 1.1rem; }
    p { margin-bottom: 1em; }
    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .meta-bar { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 24px; margin-bottom: 40px; font-size: 13px; }
    .meta-bar h2 { font-size: 14px; font-weight: 600; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px; font-family: 'Inter', ui-sans-serif; }
    .meta-bar table { border-collapse: collapse; width: 100%; }
    .meta-bar td { padding: 5px 12px 5px 0; font-size: 13px; }
    .meta-bar td:first-child { font-weight: 500; color: var(--muted-foreground); white-space: nowrap; width: 110px; }
    .meta-bar td:last-child { color: var(--foreground); }
    .meta-badge { display: inline-block; background: var(--muted); color: var(--foreground); border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: 500; }
    .meta-badge.green { background: #e8f7f0; color: #2a7a54; }
    .meta-badge.yellow { background: #fef9e6; color: #8a6d00; }
    .meta-badge.red { background: #fde8e8; color: #8a1f1f; }
  </style>`;

function buildArticleHtml({ clientName, keyword, articleId, fleschScore, wordCount, pageUrl, htmlContent }) {
  const readabilityLabel = fleschScore >= 70 ? 'Good' : fleschScore >= 50 ? 'Fair' : 'Difficult';
  const badgeClass = fleschScore >= 70 ? 'green' : fleschScore >= 50 ? 'yellow' : 'red';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${clientName} — ${keyword}</title>
${SHARED_STYLES}
</head>
<body>
<div class="meta-bar">
  <h2>Meerkat &mdash; Claude Output Preview</h2>
  <table>
    <tr><td>Client</td><td>${clientName}</td></tr>
    <tr><td>Keyword</td><td>${keyword}</td></tr>
    <tr><td>Article ID</td><td><span class="meta-badge">${articleId}</span></td></tr>
    <tr><td>Flesch Score</td><td><span class="meta-badge ${badgeClass}">${fleschScore} — ${readabilityLabel}</span></td></tr>
    <tr><td>Word Count</td><td>${wordCount}</td></tr>
    <tr><td>Page URL</td><td>${pageUrl ? `<a href="${pageUrl}" target="_blank">${pageUrl}</a>` : '&mdash;'}</td></tr>
  </table>
</div>
${htmlContent}
</body>
</html>`;
}

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
        <td><a href="/meerkat/${a.slug}/" class="view-link">View &rarr;</a></td>
      </tr>`).join('');

  const emptyRow = `<tr><td colspan="4" class="empty">No articles yet — check back after the first article runs.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Meerkat — Generated Articles</title>
${SHARED_STYLES}
<style>
  body { max-width: 1000px; }
  .page-header { margin-bottom: 32px; }
  .page-header h1 { font-size: 1.5rem; margin: 0 0 4px; }
  .page-header p { color: var(--muted-foreground); font-size: 14px; margin: 0; }
  .table-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  thead { background: var(--muted); }
  th { text-align: left; padding: 12px 16px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-foreground); border-bottom: 1px solid var(--border); }
  td { padding: 14px 16px; border-bottom: 1px solid var(--border); color: var(--foreground); }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--muted); }
  .view-link { font-weight: 500; color: var(--primary); }
  .empty { color: var(--muted-foreground); font-style: italic; text-align: center; padding: 40px 16px; }
</style>
</head>
<body>
<div class="page-header">
  <h1>Meerkat — Generated Articles</h1>
  <p>${articles.length} article${articles.length !== 1 ? 's' : ''} generated</p>
</div>
<div class="table-card">
  <table>
    <thead>
      <tr>
        <th>Article</th>
        <th>Client</th>
        <th>Date</th>
        <th>Link</th>
      </tr>
    </thead>
    <tbody>${rows || emptyRow}
    </tbody>
  </table>
</div>
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
  const styledHtml = buildArticleHtml({ clientName, keyword, articleId, fleschScore, wordCount, pageUrl, htmlContent });
  const existingArticle = await getFile(articlePath);
  await putFile(
    articlePath,
    styledHtml,
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
