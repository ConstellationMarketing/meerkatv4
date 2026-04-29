-- ─────────────────────────────────────────────────────────────────────────────
-- Templates history / backup
-- ─────────────────────────────────────────────────────────────────────────────
-- Triggered by: Apr 27/28 incident where most rows in `templates` were
-- silently wiped by app code. This adds a Postgres-level safety net so future
-- destructive changes are recoverable.
--
-- What this does:
--   1. Creates a `templates_history` table that stores a snapshot of any row
--      in `templates` immediately before it is updated or deleted.
--   2. Adds a trigger on `templates` that fires on UPDATE and DELETE (NOT
--      INSERT — there's no prior state worth backing up for a new row) and
--      writes the OLD row to `templates_history`.
--   3. Seeds `templates_history` with the current state of `templates` as
--      operation='BASELINE' so we have a starting point even before any
--      future change fires the trigger.
--
-- Behavior on backup write failure:
--   The trigger fires AFTER the UPDATE/DELETE in the SAME transaction. If the
--   trigger's INSERT into `templates_history` ever fails (disk full, lock
--   contention, etc.), the original UPDATE/DELETE rolls back too. This is
--   intentional fail-closed behavior — no destructive change goes through
--   without a recoverable copy being written first.
--
-- How to run:
--   Open Supabase Dashboard → SQL Editor → paste this whole file → Run.
--   Idempotent — safe to re-run.
--
-- How to recover a row later:
--   Use scripts/restore-template.js (recommended) or run manually:
--     SELECT row_data FROM templates_history
--       WHERE template_id = 'X'
--       ORDER BY changed_at DESC
--       LIMIT 1;
--   Then re-INSERT (or UPSERT) into `templates`.
--
-- How to roll back this setup (if needed):
--   DROP TRIGGER IF EXISTS templates_audit ON templates;
--   DROP FUNCTION IF EXISTS log_templates_change();
--   DROP TABLE IF EXISTS templates_history;
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. History table
CREATE TABLE IF NOT EXISTS templates_history (
  id BIGSERIAL PRIMARY KEY,
  template_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('UPDATE', 'DELETE', 'BASELINE')),
  row_data JSONB NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by TEXT
);

CREATE INDEX IF NOT EXISTS templates_history_template_id_idx
  ON templates_history (template_id, changed_at DESC);

-- 2. Trigger function — writes the OLD row to history
CREATE OR REPLACE FUNCTION log_templates_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO templates_history (template_id, operation, row_data, changed_by)
  VALUES (
    OLD.id,
    TG_OP,
    to_jsonb(OLD),
    COALESCE(auth.uid()::text, 'service_role_or_unknown')
  );
  RETURN COALESCE(NEW, OLD);  -- NEW for UPDATE; OLD for DELETE (NEW is null)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger (UPDATE + DELETE only — no INSERT)
DROP TRIGGER IF EXISTS templates_audit ON templates;
CREATE TRIGGER templates_audit
  AFTER UPDATE OR DELETE ON templates
  FOR EACH ROW EXECUTE FUNCTION log_templates_change();

-- 4. Seed BASELINE entries for current rows so we have a starting point
INSERT INTO templates_history (template_id, operation, row_data, changed_by)
SELECT
  t.id,
  'BASELINE',
  to_jsonb(t),
  'setup_script'
FROM templates t
WHERE NOT EXISTS (
  -- Idempotent: don't double-seed if this script is re-run
  SELECT 1 FROM templates_history h
  WHERE h.template_id = t.id AND h.operation = 'BASELINE'
);
