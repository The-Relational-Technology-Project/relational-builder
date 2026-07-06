---
name: verify
description: Build, launch, and drive Relational Builder to verify a change end-to-end in a real browser.
---

# Verifying Relational Builder changes

## Build & launch

```bash
npm ci                       # once per container
npm run build                # tsc -b && vite build — type errors surface here
VITE_ACCESS_CODE=6767 npm run dev -- --port 5199 --strictPort   # background
```

`VITE_ACCESS_CODE` makes the public landing page render (without it the gate
is open and you land straight in the app). To get past the landing in a
script: `localStorage.setItem('rb-entered', '1')` then reload.

## Drive with Playwright

Chromium is preinstalled at `/opt/pw-browsers/chromium`; install the
`playwright` npm package in a scratch dir and launch with `executablePath`.

**Gotcha (remote sandbox):** the browser cannot reach external hosts —
CONNECTs through the agent proxy hang. Bridge external requests through
Node's fetch, which does work:

```js
await ctx.route(/^https:\/\/(?!localhost)/, async route => {
  const req = route.request();
  const res = await fetch(req.url(), { method: req.method(), headers: req.headers() });
  const body = Buffer.from(await res.arrayBuffer());
  const headers = {};
  res.headers.forEach((v, k) => { if (!['content-encoding','transfer-encoding','content-length'].includes(k)) headers[k] = v; });
  await route.fulfill({ status: res.status, headers, body });
});
// run node with: NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
```

## Flows worth driving

- **Home (signed out):** landing → "Come on in and sign in" → welcome hero.
  Composer should contain the image CTA, Plan/Build toggle, and model picker.
- **Gallery:** home → "or start from → the Gallery" (or nav Gallery button).
  Tools load live from the RT Studio Supabase (`ivrvpbqidysrwqrthpcp`).
  Card images are lazy — scroll the `.h-full.overflow-y-auto` container before
  asserting `naturalWidth > 0`.
- **Auth-gated surfaces** (account menu, cloud projects) need
  `VITE_BUILDER_SUPABASE_URL/ANON_KEY` and a real magic-link sign-in — not
  drivable headless. For shared UI primitives, mount them via the dev server's
  module graph instead: `import('/@id/react')`, `import('/@id/react-dom/client')`,
  `import('/src/components/ui/<file>.tsx')` in `page.evaluate`, render the same
  composition the gated component uses, and interact with it.

Capture `page.on('pageerror')` and console errors in every run — the app
should produce zero.
