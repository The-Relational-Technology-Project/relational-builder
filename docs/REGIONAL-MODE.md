# Regional Mode (EU) — where the tools you build live

*November 2026. Status: shipped as the first regional mode, scoped to the
apps a person builds. The Builder itself still runs in the US. The gaps
below are real and ranked; input on the ranking is what we need most.*

A builder in Brussels put it plainly after prototyping a neighbourhood tool
library: local community software that Europeans will actually use has to
run on European servers, and ideally depend only on European companies. He
offered to help. This doc is the shape of that help.

The setting is on the **Builder profile** page under **Where your tools
live**: *Anywhere* (the defaults) or *European Union*. It saves to the
profile (`profiles.region_mode`) and follows you between devices; signed
out, it still works in the browser you set it in.

## Honest expectations

EU mode is about the apps you build and where your neighbours' data goes.
It is not a relocation of the Builder. Read the two lists before telling a
community what it means.

**Covered when EU mode is on:**

- **Services tab ranks EU-run services first**, and every card says where it
  stands: *EU* (EU company, EU servers), *EU data possible* (EU servers, non-EU
  company), or *Outside the EU*. New EU services: PocketBase (self-hosted),
  Brevo (email, France), Mistral (AI, France), Mollie (payments, Netherlands),
  46elks (SMS, Sweden), Baserow (spreadsheet database, Netherlands).
- **Publish offers two EU hosts** and picks one by default: **Bunny** (files
  in Falkenstein, Germany, served from Bunny's European edge only, about €1
  a month) and **Codeberg Pages** (a Berlin non-profit, free, the site is a
  public git repository). Community hosting, Netlify and Vercel stay
  available, labelled *Outside the EU*.
- **Fonts come from Bunny Fonts, not Google Fonts**, in every preview, share
  link, and publish, for every project old or new. Google Fonts is the one
  US dependency the Builder itself put into every app, and a German court
  has already fined a site for loading it; Bunny Fonts serves the same
  library from the EU through a URL-compatible API, so the swap is a host
  rename and nothing else changes.
- **The Builder knows.** A prompt block tells the model to write Bunny Fonts
  links, prefer the EU services, treat Community Cloud as *not* the default
  for shared data, and say plainly when something runs outside the EU.
- **Settings says which model choices keep the conversation in the EU**
  (Mistral under Bring Your Own Key, or a local model). Nothing switches on
  its own.

**Not covered. These are the gaps, in the order we think they matter:**

1. **Published apps still load code from US-fronted CDNs.** Framework apps
   resolve npm packages through esm.sh and load Tailwind's runtime from
   jsdelivr; simple tools often load Leaflet or Alpine from unpkg or jsdelivr.
   Visitors' browsers fetch from those at runtime. Fix: bundle dependencies
   into the publish output (the esbuild-wasm bundler already runs in the
   browser; fetching modules once at publish time and inlining them is the
   remaining step), and self-host the Tailwind runtime, or compile Tailwind
   at publish time. Medium effort, benefits every mode (faster, offline-safe
   sites).
2. **No EU home for shared data that a non-technical builder can click into.**
   Community Cloud (the Cloud tab: shared storage, neighbour sign-in, vaulted
   keys) runs on RTP's Supabase in us-west-1. In EU mode the answer is to
   connect your own backend (PocketBase on a Hetzner box, Supabase in an EU
   region, Baserow). That works for a technical builder and is out of reach
   for most neighbours. Fix options: (a) a second Community Cloud deployment
   in the EU, run by a European partner organisation rather than RTP, with
   the Builder choosing by region; (b) a one-click "PocketBase for your
   community" installer on a European host. (a) is the bigger lift and the
   better answer. ⚑ Needs a partner.
3. **No EU serverless target.** Secret keys (email, AI, SMS) need server-side
   code. Publish → Vercel compiles `api/*` functions; Bunny and Codeberg
   Pages are static. The Builder now writes that code as a PocketBase hook or
   a Supabase Edge Function in the builder's EU project when asked, but it
   can't deploy either. Fix: a PocketBase-hooks deploy path (upload
   `pb_hooks/*.pb.js` alongside the data), or Scaleway Serverless Functions.
4. **The Builder, accounts, and the commons run in the US.** The app is on
   Vercel; sign-in, profiles, projects, the gallery, and build day walls are
   on RTP's Supabase in us-west-1. The Builder is open source and can be
   self-hosted, but nobody has written the runbook. Fix: a `docs/SELF-HOST.md`
   with a Supabase-in-Frankfurt (or self-hosted Supabase) setup and the env
   vars to point a Builder at it. Low effort for the doc, real effort for
   whoever runs it.
5. **Bunny and Codeberg are the only EU hosts.** Scaleway Object Storage
   (S3-signed uploads from the browser), statichost.eu, and OVH would widen
   the choice. Each is a small adapter once the first two have been used by
   real builders.
