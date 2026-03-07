'use strict';

const DRIVE_FOLDER_ID = '1azI3ux5ctzJvszKPbo3wyhKFJ7sw9fwe';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';

async function getAccessToken() {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

function buildPreviewHtml({ clientName, keyword, articleId, fleschScore, wordCount, pageUrl, supabaseError, htmlContent }) {
  const readabilityLabel = fleschScore >= 70 ? 'Good' : fleschScore >= 50 ? 'Fair' : 'Difficult';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${clientName} - ${keyword} - Claude Preview</title>
<style>
  body { font-family: Georgia, serif; max-width: 860px; margin: 0 auto; padding: 24px; color: #222; }
  .meta-bar { background: #f0f4f8; border: 1px solid #d0d7e0; border-radius: 6px; padding: 16px 20px; margin-bottom: 32px; font-family: monospace; font-size: 13px; }
  .meta-bar h2 { margin: 0 0 8px; font-size: 15px; font-family: sans-serif; }
  .meta-bar table { border-collapse: collapse; width: 100%; }
  .meta-bar td { padding: 3px 12px 3px 0; }
  .meta-bar td:first-child { font-weight: bold; color: #555; white-space: nowrap; }
  h1, h2, h3 { color: #1a1a2e; } a { color: #0066cc; } p { line-height: 1.7; }
</style>
</head>
<body>
<div class="meta-bar">
  <h2>Meerkat &mdash; Claude Output Preview</h2>
  <table>
    <tr><td>Client</td><td>${clientName}</td></tr>
    <tr><td>Keyword</td><td>${keyword}</td></tr>
    <tr><td>Article ID</td><td>${articleId}</td></tr>
    <tr><td>Flesch Score</td><td>${fleschScore} (${readabilityLabel})</td></tr>
    <tr><td>Word Count</td><td>${wordCount}</td></tr>
    <tr><td>Page URL</td><td>${pageUrl || '&mdash;'}</td></tr>
    <tr><td>Supabase</td><td>${supabaseError ? 'Error: ' + supabaseError : 'Saved'}</td></tr>
  </table>
</div>
${htmlContent}
</body>
</html>`;
}

async function uploadToDrive({ clientName, keyword, articleId, fleschScore, wordCount, pageUrl, supabaseError, htmlContent }) {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    console.log('[Drive] GOOGLE_REFRESH_TOKEN not set — skipping upload');
    return null;
  }

  const accessToken = await getAccessToken();
  const html = buildPreviewHtml({ clientName, keyword, articleId, fleschScore, wordCount, pageUrl, supabaseError, htmlContent });
  const filename = `${clientName} - ${keyword} - Claude.html`;

  const metadata = JSON.stringify({
    name: filename,
    parents: [DRIVE_FOLDER_ID],
    mimeType: 'text/html'
  });

  const boundary = '-------meerkat_boundary_abc123';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
    `--${boundary}--`
  ].join('\r\n');

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`
    },
    body
  });

  const result = await res.json();
  if (!res.ok) throw new Error(`Drive upload failed: ${JSON.stringify(result)}`);

  console.log(`[Drive] Uploaded: ${result.name} — ${result.webViewLink}`);
  return result;
}

module.exports = { uploadToDrive };
