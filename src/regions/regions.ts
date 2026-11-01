import type { FileEntry } from '@/project/virtual-fs';

/**
 * Regional modes — where a builder wants their tools and their neighbours'
 * data to live. The first one is the EU, asked for by a builder in Brussels:
 * local community software that Europeans will actually use has to run on
 * European servers, and ideally depend only on European companies.
 *
 * A mode does three things, and only these three:
 *   1. Ranks services by where they keep data and who runs them, so the EU
 *      options are the obvious defaults (Services tab, Publish dialog).
 *   2. Rewrites the one US dependency the Builder itself puts into every
 *      app — Google Fonts — to an EU-hosted drop-in (Bunny Fonts), at
 *      preview and publish time, for every project regardless of age.
 *   3. Tells the model, so new builds reach for EU services and say
 *      plainly when something runs outside.
 *
 * It does NOT move the Builder, accounts, or Community Cloud to the EU, and
 * it does not stop a published app from loading JS modules from esm.sh and
 * jsdelivr at runtime. docs/REGIONAL-MODE.md says exactly what is and
 * isn't covered — keep that file and this module in step.
 */

export type RegionMode = 'global' | 'eu';

export interface RegionModeDef {
  id: RegionMode;
  label: string;
  /** One line for the profile page */
  blurb: string;
}

export const REGION_MODES: RegionModeDef[] = [
  {
    id: 'global',
    label: 'Anywhere',
    blurb: 'The defaults: community hosting and Community Cloud run by RTP (US), plus whichever services you connect.',
  },
  {
    id: 'eu',
    label: 'European Union',
    blurb: 'EU-run services first, EU-hosted fonts, and the Builder says when something runs outside the EU.',
  },
];

export function isRegionMode(v: unknown): v is RegionMode {
  return v === 'global' || v === 'eu';
}

/**
 * Where a service keeps data and who runs it. Attached to every entry in
 * the integrations catalog and to deploy targets. `company` is the home
 * country of the company (ISO 3166 code) — jurisdiction follows the
 * company, not the data centre, which is why a US company with an EU
 * region is 'optional', not 'yes'.
 */
export interface ServiceHome {
  company: string;
  /** Can the data stay in the EU? yes = EU company, EU servers;
   *  optional = EU servers available, non-EU company; no = outside the EU */
  euData: 'yes' | 'optional' | 'no';
  /** One line shown under the badge: how to get the EU outcome, or why not */
  note?: string;
}

export type RegionFit = 'fits' | 'partial' | 'outside';

/** How well a service suits the active mode */
export function regionFit(home: ServiceHome | undefined, mode: RegionMode): RegionFit {
  if (mode === 'global' || !home) return 'fits';
  return home.euData === 'yes' ? 'fits' : home.euData === 'optional' ? 'partial' : 'outside';
}

const FIT_RANK: Record<RegionFit, number> = { fits: 0, partial: 1, outside: 2 };

/**
 * Stable sort by fit: what suits the mode comes first, keeping the
 * catalog's own order inside each band (so nothing jumps around in the
 * default mode, where everything fits).
 */
