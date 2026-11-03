# Self-hosting the backend: a runbook written here, not yet run

**Status (Nov 3, 2026): written from the repo, not executed.** The daily-loop
container has no Docker and no Supabase CLI, so nothing below has been run
end to end. Each step says what is known from the code and what is still a
guess. The first person who runs it on a machine with Docker should correct
this file as they go; the app-layer runbook ([SELF-HOST.md](SELF-HOST.md))
shows the shape: each step carries what was observed the last time.

The Builder works without any of this in local-only mode. This file is for
the layers that do need a server: accounts, cloud projects, Community Cloud
(app data for built apps), Community AI, and Community Hosting.

## What the backend is

One Supabase project (Postgres, Auth, Storage, Edge Functions). Nothing in
it is RTP-specific infrastructure; a community can run the same thing on a
Supabase account of its own, or on self-hosted Supabase (Docker Compose,
the open-source stack) which is the fully community-controlled path.

| Piece | In the repo | Size |
|---|---|---|
| Schema | `supabase/migrations/` | 77 SQL files, about 5,700 lines, 46 tables, RLS throughout |
| Edge functions | `supabase/functions/` | 25 Deno functions; 9 are the core path below |
| Builder's own env | `.env.example` | `VITE_BUILDER_SUPABASE_URL`, `VITE_BUILDER_SUPABASE_ANON_KEY`, `VITE_LLM_PROXY_URL` |

The migrations' own header says how they were applied in production: pasted
into the SQL editor, or `supabase db push`. They are ordered by filename and
written with `if not exists`, so applying all of them in order on an empty
project is the intended path.

## The core path (what the Builder actually calls)

Counted from `src/` on Nov 3. Everything else under `supabase/functions/`
is a studio, event or RTP-website door and can wait.

| Function | What it is | Secrets it reads |
|---|---|---|
| `request-account` | the open front door: someone asks for an account | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `STEWARD_EMAIL`, `APP_URL` |
| `signin-gate` | approval is what opens the door | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPER_ADMIN_EMAILS` |
| `connect` | the relational layer (who is building near you) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `app-data` | the Community Cloud API: collections and documents for built apps | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS` |
| `app-capabilities` | managed capabilities for built apps: email, AI (`ai_chat`) | as above, plus `RESEND_API_KEY`, `ANTHROPIC_COMMUNITY_KEY`, `GEMINI_COMMUNITY_KEY`, `OPENROUTER_API_KEY`, `COMMUNITY_OPEN_MODEL`, `COMMUNITY_APP_MODEL`, `COMMUNITY_APP_EFFORT`, `COMMUNITY_IMAGE_MODEL` |
| `publish-site` and `site` | Community Hosting: publish and serve built apps | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL` |
| `llm-proxy` | community access to hosted models for building | `ANTHROPIC_COMMUNITY_KEY`, `COMMUNITY_MODELS`, `MODEL_FALLBACKS`, `RTP_MODEL_URL`, rate-limit knobs |
| `supabase-admin` | the Builder operating a builder's own Supabase (graduate path) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are set
by the platform on every function. The rest are secrets a community sets
itself. On the human-scale branch the AI capability can run on an open
model through `OPENROUTER_API_KEY` and `COMMUNITY_OPEN_MODEL` (default
`google/gemma-3-12b-it`), so the only hosted-frontier secret,
`ANTHROPIC_COMMUNITY_KEY`, becomes optional for built apps. That change is
in the repo and not yet deployed; see "Needs Josh" in [NEXT.md](NEXT.md).

## The checklist (unrun)

1. **A Supabase project.** Either `supabase.com` (a free project is enough
   to try it) or self-hosted Supabase from the official Docker Compose
   (`github.com/supabase/supabase`, `docker/` directory). Self-hosted is
   the community-controlled path; it needs a machine with Docker, about 4
   GB RAM free, and a domain or a LAN address people can reach.
2. **Apply the schema.** With the CLI linked to the project: `supabase db
   push` from the repo root applies `supabase/migrations/` in order.
   Without the CLI: paste each file into the SQL editor in filename order.
   Unknown until run: whether any migration assumes an RTP-only extension
   or a storage bucket that has to exist first (the `story-photos` and
   `site` functions use Storage; check their bucket names before step 4).
3. **Set the secrets.** For the core path: `RESEND_API_KEY` and
   `STEWARD_EMAIL` (account requests and invites go out by email; Resend is
   the only mail path in the code), `SUPER_ADMIN_EMAILS` (who approves),
   `APP_URL` and `SITE_URL` (where the Builder and hosted sites live),
   `ALLOWED_ORIGINS` (where built apps may call Community Cloud from). For
   Community AI on an open model: `OPENROUTER_API_KEY` and
   `COMMUNITY_OPEN_MODEL`, or point the same at a community's own
   OpenAI-compatible server once `app-capabilities` can take a base URL
   (it cannot yet; that is a small change in `callCommunityOpenRouter`).
   The Management API is the way that worked from a sandbox:
   `PATCH https://api.supabase.com/v1/projects/$REF/secrets` with a JSON
   array of `{name, value}`.
4. **Deploy the nine functions.** The repo's convention (CLAUDE.md) is the
   Management API deploy, one call per function:
   `curl -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -F 'metadata={"name":"<slug>","entrypoint_path":"index.ts","verify_jwt":false};type=application/json' -F 'file=@supabase/functions/<slug>/index.ts;type=application/typescript' "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/functions/deploy?slug=<slug>"`
   On self-hosted Supabase there is no Management API; functions are served
   by the `functions` container from a mounted directory, so copying
   `supabase/functions/<slug>` there is the equivalent. Every function is a
   single `index.ts` with no `_shared/` directory (checked Nov 3), so one
   file per function is the whole deploy.
5. **Point the Builder at it.** In the Builder's `.env`:
   `VITE_BUILDER_SUPABASE_URL`, `VITE_BUILDER_SUPABASE_ANON_KEY`, and
   `VITE_LLM_PROXY_URL=<url>/functions/v1/llm-proxy`. Rebuild (`npm run
   build`) and serve `dist/` as in the app runbook.
6. **Smoke-test in this order.** (a) `request-account` with a test email:
   expect the function's own JSON, not a platform 5xx, and a mail to
   `STEWARD_EMAIL`. (b) Approve it, sign in, create a cloud project.
   (c) Build a small app, connect the Cloud tab, write a document through
   `app-data`. (d) Run one `ai_chat` with `runtime_model: "open"` and check
   the response names the open model. (e) Publish to Community Hosting and
   open the site.

## What stays outside the community's control on this path

- Email goes through Resend (a vendor). A self-hosted SMTP path is not in
  the code.
- Supabase Auth's email sign-in uses the project's own SMTP settings, set
  in the dashboard, not in the repo.
- Hosted-model access for building (`llm-proxy`) still needs a vendor key
  unless `RTP_MODEL_URL` points at a community's own model server; the
  Local model setting in the Builder bypasses the proxy entirely.

## Log

- Nov 3, 2026: written from the repo in the daily-loop container (no
  Docker, no CLI). Not run. Counts above come from `ls`, `wc` and `grep`
  over `supabase/` and `src/`.