6. **The map tiles.** Leaflet + OpenStreetMap is already the default; the
   OSM Foundation is UK-based and tile servers are in Europe, so this is fine
   in practice, but "EU company" purists will notice. A European tile
   provider (e.g. a self-hosted or Swiss/German tile service) could be
   offered when it matters.

## How to help

The most useful thing right now is not code. It is a European community
builder saying which of the six gaps above blocks real adoption and which
are theoretical. Our guess is 1 and 2, in that order, because they decide
whether a published app can honestly be called EU-hosted, and whether
anyone who isn't a developer can use EU mode at all. If you run community
software in Europe and disagree, say so; that changes what gets built next.

Concretely:

- **Try it.** Turn on EU mode, build something small, publish to Bunny or
  Codeberg, and tell us what felt wrong or missing.
- **Tell us about the data question.** Would your community be comfortable
  with a shared EU backend run by a European partner, or does it need to be
  something the community itself hosts?
- **If you want to write code:** gap 1 (bundling) is self-contained and
  helps everyone; gap 3 (PocketBase hooks deploy) is a neat afternoon for
  someone who knows PocketBase.
- **If you know EU hosting:** which host would you want neighbours to pay
  for, and why? That picks gap 5's next adapter.

Say hello through the Contact page or open an issue on the repository.

## Using the EU hosts

**Bunny.** Make an account at bunny.net, then Account → API and copy the
account key into Publish → Bunny. The first publish creates a storage zone in
Germany and a CDN zone restricted to Bunny's European region; later publishes
upload into the same zone (the Builder remembers the zone's own upload key,
not your account key, per site). Custom domains: paste the domain, add the
CNAME the dialog shows, and Bunny issues a free certificate once it resolves.
Costs about €1 a month at community scale.

**Codeberg Pages.** Make an account at codeberg.org, then Settings →
Applications → Generate token with `write:repository` and `write:user`.
The first publish creates a public repository named after your project with
a `pages` branch and the Pages webhook; later publishes commit to it. The
site is served at `https://you.codeberg.page/project/` within a few minutes.
Free, run by a non-profit. Your site's files are public, which is the point
of a community tool and worth saying out loud to the builder.

## Using an EU backend (the technical builder's path)

**PocketBase** is the recommended self-hosted choice: one binary, a
database, auth, file storage, and realtime, with access rules per
collection. Run it on a small Hetzner, Scaleway or OVH server behind https,
paste the URL into Services → PocketBase, and the Builder generates a
`pocketbase-schema.json` you import once in the Admin UI. Sign-in uses
PocketBase's email-code flow, so neighbours never set a password.

**Supabase in an EU region** works with the existing Supabase connection:
choose Frankfurt, Paris or Stockholm when creating the project. The data
stays in the EU; the company is American. A self-hosted Supabase connects the
same way and is entirely yours.

**Baserow** suits spreadsheet-shaped data a group already keeps.

Email, AI, SMS and payments are covered by Brevo, Mistral, 46elks and Mollie
respectively, each with the Builder knowing the API. The secret-key ones
need server-side code; see gap 3.

## What's in the code

- `src/regions/regions.ts` — the mode, the `ServiceHome` metadata type,
  `regionFit` / `orderByRegion` / `regionBadge`, the font rewrite
  (`applyRegionToHtml`, `regionalizeFiles`, `regionalizeUrls`), and the
  prompt block (`formatRegionForPrompt`).
- `src/store/region-store.ts` — the active mode, mirrored locally; the
  profile row (`profiles.region_mode`, migration `20261101090000`) is the
  source of truth for a signed-in builder (`auth-store` adopts it on load).
- `src/components/ProfilePage.tsx` — the setting, with the covered / not
  covered summary.
- `src/integrations/catalog.ts` — every integration and guided service
  carries a `home`; the EU services live here with their AI guidance.
  `src/integrations/verify.ts` checks PocketBase, Brevo and Mistral
  credentials live (all three APIs allow browser calls).
- `src/components/IntegrationsPanel.tsx` — ranking, badges, the EU note.
- `src/project/deploy-bunny.ts`, `src/project/deploy-codeberg.ts` — the
  EU host adapters; `src/store/deploy-store.ts` remembers keys and per-site
  zones / repositories; `src/components/PublishDialog.tsx` ranks targets.
- The font rewrite runs in `buildShellHtml` (framework preview and publish),
  `buildStaticSite` (pass-through CSS), the Sandpack preview path in
  `PreviewPanel.tsx`, and the simple-tool branches of `PublishDialog`,
  `SharePreview` and `ShareLiveDialog`.
- `src/knowledge/context-builder.ts` — `regionMode` option; the block sits
  in the cacheable half after the profile blocks. `ChatPanel` passes it.
- `src/components/ProviderSettings.tsx` — the model-choice note.

Adding a region later (Canada, Australia, a partner's own jurisdiction) is a
new `RegionMode` value, a `REGION_MODES` entry, `euData`-style answers on
the `ServiceHome` type for that region, and a prompt block. The plumbing is
region-agnostic by design.
