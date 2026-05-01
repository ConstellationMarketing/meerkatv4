# Per-service code changes for cutover

Six services / repos touch Meerkat or master DB and need updates at cutover. Each is
listed below with the exact edits required, in the order they should land.

**Prerequisite (one-time, dashboard):** in master Supabase project (`cwligyakhxevopxiksdm`)
go to **Project Settings → API → Exposed schemas** and add `meerkat`, `spr`,
`super_audit`, `ai_visibility`, `os` to the comma-separated list (alongside `public`).
Without this, PostgREST returns "schema not found" for any non-public query.

---

## 1. meerkat-service (VPS, `/root/meerkat-service`)

**`.env`:**
```diff
-SUPABASE_URL=https://fcdotdpzmjbmsxuncfdg.supabase.co
-SUPABASE_KEY=<old anon/service key>
+SUPABASE_URL=https://cwligyakhxevopxiksdm.supabase.co
+SUPABASE_KEY=<master service role key>
```

**`lib/supabase.js:8-13`** — set default schema:
```diff
 _client = createClient(
   process.env.SUPABASE_URL,
-  process.env.SUPABASE_KEY
+  process.env.SUPABASE_KEY,
+  { db: { schema: 'meerkat' } }
 );
```

All `.from('article_outlines')` / `.from('client_folders')` / etc. calls then resolve
to `meerkat.<table>` automatically. No other code edits needed in this repo.

After deploy: `pm2 restart meerkat`.

---

## 2. spr0-app (VPS, `/root/spr0-app`) — multi-schema

This service touches **both** `spr.*` tables and `meerkat.client_folders`. Two options:

**Option A (recommended): default `spr`, explicit `.schema('meerkat')` for client_folders.**

`.env`:
```diff
-SUPABASE_URL=https://fcdotdpzmjbmsxuncfdg.supabase.co
-SUPABASE_SERVICE_KEY=<old service key>
+SUPABASE_URL=https://cwligyakhxevopxiksdm.supabase.co
+SUPABASE_SERVICE_KEY=<master service role key>
```

`lib/supabase.js`:
```diff
 const supabase = createClient(
   process.env.SUPABASE_URL,
-  process.env.SUPABASE_SERVICE_KEY
+  process.env.SUPABASE_SERVICE_KEY,
+  { db: { schema: 'spr' } }
 );
```

Then audit every `.from('client_folders')` call in this repo and prefix with
`.schema('meerkat')`. Sweep: `grep -rn "from('client_folders')" /root/spr0-app`.

After deploy: `pm2 restart spr0`.

---

## 3. super-audit-app (VPS, `/root/super-audit-app`) — raw axios

This service uses raw axios calls to `/rest/v1/super_audit_results`. Schema selection
on PostgREST is via the `Accept-Profile` (read) and `Content-Profile` (write) headers.

**`.env`:** same URL + key swap as above.

**`lib/supabase.js`:**
```diff
 const authHeaders = () => ({
   apikey: SUPABASE_KEY,
   Authorization: `Bearer ${SUPABASE_KEY}`,
+  'Accept-Profile': 'super_audit',
+  'Content-Profile': 'super_audit',
   'Content-Type': 'application/json',
 });
```

Apply that header object to every existing axios call in `lib/supabase.js`. Endpoint
paths stay the same (`/rest/v1/super_audit_results`).

After deploy: `pm2 restart super-audit`.

---

## 4. ai-visibility-app (VPS, `/root/ai-visibility-app`) — raw axios

Same shape as super-audit. Single table: `ai_visibility_runs`.

**`.env`:** URL + key swap.

**`lib/supabase.js`:**
```diff
 const authHeaders = () => ({
   apikey: SUPABASE_KEY,
   Authorization: 'Bearer ' + SUPABASE_KEY,
+  'Accept-Profile': 'ai_visibility',
+  'Content-Profile': 'ai_visibility',
   'Content-Type': 'application/json'
 });
```

After deploy: `pm2 restart ai-visibility`.

---

## 5. content-engine (VPS, `/root/content-engine`) — two clients