export function orderByRegion<T extends { home?: ServiceHome }>(items: T[], mode: RegionMode): T[] {
  if (mode === 'global') return items;
  return items
    .map((item, i) => ({ item, i, rank: FIT_RANK[regionFit(item.home, mode)] }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(x => x.item);
}

/** Short badge text for the Services tab and Publish dialog */
export function regionBadge(home: ServiceHome | undefined, mode: RegionMode): string | null {
  if (mode !== 'eu' || !home) return null;
  switch (home.euData) {
    case 'yes': return 'EU';
    case 'optional': return 'EU data possible';
    case 'no': return 'Outside the EU';
  }
}

// ── Fonts ─────────────────────────────────────────────────────────────────

/**
 * Google Fonts → Bunny Fonts. Bunny (bunny.net, Slovenia) serves the same
 * open-licensed font library from EU servers through a URL-compatible API:
 * both the classic `/css?family=` and the `/css2?family=` shapes work
 * unchanged, so a plain host swap is a correct swap. Verified Nov 2026.
 *
 * `fonts.gstatic.com` only appears in generated code as a `<link
 * rel="preconnect">`; pointing it at Bunny keeps the hint harmless.
 */
const FONT_HOSTS: [RegExp, string][] = [
  [/fonts\.googleapis\.com/g, 'fonts.bunny.net'],
  [/fonts\.gstatic\.com/g, 'fonts.bunny.net'],
];

export function applyRegionToHtml(html: string, mode: RegionMode): string {
  if (mode !== 'eu') return html;
  let out = html;
  for (const [re, host] of FONT_HOSTS) out = out.replace(re, host);
  return out;
}

/** Text files that can carry a font URL: HTML, CSS, and source that builds a <link> or @import */
const FONT_CARRIER = /\.(html?|css|tsx?|jsx?|mjs|svelte|vue)$/i;

/**
 * The same rewrite across a whole project — what preview, publish, share
 * links, and the simple-tool path all call. Returns the input array
 * untouched (same reference) outside EU mode or when nothing changed, so
 * memoised callers don't re-render.
 */
export function regionalizeFiles(files: FileEntry[], mode: RegionMode): FileEntry[] {
  if (mode !== 'eu') return files;
  let changed = false;
  const out = files.map(f => {
    if (!FONT_CARRIER.test(f.path)) return f;
    const content = applyRegionToHtml(f.content, mode);
    if (content === f.content) return f;
    changed = true;
    return { ...f, content };
  });
  return changed ? out : files;
}

/** Rewrite a list of external resource URLs (the Sandpack preview path) */
export function regionalizeUrls(urls: string[], mode: RegionMode): string[] {
  return mode === 'eu' ? urls.map(u => applyRegionToHtml(u, mode)) : urls;
}

// ── Prompt ────────────────────────────────────────────────────────────────

/**
 * The system-prompt block for the active mode. Stable across a session, so
 * it sits in the cacheable half of the prompt next to the profile blocks.
 * It overrides, by name, the base instructions it contradicts (Google
 * Fonts, the hosting line, Community Cloud as the default for shared data).
 */
export function formatRegionForPrompt(mode: RegionMode): string | null {
  if (mode !== 'eu') return null;
  return [
    '## Regional Mode: European Union',
    '',
    'This builder has turned on EU mode: the tools they build are for a European community, and neighbours will only trust a tool whose data stays on European servers, run by European companies where possible. Treat this as a hard requirement, not a preference. It changes four things above:',
    '',
    '- **Fonts.** Load web fonts from Bunny Fonts, never Google Fonts: `https://fonts.bunny.net/css2?family=...` (same family names and URL shape as Google Fonts; the Builder also rewrites any Google Fonts link it finds, but write the right one). Preconnect to `https://fonts.bunny.net` only. This overrides the "Google Fonts <link>" line under Personality.',
    '- **Hosting.** The Publish button offers two EU targets: **Bunny (storage + CDN, Falkenstein, Germany)** for any static site, and **Codeberg Pages (Berlin, non-profit)** when the person is at home with git. Community hosting, Netlify and Vercel run in the US — say so plainly if they come up, and do not suggest them unprompted. There is no EU serverless target yet: `api/*` functions do not run on either EU host.',
    '- **Shared data.** Community Cloud (RTP-hosted, US) is NOT the default here. For shared data (boards, RSVPs, signups, tool libraries) use what the builder connected in the Services tab, in this order of preference: **PocketBase** they run themselves (one binary on a Hetzner or Scaleway box), **Supabase in an EU region** (Frankfurt, Paris, Stockholm — data in the EU, company in the US; a self-hosted Supabase is fully theirs), or **Baserow** (Netherlands) for spreadsheet-shaped data. If nothing is connected and the tool needs shared data, say which one you would pick for them and why, and point to the Services tab. Never fall back to Community Cloud silently.',
    '- **Everything else.** Prefer EU-run services when a feature needs one: **Mistral** (France) for AI features inside the app, **Brevo** (France) for email, **Mollie** (Netherlands) for payments, **46elks** (Sweden) for SMS, Leaflet + OpenStreetMap for maps (never Google Maps). Secret keys still mean server-side code — with no EU serverless target, that means a PocketBase hook, a Supabase Edge Function in their EU project, or a small server they run; be explicit about this when a feature needs a secret.',
    '',
    'Be honest about the edges. The Builder itself, accounts, and Community Cloud run on US infrastructure (RTP\'s Supabase, us-west-1); EU mode covers the apps a person builds, not the Builder. Published apps still load JavaScript modules from esm.sh and Tailwind\'s runtime from jsdelivr (content delivery networks; visitors\' browsers fetch from them). When a person asks what stays in the EU, say exactly this rather than reassuring them.',
  ].join('\n');
}
