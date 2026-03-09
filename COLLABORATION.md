# Collaboration Workflow
*This section is for the full team — no technical background required to follow this process.*

---

## The Golden Rule

**Nobody pushes directly to `main`.** All changes go through a Pull Request so they can be reviewed and approved before going live. This keeps the process visible, reversible, and collaborative.

---

## How a Change Gets Made: End to End

### Step 1 — Log the idea as a GitHub Issue

Before any code is written, the proposed change lives as a **GitHub Issue**. An Issue is just a structured note describing a problem and a proposed fix.

Anyone on the team can open one. You don't need to know how to code.

Go to: `https://github.com/ConstellationMarketing/meerkatv4/issues/new`

A good Issue answers:
- What's the problem? (e.g. "FAQ sections are consuming 30-40% of article word count")
- What's the proposed fix? (e.g. "Cap FAQ at 25% of word count, max 5 questions")
- Where does this come from? (e.g. "Editor feedback — 6 of 13 articles flagged this")

Label it appropriately (`prompt-change`, `bug`, `needs-review`, etc.) so it's easy to triage.

---

### Step 2 — Developer makes the change on a branch

The developer (Eli) picks up the Issue and makes the edit on a **branch** — a separate copy of the codebase that doesn't affect the live pipeline.

Branch names follow this format:
```
fix/ban-links-in-headings
fix/cap-faq-word-count
improve/anti-repetition-rules
```

---

### Step 3 — Pull Request opened for review

When the change is ready, a **Pull Request (PR)** is opened. A PR is a page on GitHub that shows:
- Exactly what lines changed (a "diff" — red = removed, green = added)
- A plain-English description of what changed and why (filled in via our PR template)
- Which Issue it closes

Patrick or any designated reviewer gets notified by email.

**You don't need to read the code.** Read the description, check the "Expected impact" and "How to verify" fields, and either approve or leave a comment.

---

### Step 4 — Approve and merge

Once approved, the developer merges the PR into `main`. GitHub Actions automatically deploys the change to the live server within ~15 seconds.

The Issue linked in the PR closes automatically.

---

### Step 5 — Update the CHANGELOG

After merging, the developer adds a plain-English entry to `CHANGELOG.md` — a running log of every change that anyone on the team can read without touching GitHub.

---

## Issue Labels

| Label | Meaning |
|---|---|
| `prompt-change` | Edit to a file in `/prompts/` |
| `template-fix` | Change to required section structure |
| `bug` | Something broken that needs fixing |
| `needs-review` | Proposed but not yet assigned |
| `in-progress` | Being worked on |
| `on-hold` | Parked — not ready to act on yet |

---

## Branch Protection

The `main` branch is protected. Merging without an approved Pull Request is blocked. This is intentional — it ensures nothing goes live without a review, and that every change is logged and traceable.

---

## Viewing the Live Pipeline

- **GitHub repo:** `https://github.com/ConstellationMarketing/meerkatv4`
- **Open Issues (proposed changes):** `https://github.com/ConstellationMarketing/meerkatv4/issues`
- **Merged PRs (change history):** `https://github.com/ConstellationMarketing/meerkatv4/pulls?q=is%3Amerged`
- **CHANGELOG (plain English log):** `CHANGELOG.md` in the repo root
- **Live deploy status:** `https://github.com/ConstellationMarketing/meerkatv4/actions`
