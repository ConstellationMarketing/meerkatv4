-- Guard trigger: block DELETE on master.auth.users.
--
-- Installed 2026-05-07 after the master DB cutover revealed that auth.users is
-- shared infrastructure across every Constellation OS app — and a SQL cleanup
-- session (May 5 22:09 UTC) had silently deleted 5 active users + orphaned
-- 200 of their articles. After the cutover, app-level cascade-delete buttons
-- were defanged in meerkatv4 PR #56 + meerkatv3 PR #40, but a direct SQL
-- delete from the Supabase SQL editor (or any postgres-role connection)
-- bypasses those defangs. This trigger closes that gap.
--
-- Allowed deleters: only `supabase_auth_admin` — the role Supabase's own auth
--   service runs as. So calling `auth.admin.deleteUser()` via the Supabase API
--   still works.
-- Blocked: everything else (`postgres` role direct SQL, the Supabase SQL
--   editor, scripts using the service role key via a postgres client, etc.).
--
-- To intentionally delete a user (rare, deliberate operation):
--   ALTER TABLE auth.users DISABLE TRIGGER block_auth_user_deletes;
--   DELETE FROM auth.users WHERE ...;
--   ALTER TABLE auth.users ENABLE TRIGGER block_auth_user_deletes;
-- Or use the Supabase Auth API which runs as supabase_auth_admin.
--
-- This file is idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION public.block_auth_user_deletes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF session_user = 'supabase_auth_admin' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION
    'auth.users DELETE blocked by guard trigger. Master is shared across every Constellation OS app — direct deletions here cascade into tools beyond the one initiating. To intentionally delete: ALTER TABLE auth.users DISABLE TRIGGER block_auth_user_deletes; <delete>; ALTER TABLE auth.users ENABLE TRIGGER block_auth_user_deletes; (or use the Supabase Auth API which runs as supabase_auth_admin).';
END;
$$;

DROP TRIGGER IF EXISTS block_auth_user_deletes ON auth.users;
CREATE TRIGGER block_auth_user_deletes
BEFORE DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.block_auth_user_deletes();