Touches both `meerkat.client_folders` (via `db/meerkat.js`) and `master.public.client_information`
(via `db/masterdb.js`). After cutover, master holds both — but they're in different schemas.

**`.env`:**
```diff
-MEERKAT_SUPABASE_URL=https://fcdotdpzmjbmsxuncfdg.supabase.co
-MEERKAT_SUPABASE_SERVICE_KEY=<old service key>
-MEERKAT_SUPABASE_ANON_KEY=<old anon key>
+MEERKAT_SUPABASE_URL=https://cwligyakhxevopxiksdm.supabase.co
+MEERKAT_SUPABASE_SERVICE_KEY=<master service role key>
+MEERKAT_SUPABASE_ANON_KEY=<master anon key>
```

(Leave `MASTER_DB_SUPABASE_URL` / `_ANON_KEY` unchanged — they already point at master
and `db/masterdb.js` queries `public.client_information` which stays in `public`.)

**`db/meerkat.js`** — set default schema on both clients:
```diff
-authClient = createClient(process.env.MEERKAT_SUPABASE_URL, process.env.MEERKAT_SUPABASE_ANON_KEY);
+authClient = createClient(process.env.MEERKAT_SUPABASE_URL, process.env.MEERKAT_SUPABASE_ANON_KEY,
+  { db: { schema: 'meerkat' } });
```
```diff
-dataClient = createClient(process.env.MEERKAT_SUPABASE_URL, key);
+dataClient = createClient(process.env.MEERKAT_SUPABASE_URL, key, { db: { schema: 'meerkat' } });
```

**`db/masterdb.js`:** no change. Already points at master and queries `public.client_information`.

**Auth caveat**: `signIn` uses Supabase auth via `MEERKAT_SUPABASE_URL`. Since we're
now pointing at master, users will authenticate against master's `auth.users` (which
already has the migrated entries). Patrick + the four remapped users have new UUIDs
in master — sessions issued by old Meerkat auth will not be valid against master and
users will need to log in once.

After deploy: `pm2 restart content-engine`.

---

## 6. meerkatv3 frontend (Netlify auto-deploy)

This is a separate repo (`meerkatv3-repo`) and Netlify auto-deploys on merge to main.

**Netlify env vars** (Site settings → Environment variables):
```
SUPABASE_URL          → https://cwligyakhxevopxiksdm.supabase.co
SUPABASE_KEY          → <master service role key>
VITE_SUPABASE_URL     → https://cwligyakhxevopxiksdm.supabase.co
VITE_SUPABASE_ANON_KEY→ <master anon key>
```

**`client/lib/supabase.ts`** — set default schema:
```diff
-export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
+export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY,
+  { db: { schema: 'meerkat' } });
```

**`server/supabase.ts`** — same treatment.

**Netlify functions (10 files)** — every `createClient(...)` call needs `{ db: { schema: 'meerkat' } }`:
- `netlify/functions/delete-user-cascade.ts`
- `netlify/functions/delete-user.ts`
- `netlify/functions/comments.ts`
- `netlify/functions/team-members.ts`
- `netlify/functions/get-article-original.ts`
- `netlify/functions/api/public-shares.ts`
- `netlify/functions/api/comments.ts`
- (plus any others surfaced by `grep -rln "createClient" netlify/functions`)

**Caveat:** `delete-user-cascade.ts` deletes from a hardcoded list of tables that
includes `webhook_logs` and `public_shares`. Before deploy, double-check that list
matches what's actually in `meerkat` schema (we kept `public_shares`, dropped `webhook_logs`).

After merge: Netlify auto-deploys.

---

## Cross-schema query reference

When a service needs to query a table that's NOT in its default schema:

```js
// JS client
client.schema('meerkat').from('client_folders').select('*');

// Raw axios
axios.get(`${SUPABASE_URL}/rest/v1/client_folders?...`, {
  headers: { ...authHeaders, 'Accept-Profile': 'meerkat' }
});
```

---

## Rollback (if anything breaks)

Every service's `.env` change is a single line revert. Old Meerkat Supabase project
stays running until cutover is verified end-to-end + at least one full week of
traffic. Don't decommission until that window passes.
