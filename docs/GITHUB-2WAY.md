# Two-way GitHub, and the UI audit that came with it

*Session July 4, 2026.*

## Why

Lovable treats "someone edited the code outside our tool" as an edge case to
discourage — it cuts against their hosting business. We want the opposite:
building your project in Claude Code (or any editor) and building it in the
Relational Builder should be the *same* project, and moving between them should
feel normal and supported. No lock-in is one of the Builder's structural
advantages; this makes it real instead of aspirational.

The genuinely hard part isn't moving files — it's that after code arrives from
outside, a builder can't always tell **what they still need to do by hand**.
Migrations don't run themselves. Edge functions need a redeploy. New code may
reference settings that don't exist yet. So the Builder now says so, in plain
language, every time it pulls.

## What shipped

### Change awareness (the ambient part)
- `github-store` now keys repo connections **per project** (`local` or the
  cloud project id), migrated from the old single global connection. A repo
  follows a local project into the cloud when it's first saved.
- `GitHubChangesBanner` watches the connected repo — on focus, and every ~4
  min — comparing the branch head against the last SHA the Builder synced.
  When GitHub is ahead, a calm banner appears in chat: "3 new commits from
  Josh — pull them in." Dismissible ("Later" remembers that head SHA).

### Smart pull (the safe part)
- `pullRemoteChanges` takes a **checkpoint first** (one tap back to before the
  pull), then applies **only what the diff names** — added/modified files
  fetched at the new head, renamed files moved, removed files deleted. Binary
  files are skipped (the VFS is text-only), never the repo's business.
- First sync / rewritten history (force-push, rebase) falls back to a full
  overlay that **never silently deletes** local-only work.
- **Overlap detection**: if a file changed in the Builder *and* on GitHub since
  the last sync, GitHub wins (last-writer, no merge) but the pull says which
  files, and the pre-pull checkpoint has the Builder version.

### The story in chat
- Every pull posts a `isSync` assistant message: which commits landed and from
  whom, which files updated/removed, any overlaps — and then the important
  part, **"Before this all works, you may need to:"**
- These notes live in chat history, so the AI knows the project changed outside
  the Builder too (role-alternation is preserved by merging consecutive
  same-role messages before sending).

### "What do I still need to do" — deterministic, no guessing
`analyzeActionsNeeded` reads the changed files and flags the known seams:
- **Migrations** (`supabase/migrations/*.sql`) → "run this in your SQL editor",
  with a deep link to the project's SQL editor when the Supabase URL is known.
- **Edge functions** (`supabase/functions/<name>/`) → "redeploy `<name>`".
- **Missing settings** — env keys referenced in the new code (`env.X`,
  `import.meta.env.X`, `process.env.X`) that have no value in the workspace yet
  → "add them under Services → Environment" (common false positives excluded).
- **`package.json` changed** → "the preview reloads; check it still renders."

Verified against fixture scenarios: migration + edge-fn + new secret + deps all
detected; known keys and `MODE`/`NODE_ENV`-style tokens excluded; removed files
ignored.

### Push safety
- Push now builds on the parent tree (`base_tree`), so it **adds and updates
  without deleting** files that live only in the repo (README, workflows, docs
  written in Claude Code).
- Before pushing, the Builder checks whether GitHub is ahead. If it is: "GitHub
  has 2 commits the Builder hasn't seen — pull first, or push anyway."

## UI audit — simpler surface, power on reveal

Josh's brief: the Builder should feel simple and intuitive, with power *in* it,
revealed when something specific is happening. The desktop toolbar had grown to
~13 competing controls. Changes made this session:

1. **StudioSwitcher hides when there's no choice.** RT Studio is the default
   frame for everyone now and Thread/Bloom are hidden — so the switcher was a
   non-actionable label taking toolbar space. It now renders only when there's
   more than one studio, or a non-default one is deep-linked in.
2. **Import Plan + Remix → one "Start from…" menu.** The primary way to start is
   the composer and the Studio gallery on the home screen. Importing a plan and
   forking a tool's code are quieter, less-common starts — folded into a single
   unobtrusive menu (two buttons → one).
3. **Theme + Models/API keys fold into the account menu.** Community builders
   are auto-steered to a model and never touch API keys; the standalone Settings
   and theme icons were noise for them. They now live in the account dropdown,
   and only appear as standalone toolbar icons when nobody's signed in (the
   BYOK-likely case) or cloud is off.
4. **Env tab appears only when it holds something.** Services is the friendly
   front door that writes env vars; the raw Env tab is a power-user surface, so
   it stays hidden until there's a var to show.

Net: desktop toolbar went from ~13 controls to 6 (model · New Project ·
Start from… · Projects · GitHub · account), with ship actions (Prompt / Share /
Publish) still appearing only once a project exists.

## Open / deferred
- Real merge (vs last-writer-wins) on overlapping edits — out of scope for the
  prompt-as-seed thesis; the checkpoint + honest reporting is the pilot answer.
- Webhook-based push notification (vs focus/poll) — would need a backend
  listener; the poll is enough for pilot cadence.
- Per-file conflict UI — deliberately not built; overlaps are rare and the
  summary + checkpoint cover them.
