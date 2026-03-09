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

const LANG_LABELS = { es: '🇪🇸 Español', vi: '🇻🇳 Tiếng Việt' };
const ALL_LANGS = ['es', 'vi'];

function buildTranslationCell(article) {
  const t = article.translations || {};
  const doneLinks = ALL_LANGS
    .filter(lang => t[lang] === 'complete')
    .map(lang => `<a href="/meerkat/${article.slug}/${lang}/" class="lang-link">${LANG_LABELS[lang]}</a>`)
    .join(' ');

  const pendingLangs = ALL_LANGS.filter(lang => t[lang] === 'pending');
  const pendingBadges = pendingLangs
    .map(lang => `<span class="lang-pending">${LANG_LABELS[lang]} &hellip;</span>`)
    .join(' ');

  const untranslatedLangs = ALL_LANGS.filter(lang => !t[lang]);
  const translateBtn = untranslatedLangs.length > 0
    ? `<button class="translate-btn" onclick="showLangMenu(this,'${article.articleId}','${article.slug}')">Translate &#9662;</button>`
    : '';

  return `${doneLinks}${doneLinks && (pendingBadges || translateBtn) ? ' ' : ''}${pendingBadges}${pendingBadges && translateBtn ? ' ' : ''}${translateBtn}`;
}

