'use strict';

// Single source of truth for the migration: which tables go into which destination schema in master.
// Tables NOT listed here are deliberately skipped — see SKIP_REASONS.

const SCHEMA_MAP = {
  meerkat: [
    'article_outlines',
    'article_access',
    'article_comments',
    'article_revisions',
    'batch_jobs',
    'client_folders',
    'editing_feedback',
    'team_members',
    'templates',
    'templates_history',
    'timer_and_feedbacks',
  ],
  spr: [
    'citations_master_db',
    'spr0_actions',
    'spr0_checkboxes',
    'spr0_report_data',
    'spr1_report_data',
    'spr_playbook_ads',
    'spr_playbook_cs',
    'spr_playbook_operations',
    'spr_playbook_sales',
    'spr_playbook_web',
    'technical_check_actions',
  ],
  super_audit: ['super_audit_results'],
  ai_visibility: ['ai_visibility_runs'],
  os: [
    'os_feedback',
    'os_votes',
    'chat_messages',
    'admin_prompts',
    'external_automations',
    'teams',
    'folders',
    'folder_teams',
    'workflow_folders',
    'page_types',
  ],
};

const SKIP_REASONS = {
  '8_scoring_dimensions': 'dead UI, sample data only (2 rows of literal "SAMPLE")',
  webhook_logs: 'n8n callback path is deprecated',
  clients: 'never used (0 rows)',
  article_outlines_test: 'pre-cutover test table, superseded by article_outlines',
};

// New tables to create directly in master (no source data) — currently just public_shares
// which is referenced from active code paths but the table never existed in old Meerkat.
const NEW_TABLES = {
  meerkat: {
    public_shares: `
      CREATE TABLE meerkat.public_shares (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug text NOT NULL,
        client_name text,
        keyword text,
        email text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX public_shares_slug_idx ON meerkat.public_shares (slug);
      CREATE INDEX public_shares_email_idx ON meerkat.public_shares (email);
    `,
  },
};

// UUID remap: old Meerkat auth.users.id → master auth.users.id.
// Sourced from a manual cross-reference of emails 2026-05-01.
// Users mapped to null are deprecated (latest activity months ago) — drop their team_members
// rows and null their user_id refs in article_outlines. Articles themselves are migrated.
const USER_REMAP = {
  // patrick@goconstellation.com
  'cf227556-3724-408c-967a-b60d551b0624': 'c43529d0-4466-4059-bfba-057a6388df9c',
  // lindsay@goconstellation.com
  '666c10a0-8495-4ecc-9283-d730dfc709df': '1ccba90e-f406-4877-b9fa-b42642d2e481',
  // omar@goconstellation.com
  'ebbc9b12-40d0-4f36-ab45-20dabbead9b6': 'ec0d4641-f835-4384-abf9-d2e8724e490c',
  // omaralcos2001@gmail.com
  'c4ac35ba-c7c9-446e-9f46-b8b4b94696db': '543dd336-8a2a-4773-860b-72eb868d199b',
  // pc@goconstellation.com — deprecated, latest activity 2026-03-09
  '11be8e75-b353-419d-8f7d-4e811297e1e7': null,
  // krshnrydmn@gmail.com — deprecated, latest activity 2026-01-08
  '23905832-40b7-4fff-8d89-168bdf04374a': null,
  // roamthewriter@gmail.com — no rows reference this id, no remap needed
};

// Drop these team_members rows entirely (the user is being skipped).
const DROP_TEAM_MEMBERS_FOR_USERS = [
  '11be8e75-b353-419d-8f7d-4e811297e1e7', // pc@
  '23905832-40b7-4fff-8d89-168bdf04374a', // krshnrydmn@
];

// Schema transformations applied during the DDL rewrite step.
const DDL_TRANSFORMS = {
  // article_outlines has dual user columns (user_id clean + "user ID" legacy with a space).
  // Consolidate to user_id only — drop "user ID" during DDL load.
  drop_columns: {
    article_outlines: ['user ID'],
  },
};

function allInScopeTables() {
  const out = [];
  for (const [schema, tables] of Object.entries(SCHEMA_MAP)) {
    for (const t of tables) out.push({ schema, table: t });
  }
  return out;
}

module.exports = {
  SCHEMA_MAP,
  SKIP_REASONS,
  NEW_TABLES,
  USER_REMAP,
  DROP_TEAM_MEMBERS_FOR_USERS,
  DDL_TRANSFORMS,
  allInScopeTables,
};
