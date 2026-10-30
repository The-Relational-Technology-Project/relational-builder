# Self-hosting the Builder: a runbook that was actually run

The point: a community should be able to run Relational Builder itself,
end to end, without RTP or any one vendor. This file is the checklist for
the Builder app layer, with what happened each time it was run. The backend
(accounts, cloud projects, app data) has its own runbook to come; the
Builder works without it in local-only mode, which is what this runbook
stands up.

Companion: [../LOCAL-MODEL.md](../LOCAL-MODEL.md) (a model on the person's
machine or a box in the room, for building). The human-scale branch adds the
runtime side ([README.md](README.md)): built apps can call that same box.

## What you need

- A machine with Node 22 or newer and about 2 GB free (the build and its
  dependencies). A laptop is fine; so is a small box in a community room.
- Nothing else to start. No Supabase, no API keys. Local-only mode keeps
  projects in the browser's storage and talks to no backend.
- For building with AI, one of: a local model server (Ollama, llama.cpp,
  LM Studio) on the same machine or the same network, or a key for a hosted
  provider entered in Settings.

## The checklist

Each step says what was observed the last time it was run; dates in the
log at the bottom.

1. **Get the code.**
   `git clone https://github.com/the-relational-technology-project/relational-builder && cd relational-builder`
2. **Install.** `npm ci`. Observed Oct 30, 2026: 559 packages, under a
   minute on a cloud container, no native build steps that need compilers.
3. **Check it.** `npm test` (35 tests, under a second) and `npm run build`
   (`tsc -b && vite build`). Observed Oct 30: build passes; the production
   bundle lands in `dist/`.
4. **Serve it.** `npx vite preview --host --port 4173` serves `dist/` to the
   machine and the local network. Any static file server works too
   (`dist/` is plain files); the SPA fallback in `vercel.json` has to be
   reproduced on other servers (every unknown path serves `index.html`),
   or deep links like `/gallery` 404 while `/` still works.
5. **Open it.** `http://<machine>:4173/`. The landing page renders with no
   env set. Observed Oct 30: served from `dist/` by `vite preview`, opened in headless Chromium with no env vars at all; the landing page rendered (title "Relational Builder — build tools for your neighborhood"), zero page errors and zero console errors; screenshot `shots/selfhost-landing-2026-10-30.png`.
6. **Turn the human-scale flag on** (this branch only): open
   `/?humanScale=1` once; the choice sticks in that browser. Or build with
   `VITE_HUMAN_SCALE=1`.
7. **Point building at a local model.** Settings, Local model, URL of the
   server (`http://localhost:11434/v1` for Ollama on the same machine; the
   box's address on the network otherwise; the server must allow the
   Builder's origin, for Ollama `OLLAMA_ORIGINS=*`). Per LOCAL-MODEL.md.
   Not yet run here: the loop's container has no local model server; this
   step needs a person in a room with the box. Record what breaks when it
   is run.
8. **Set the runtime for built apps.** In a project, Services, "Where this
   app's AI runs": Local, same endpoint. The built app then calls the box
   directly; if the box is off, the app says so plainly and sends nothing
   elsewhere. Observed Oct 30 (dev server, Chromium): the card renders and
   writes the setting; the end-to-end call to a real local model is not
   yet run for the same reason as step 7.

## What is not community-controlled yet on this path

- The knowledge panel and the gallery read RTP's commons (a Supabase
  project RTP runs). Without network access to it the Builder still
  builds; the panel is empty. A local copy of the commons is a later item.
- Community Cloud (app data for built apps) and accounts need the backend
  runbook. In local-only mode built apps use localStorage, which the
  system prompt already handles.
- The hosted free model tier (`VITE_RTP_MODEL_URL`) is RTP's. A community's
  own vLLM or Ollama box replaces it by setting that variable or by the
  Local model setting.

## Cost framing (from Gebru's "Frugal AI")

The number a community decides on is one-time hardware versus recurring
cloud. A used workstation with a 16 to 24 GB GPU runs a 12B to 30B-class
open model for the room; the open models this branch benches cost cents a
build through OpenRouter. Put the real figures here once a box is bought.

## Log

- 2026-10-30: steps 1 to 6 run in the daily loop's container (not a clean
  laptop; same Node and npm path). Steps 7 and 8 need a local model server;
  not run.