function buildIndexHtml(articles) {
  // TRANSLATE_API_URL must be HTTPS for browser requests from an HTTPS page.
  // Set this env var once HTTPS is configured on the VPS (e.g. via Nginx + Let's Encrypt).
  const apiUrl = process.env.TRANSLATE_API_URL || 'http://45.55.248.2:3000';

  const sorted = [...articles].sort((a, b) => new Date(b.date) - new Date(a.date));

  const rows = sorted.map(a => `
      <tr data-article-id="${a.articleId}" data-slug="${a.slug}">
        <td><a href="/meerkat/${a.slug}/">${a.title}</a></td>
        <td>${a.clientName}</td>
        <td>${a.date}</td>
        <td><a href="/meerkat/${a.slug}/" class="view-link">View &rarr;</a></td>
        <td class="translation-cell">${buildTranslationCell(a)}</td>
      </tr>`).join('');

  const emptyRow = `<tr><td colspan="5" class="empty">No articles yet — check back after the first article runs.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Meerkat — Generated Articles</title>
${SHARED_STYLES}
<style>
  body { max-width: 1100px; }
  .page-header { margin-bottom: 32px; }
  .page-header h1 { font-size: 1.5rem; margin: 0 0 4px; }
  .page-header p { color: var(--muted-foreground); font-size: 14px; margin: 0; }
  .table-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  thead { background: var(--muted); }
  th { text-align: left; padding: 12px 16px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-foreground); border-bottom: 1px solid var(--border); }
  td { padding: 14px 16px; border-bottom: 1px solid var(--border); color: var(--foreground); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--muted); }
  .view-link { font-weight: 500; color: var(--primary); }
  .empty { color: var(--muted-foreground); font-style: italic; text-align: center; padding: 40px 16px; }
  .translation-cell { white-space: nowrap; }
  .lang-link { display: inline-block; font-size: 12px; font-weight: 500; color: var(--primary); background: #e8f7f0; border-radius: 6px; padding: 2px 8px; margin-right: 4px; text-decoration: none; }
  .lang-link:hover { background: #cdefdf; text-decoration: none; }
  .lang-pending { display: inline-block; font-size: 12px; color: var(--muted-foreground); background: var(--muted); border-radius: 6px; padding: 2px 8px; margin-right: 4px; }
  .translate-btn { font-size: 12px; font-weight: 500; background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 3px 10px; cursor: pointer; color: var(--foreground); }
  .translate-btn:hover { background: var(--muted); }
  .translate-btn:disabled { opacity: 0.6; cursor: default; }
  .lang-menu { display: inline-flex; gap: 6px; }
  .lang-menu button { font-size: 12px; font-weight: 500; background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 3px 10px; cursor: pointer; color: var(--foreground); }
  .lang-menu button:hover { background: var(--muted); }
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
        <th>View</th>
        <th>Translations</th>
      </tr>
    </thead>
    <tbody>${rows || emptyRow}
    </tbody>
  </table>
</div>
<script>
const API = '${apiUrl}';
const LANG_LABELS = { es: '🇪🇸 Español', vi: '🇻🇳 Tiếng Việt' };
const ALL_LANGS = ['es', 'vi'];

function showLangMenu(btn, articleId, slug) {
  const row = btn.closest('tr');
  const cell = btn.closest('.translation-cell');
  // Determine which langs are already done (have a link in the cell)
  const done = Array.from(cell.querySelectorAll('.lang-link')).map(el => {
    const href = el.getAttribute('href');
    return ALL_LANGS.find(l => href.includes('/' + l + '/'));
  }).filter(Boolean);
  const available = ALL_LANGS.filter(l => !done.includes(l));
  if (available.length === 0) { btn.remove(); return; }
  const menu = document.createElement('span');
  menu.className = 'lang-menu';
  available.forEach(lang => {
    const b = document.createElement('button');
    b.textContent = LANG_LABELS[lang];
    b.onclick = () => startTranslation(articleId, slug, lang, cell);
    menu.appendChild(b);
  });
  btn.replaceWith(menu);
}

async function startTranslation(articleId, slug, lang, cell) {
  const menu = cell.querySelector('.lang-menu');
  const btn = Array.from(menu.querySelectorAll('button')).find(b => b.textContent.includes(lang === 'es' ? 'Español' : 'Việt'));
  if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }
  try {
    const res = await fetch(API + '/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, language: lang })
    });
    if (!res.ok) throw new Error('Request failed');
    if (btn) btn.textContent = LANG_LABELS[lang] + ' …';
    pollStatus(articleId, slug, lang, cell);
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Error — retry'; }
  }
}

function pollStatus(articleId, slug, lang, cell) {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(API + '/translate/status?articleId=' + encodeURIComponent(articleId) + '&language=' + lang);
      const data = await res.json();
      if (data.status === 'complete') {
        clearInterval(interval);
        // Replace pending badge with link
        const pending = Array.from(cell.querySelectorAll('.lang-pending')).find(el => el.textContent.includes(lang === 'es' ? 'Español' : 'Việt'));
        const btn = Array.from(cell.querySelectorAll('button')).find(b => b.textContent.includes(lang === 'es' ? 'Español' : 'Việt'));
        const el = pending || btn;
        if (el) {
          const link = document.createElement('a');
          link.href = '/meerkat/' + slug + '/' + lang + '/';
          link.className = 'lang-link';
          link.textContent = LANG_LABELS[lang];
          el.replaceWith(link);
        }
      }
    } catch(e) { /* keep polling */ }
  }, 5000);
}
</script>
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

  // Remove existing entry for this articleId if regenerating — preserve translation status
  const existing_entry = articles.find(a => a.articleId === articleId);
  articles = articles.filter(a => a.articleId !== articleId);
  articles.push({
    articleId,
    clientName,
    title: keyword,
    slug,
    date,
    userId: userId || '',
    pageUrl,
    translations: existing_entry?.translations || {},
  });

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

/**
 * Publish a translated article page and update the manifest + index.
 */
async function publishTranslation({ articleId, language, config, slug, clientName, keyword, translatedHtml }) {
  if (!process.env.GITHUB_TOKEN) {
    console.log('[Translate] GITHUB_TOKEN not set — skipping publish');
    return null;
  }

  const translatedPath = `${BASE_PATH}/${slug}/${language}/index.html`;
  const manifestPath = `${BASE_PATH}/articles.json`;
  const indexPath = `${BASE_PATH}/index.html`;

  // Build the translated page HTML (same meta bar, translated content)
  const styledHtml = `<!DOCTYPE html>
<html lang="${config.htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${clientName} — ${keyword} (${config.label})</title>
${SHARED_STYLES}
</head>
<body>
<div class="meta-bar">
  <h2>Meerkat &mdash; ${config.label} Translation</h2>
  <table>
    <tr><td>Client</td><td>${clientName}</td></tr>
    <tr><td>Keyword</td><td>${keyword}</td></tr>
    <tr><td>Article ID</td><td><span class="meta-badge">${articleId}</span></td></tr>
    <tr><td>Language</td><td><span class="meta-badge">${config.label}</span></td></tr>
    <tr><td>English</td><td><a href="/meerkat/${slug}/">View English version &rarr;</a></td></tr>
  </table>
</div>
${translatedHtml}
</body>
</html>`;

  // ── 1. Push translated page ────────────────────────────────────────────────
  const existingTranslated = await getFile(translatedPath);
  await putFile(
    translatedPath,
    styledHtml,
    `Add translation: ${keyword} (${config.name})`,
    existingTranslated?.sha
  );
  console.log(`[Translate] Pushed: ${translatedPath}`);

  // ── 2. Update manifest with translation status ─────────────────────────────
  const manifestFile = await getFile(manifestPath);
  let articles = [];
  if (manifestFile && manifestFile.content) {
    articles = JSON.parse(Buffer.from(manifestFile.content, 'base64').toString('utf8'));
  }

  const idx = articles.findIndex(a => a.articleId === articleId);
  if (idx !== -1) {
    if (!articles[idx].translations) articles[idx].translations = {};
    articles[idx].translations[language] = 'complete';
  }

  await putFile(
    manifestPath,
    JSON.stringify(articles, null, 2),
    `Update manifest: ${keyword} (${config.name} translation)`,
    manifestFile?.sha
  );

  // ── 3. Rebuild index ───────────────────────────────────────────────────────
  const existingIndex = await getFile(indexPath);
  await putFile(
    indexPath,
    buildIndexHtml(articles),
    `Update index: ${keyword} (${config.name} translation)`,
    existingIndex?.sha
  );

  console.log(`[Translate] Index updated for ${language} translation of ${articleId}`);
  return `https://internal.goconstellation.com/meerkat/${slug}/${language}/`;
}

module.exports = { publishArticle, publishTranslation };
