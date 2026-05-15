# Merge meerkatv3 into meerkatv4 — playbook

One-time migration to consolidate the Meerkat frontend (`meerkatv3`) into the
backend repo (`meerkatv4`) under a `web/` subdirectory. Outcome: single repo,
single source of truth, no more "companion PR" friction across cross-cutting
changes.

History is preserved via `git read-tree` (subtree-style import). meerkatv3's
full commit history will live under `web/` going forward.

## Why subdirectory and not flat-at-root

Both repos have files that share names but mean different things:
`package.json`, `tsconfig.json`, `server/` (in v3) vs `server.js` (in v4),
`.gitignore`, `node_modules/`, etc. Flat-at-root requires hand-merging those.
Subdirectory sidesteps all collisions cleanly.

## Pre-flight

- Pick a quiet window. Editor won't be available during the ~5 min Netlify
  re-point gap.
- Confirm no open PRs on meerkatv3 (close or migrate any first).
- Confirm Netlify dashboard access (you'll switch the site's repo source).

## Steps

### 1. Pull meerkatv3 into meerkatv4 under `web/`

```sh
cd ~/meerkatv4
git checkout main && git pull
git checkout -b feat/merge-meerkatv3

git remote add v3 https://github.com/ConstellationMarketing/meerkatv3.git
git fetch v3 main
git read-tree --prefix=web/ -u v3/main
git commit -m "Merge meerkatv3 into web/ subdirectory (history preserved via subtree)"
git remote remove v3

git push -u origin feat/merge-meerkatv3
gh pr create --title "Merge meerkatv3 into web/ subdirectory" --body "..."
```

`git read-tree --prefix=web/` imports every file from v3's main branch into
the `web/` directory of the working tree. The follow-up `git commit` records
it as one merge commit on this branch. History from v3 stays accessible via
`git log -- web/` and `git blame web/<file>`.

### 2. Reconfigure Netlify

In the Netlify dashboard for the meerkatv3 site:

1. **Site settings → Build & deploy → Continuous deployment → Edit settings**
2. **Repository**: change from `ConstellationMarketing/meerkatv3` to
   `ConstellationMarketing/meerkatv4`
3. **Base directory**: `web`
4. **Build command + Publish directory**: should auto-pick up from
   `web/netlify.toml`. Verify they read sensibly (build = `pnpm run
   build:client`, publish = `dist/spa`).

Don't trigger a production deploy yet — we'll verify on the PR branch first.

### 3. Verify on PR branch (do NOT merge to main yet)

In the Netlify dashboard:

1. **Deploys → Trigger deploy → Deploy from branch** → select
   `feat/merge-meerkatv3`.
2. When it succeeds, open the deploy preview URL.
3. **Verify**:
   - Frontend loads (sidebar, articles list)
   - Log in flow works
   - `/api/team-members` returns data
   - One article opens in the editor
   - Save an edit and confirm it lands in master

If any of those fail, **do not merge**. Options to revert:
- Don't merge the PR
- Re-point Netlify back to `meerkatv3` repo + clear Base directory
- Old setup is unaffected

### 4. Merge + cutover

1. Merge `feat/merge-meerkatv3` PR.
2. Netlify auto-deploys main from meerkatv4 (now with `web/` as base directory).
3. Verify the production site at `os.goconstellation.com` and
   `meerkatv3.netlify.app`:
   - Same checks as step 3
   - Watch Netlify build log for any new errors

### 5. Archive meerkatv3 (after 1-week soak)

Don't archive immediately. Wait at least a week with the unified setup
running. Then:

1. GitHub → meerkatv3 repo → **Settings → Archive this repository**
2. Optional: rename to `meerkatv3-legacy` for clarity

Archive is reversible; deletion is not. Don't delete.

## Post-merge cleanup (optional, separate PRs)

Things you can clean up after the merge stabilizes — none are blocking:

- **Move backend files into `service/`** (or keep at root). Pure
  organizational. If you do this, update VPS deploy.yml to `cd
  /root/meerkat-service/service`.
- **Hoist `netlify.toml` to root** with `web/`-prefixed paths, drop the
  Netlify "Base directory" override. Net-neutral; reduces dashboard config.
- **pnpm workspaces** to share types between `web/` and root. Wins when you
  add shared TypeScript types between front and back.
- **Single ESLint/Prettier config** at root that both halves use. Style
  consistency.

## Rollback (if something breaks post-merge)

1. **Netlify**: re-point Repository back to `meerkatv3` + clear Base
   directory. Triggers a fresh deploy from old code.
2. **GitHub**: the merge commit on meerkatv4 main can be reverted via PR if
   needed, but Netlify rollback alone restores frontend behavior.
3. **VPS backend**: untouched by this migration. No rollback needed for
   backend.

## Why this is safe

- Backend (`meerkat-service` on VPS) is untouched. Continues running from
  meerkatv4 root.
- Frontend deploy mechanism (Netlify) is untouched conceptually — same
  `netlify.toml`, same build command, same functions dir. Only the
  repository source changes.
- Subtree merge preserves history. No data loss.
- Old meerkatv3 repo stays as-is until you archive it. Always available as
  rollback target for ≥1 week.
