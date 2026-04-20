'use strict';

/**
 * Frontend API routes — ported from Netlify Functions.
 * These serve the meerkatv3 frontend's API needs (articles, comments,
 * team members, article access, revisions, etc.)
 */

const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Shared Supabase client (service role)
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return _supabase;
}

// ─── GET /api/articles ──────────────────────────────────────────────────────
router.get('/articles', async (req, res) => {
  try {
    const { data, error } = await getSupabase()
      .from('article_outlines')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── /api/article-access ────────────────────────────────────────────────────
router.get('/article-access', async (req, res) => {
  const { articleId } = req.query;
  if (!articleId) return res.status(400).json({ error: 'Missing articleId' });

  try {
    const { data, error } = await getSupabase()
      .from('article_access')
      .select('*')
      .eq('article_id', articleId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/article-access', async (req, res) => {
  const { articleId, email, accessLevel, userId } = req.body;
  if (!articleId || !email || !accessLevel) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const accessToken = crypto.randomBytes(32).toString('hex');
    const { data, error } = await getSupabase()
      .from('article_access')
      .upsert({
        article_id: articleId,
        email: email.toLowerCase(),
        access_level: accessLevel,
        created_by: userId,
        access_token: accessToken,
      }, { onConflict: 'article_id,email' })
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/article-access', async (req, res) => {
  const { accessId, accessLevel } = req.body;
  if (!accessId || !accessLevel) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const { data, error } = await getSupabase()
      .from('article_access')
      .update({ access_level: accessLevel })
      .eq('id', accessId)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/article-access', async (req, res) => {
  const { accessId } = req.body;
  if (!accessId) return res.status(400).json({ error: 'Missing accessId' });

  try {
    const { error } = await getSupabase()
      .from('article_access')
      .delete()
      .eq('id', accessId);

    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/verify-token ──────────────────────────────────────────────────
router.get('/verify-token', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  try {
    const { data, error } = await getSupabase()
      .from('article_access')
      .select('article_id, email')
      .eq('access_token', token)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Invalid or expired token' });
    res.json({ articleId: data.article_id, email: data.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── /api/comments ──────────────────────────────────────────────────────────
router.get('/comments', async (req, res) => {
  const { articleId } = req.query;
  if (!articleId) return res.status(400).json({ error: 'Missing articleId' });

  try {
    const { data, error } = await getSupabase()
      .from('article_comments')
      .select('*')
      .eq('article_id', articleId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/comments', async (req, res) => {
  const { articleId, userId, selectedText, comment, textPosition, section, userEmail } = req.body;
  if (!articleId || !comment) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const finalUserId = userEmail || userId || crypto.randomUUID();
    const { data, error } = await getSupabase()
      .from('article_comments')
      .insert({
        article_id: articleId,
        user_id: finalUserId,
        selected_text: selectedText || null,
        comment,
        text_position: textPosition || { section, userEmail },
      })
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/comments', async (req, res) => {
  const { commentId, resolved } = req.body;
  if (!commentId) return res.status(400).json({ error: 'Missing commentId' });

  try {
    const { data, error } = await getSupabase()
      .from('article_comments')
      .update({ resolved })
      .eq('id', commentId)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/comments', async (req, res) => {
  const { commentId } = req.body;
  if (!commentId) return res.status(400).json({ error: 'Missing commentId' });

  try {
    const { error } = await getSupabase()
      .from('article_comments')
      .delete()
      .eq('id', commentId);

    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── /api/team-members ──────────────────────────────────────────────────────
router.get('/team-members', async (req, res) => {
  try {
    const { data, error } = await getSupabase()
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/team-members', async (req, res) => {
  const { email, role } = req.body;
  if (!email || !role) return res.status(400).json({ error: 'Missing required fields' });
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  try {
    const supabase = getSupabase();

    // Try to find existing user
    let userId = null;
    try {
      const { data } = await supabase.auth.admin.listUsers();
      const found = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (found) userId = found.id;
    } catch {}

    // Check if already a team member
    const { data: existing } = await supabase
      .from('team_members')
      .select('id, user_id')
      .eq('email_address', email.toLowerCase());

    if (existing && existing.length > 0) {
      if (userId && !existing[0].user_id) {
        const { data: updated } = await supabase
          .from('team_members')
          .update({ user_id: userId })
          .eq('id', existing[0].id)
          .select();
        return res.json(updated[0]);
      }
      return res.json(existing[0]);
    }

    const { data, error } = await supabase
      .from('team_members')
      .insert({ user_id: userId, email_address: email.toLowerCase(), role })
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/team-members', async (req, res) => {
  const { memberId, role } = req.body;
  if (!memberId || !role) return res.status(400).json({ error: 'Missing required fields' });
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  try {
    const { data, error } = await getSupabase()
      .from('team_members')
      .update({ role })
      .eq('id', memberId)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/team-members', async (req, res) => {
  const { memberId } = req.body;
  if (!memberId) return res.status(400).json({ error: 'Missing memberId' });

  try {
    const { error } = await getSupabase()
      .from('team_members')
      .delete()
      .eq('id', memberId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── /api/public-shares ─────────────────────────────────────────────────────
router.get('/public-shares', async (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: 'Missing slug' });

  try {
    const { data, error } = await getSupabase()
      .from('public_shares')
      .select('*')
      .eq('slug', slug)
      .order('created_at', { ascending: false });

    if (error) return res.json([]);
    res.json(data || []);
  } catch {
    res.json([]);
  }
});

router.post('/public-shares', async (req, res) => {
  const { slug, clientName, keyword, email } = req.body;
  if (!slug || !clientName || !keyword || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { data, error } = await getSupabase()
      .from('public_shares')
      .insert({ slug, client_name: clientName, keyword, email: email.toLowerCase() })
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/public-shares', async (req, res) => {
  const { shareId } = req.body;
  if (!shareId) return res.status(400).json({ error: 'Missing shareId' });

  try {
    const { error } = await getSupabase()
      .from('public_shares')
      .delete()
      .eq('id', shareId);

    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── /api/delete-user ───────────────────────────────────────────────────────
router.delete('/delete-user', async (req, res) => {
  const { email, userId } = req.body;
  if (!email && !userId) return res.status(400).json({ error: 'Must provide email or userId' });

  try {
    const supabase = getSupabase();
    let userToDelete = null;

    if (userId) {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error || !data?.user) return res.status(404).json({ error: 'User not found' });
      userToDelete = data.user;
    } else {
      const { data } = await supabase.auth.admin.listUsers();
      userToDelete = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!userToDelete) return res.status(404).json({ error: 'User not found' });
    }

    const { error } = await supabase.auth.admin.deleteUser(userToDelete.id);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, deletedUser: { id: userToDelete.id, email: userToDelete.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── /api/delete-user-cascade ───────────────────────────────────────────────
router.delete('/delete-user-cascade', async (req, res) => {
  const { email, userId } = req.body;
  if (!email && !userId) return res.status(400).json({ error: 'Must provide email or userId' });

  try {
    const supabase = getSupabase();
    let userToDelete = null;

    if (userId) {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error || !data?.user) return res.status(404).json({ error: 'User not found' });
      userToDelete = data.user;
    } else {
      const { data } = await supabase.auth.admin.listUsers();
      userToDelete = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!userToDelete) return res.status(404).json({ error: 'User not found' });
    }

    const uid = userToDelete.id;
    const tables = ['team_members', 'article_outlines', 'article_comments', 'article_revisions',
                     'article_access', 'public_shares', 'client_folders', 'templates', 'webhook_logs'];

    for (const table of tables) {
      try {
        await supabase.from(table).delete().eq('user_id', uid);
      } catch {}
    }

    const { error } = await supabase.auth.admin.deleteUser(uid);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, deletedUser: { id: uid, email: userToDelete.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /get-article (was /.netlify/functions/get-article) ─────────────────
function findHtmlString(val, depth = 0) {
  if (!val || depth > 3) return null;
  if (typeof val === 'string') return val.includes('<') && val.length > 20 ? val : null;
  if (Array.isArray(val)) {
    for (const v of val) { const f = findHtmlString(v, depth + 1); if (f) return f; }
    return null;
  }
  if (typeof val === 'object') {
    for (const k of Object.keys(val)) { const f = findHtmlString(val[k], depth + 1); if (f) return f; }
  }
  return null;
}

function normalizeReceived(raw, updatedAt) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return { content: raw, title: null, meta: null, receivedAt: updatedAt || null }; }
  }
  if (typeof raw !== 'object') return null;
  const content = raw.content ?? raw.htmlContent ?? raw.html ?? findHtmlString(raw);
  return {
    content: typeof content === 'string' ? content : '',
    title: raw.title ?? raw.seoTitle ?? raw.seo_title ?? null,
    meta: raw.meta ?? raw.seoMetaDescription ?? raw.seo_meta_description ?? null,
    receivedAt: raw.receivedAt ?? raw.timestamp ?? raw.received_at ?? updatedAt ?? null,
  };
}

router.get('/get-article', async (req, res) => {
  const { id, clientName, keyword } = req.query;

  if (!id && (!clientName || !keyword)) {
    return res.status(400).json({ error: 'Article ID or (clientName and keyword) required' });
  }

  try {
    let data = null;
    if (id) {
      const result = await getSupabase().from('article_outlines').select('*').eq('article_id', id).maybeSingle();
      data = result.data;
    } else {
      const result = await getSupabase().from('article_outlines').select('*');
      if (result.data) {
        data = result.data.find(a =>
          a.client_name?.toLowerCase() === clientName.toLowerCase() &&
          a.keyword?.toLowerCase() === keyword.toLowerCase()
        ) || null;
      }
    }

    if (!data) return res.status(404).json({ error: 'Article not found' });

    let receivedArticle = normalizeReceived(data.received_article, data.updated_at);
    if (!receivedArticle || !receivedArticle.content) {
      receivedArticle = { content: data.html_content || '', title: data.seo_title || null, meta: data.seo_meta_description || null, receivedAt: data.created_at };
    }

    res.json({
      article: {
        id: data.article_id, articleId: data.article_id,
        clientName: data.client_name, clientId: data.client_id,
        keyword: data.keyword, template: data.template,
        sections: data.sections, receivedArticle,
        schema: data.schema, translations: data.translations,
        'word count': data['word count'], 'flesch score': data['flesch score'],
        'Page URL': data['Page URL'], 'URL Slug': data['URL Slug'],
        createdAt: data.created_at, updatedAt: data.updated_at, webhookSent: data.webhook_sent,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /get-article-revisions ─────────────────────────────────────────────
router.get('/get-article-revisions', async (req, res) => {
  const { article_id } = req.query;
  if (!article_id) return res.status(400).json({ error: 'Article ID is required' });

  try {
    const { data, error } = await getSupabase()
      .from('article_revisions')
      .select('*')
      .eq('article_id', article_id)
      .order('version_number', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ revisions: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST/PATCH /update-article ─────────────────────────────────────────────
router.post('/update-article', async (req, res) => {
  const { id, html_content, received_article, create_revision, word_count, flesch_score, schema } = req.body;

  if (!id || html_content === undefined) {
    return res.status(400).json({ error: 'Missing required fields: id, html_content' });
  }

  try {
    const supabase = getSupabase();

    // Create revision if requested
    if (create_revision) {
      try {
        const { data: current } = await supabase
          .from('article_outlines')
          .select('received_article, article_id')
          .eq('id', id)
          .single();

        if (current?.received_article?.content && current?.article_id) {
          const { data: revisions } = await supabase
            .from('article_revisions')
            .select('version_number')
            .eq('article_id', current.article_id)
            .order('version_number', { ascending: false })
            .limit(1);

          const nextVersion = (revisions?.[0]?.version_number || 0) + 1;
          await supabase.from('article_revisions').insert([{
            article_id: current.article_id,
            html_content: current.received_article.content,
            version_number: nextVersion,
            created_at: new Date().toISOString(),
          }]);
        }
      } catch (revErr) {
        console.error('Revision creation failed:', revErr.message);
      }
    }

    const mergedArticle = { ...received_article, content: html_content };
    const updatePayload = { received_article: mergedArticle, updated_at: new Date().toISOString() };
    if (word_count !== undefined) updatePayload['word count'] = word_count;
    if (flesch_score !== undefined) updatePayload['flesch score'] = flesch_score;
    if (schema !== undefined) updatePayload.schema = schema;

    const { data, error } = await supabase
      .from('article_outlines')
      .update(updatePayload)
      .eq('id', id)
      .select('id, received_article, updated_at, "word count", "flesch score", schema')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/update-article', async (req, res) => {
  const { articleId, field, value } = req.body;
  if (!articleId || !field) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const { data, error } = await getSupabase()
      .from('article_outlines')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('article_id', articleId)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
