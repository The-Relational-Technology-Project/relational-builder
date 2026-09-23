import { stashAndStartFresh, promoteWorkspaceToCloud } from '@/project/local-projects';
import { useCloudStore } from '@/store/cloud-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useEnvStore } from '@/store/env-store';
import { useAuthStore } from '@/store/auth-store';
import { useSyncStore } from '@/store/sync-store';
import { useDeployStore } from '@/store/deploy-store';
import { builderClient } from '@/cloud/builder-client';
import { listCommunitySites } from '@/project/community-sites';

/**
 * Public builder profiles — a builder's page as a project.
 *
 * The page that represents someone's relational tech work is an ordinary
 * project with lineage `builder-profile`, built in plan and build mode like
 * anything else, and published on Community Hosting under kind `profile`
 * at /b/{handle}/. What makes it different lives in three small places:
 * this seed (what RB already knows about the builder becomes the page's
 * own data file), a plan-mode prompt variant (context-builder), and the
 * budget exemption keyed on the project (llm-proxy). One per builder — the
 * database enforces it, and the exemption leans on that.
 *
 * The data file is the page's OWN copy. Editing the name here never touches
 * the private profile, and the private profile stays private: nothing is
 * public until the builder publishes the page.
 */

export const PROFILE_DATA_PATH = '/data/profile.json';
export const PROFILE_PROJECT_NAME = 'My builder page';

export interface ProfileProject {
  name: string;
  live_url: string | null;
  repo_url: string | null;
  description: string;
}

export interface ProfileData {
  name: string;
  neighborhood: string;
  about_neighborhood: string;
  dreams: string;
  projects: ProfileProject[];
  practice_highlights: string[];
  technologies: string[];
  ideas: string[];
  commons: {
    incorporated: { type: string; count: number }[];
    contributed: { type: string; count: number }[];
  };
  sections: string[];
}

export const PROFILE_SECTIONS = [
  'name',
  'neighborhood',
  'projects',
  'practice',
  'technologies',
  'dreams',
  'ideas',
  'commons',
] as const;

/** Is the open workspace the builder's profile page? */
export function isBuilderProfileProject(): boolean {
  return useProjectStore.getState().lineage?.source === 'builder-profile';
}

/** The cloud project id when the open workspace is the profile page — what
 *  the llm-proxy checks before exempting a request from the weekly budget */
export function builderProfileProjectId(): string | null {
  if (!isBuilderProfileProject()) return null;
  return useCloudStore.getState().currentProjectId;
}

/** Handles are site slugs: lowercase, 3–32 chars, letters, digits, hyphens */
export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

export function suggestHandle(displayName: string | null | undefined, email: string | null | undefined): string {
  const base = (displayName?.trim() || email?.split('@')[0] || 'builder')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return base.length >= 3 ? base : `${base}-builder`.slice(0, 32);
}

/**
 * Everything RB already knows, shaped into the page's data file. Honest
 * about its sources: profile fields are solid; project names and live
 * sites come from the account; repo links live on this device only, so
 * they're best effort; commons counts come from chat references; the two
 * written sections (practice highlights, ideas) start empty and are
 * prompted for in plan mode.
 */
export async function gatherProfileSeed(): Promise<ProfileData> {
  const profile = useAuthStore.getState().profile;
  const cloud = useCloudStore.getState();
  await cloud.refreshProjects().catch(() => {});
  const projects = useCloudStore.getState().projects;

  const sites = await listCommunitySites().catch(() => []);
  const siteByName = new Map(sites.map(s => [s.name.trim().toLowerCase(), s]));
  const repos = useSyncStore.getState().repos;
  const live = useDeployStore.getState().liveSites;

  const projectEntries: ProfileProject[] = projects
    .filter(p => p.name.trim() && p.name !== PROFILE_PROJECT_NAME)
    .map(p => ({
      name: p.name,
      live_url: live[p.id]?.url ?? siteByName.get(p.name.trim().toLowerCase())?.url ?? null,
      repo_url: repos[p.id]?.htmlUrl ?? null,
      description: '',
    }));

  const incorporated: { type: string; count: number }[] = [];
  if (builderClient) {
    const { data } = await builderClient.rpc('my_commons_ref_counts');
    for (const row of (Array.isArray(data) ? data : []) as { source: string; kind: string; items: number }[]) {
      const type = row.source === 'studio' ? `studio ${row.kind || 'item'}` : (row.kind || 'item');
      incorporated.push({ type, count: Number(row.items) });
    }
  }

  const technologies = ['Relational Builder'];
  if (projectEntries.some(p => p.live_url)) technologies.push('Community Hosting');
  if (projectEntries.some(p => p.repo_url)) technologies.push('GitHub');
  const [inferred, contributed] = await Promise.all([
    inferTechnologies().catch(() => [] as string[]),
    contributedCounts().catch(() => [] as { type: string; count: number }[]),
  ]);
  for (const t of inferred) if (!technologies.includes(t)) technologies.push(t);

  return {
    name: profile?.display_name?.trim() || profile?.full_name?.trim() || '',
    neighborhood: profile?.neighborhood?.trim() || '',
    about_neighborhood: profile?.neighborhood_description?.trim() || '',
    dreams: profile?.dreams?.trim() || '',
    projects: projectEntries,
    practice_highlights: [],
    technologies,
    ideas: [],
    commons: { incorporated, contributed },
    sections: [...PROFILE_SECTIONS],
  };
}

// ── Refresh from RB: re-seed the page's data without losing what the ──
// ── builder wrote ─────────────────────────────────────────────────────

export interface ProfileChange {
  field: string;
  before: string;
  after: string;
}

const show = (v: unknown): string => {
  if (Array.isArray(v)) return v.length ? v.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(', ') : '(empty)';
  const str = String(v ?? '').trim();
  return str || '(empty)';
};

/** Read the page's current data file, tolerating a missing or broken one */
export function readProfileData(): ProfileData | null {
  const file = useProjectStore.getState().getFile(PROFILE_DATA_PATH);
  if (!file) return null;
  try {
    const parsed = JSON.parse(file.content) as Partial<ProfileData>;
    return parsed && typeof parsed === 'object' ? { ...emptyProfile(), ...parsed } : null;
  } catch {
    return null;
  }
}

function emptyProfile(): ProfileData {
  return {
    name: '', neighborhood: '', about_neighborhood: '', dreams: '',
    projects: [], practice_highlights: [], technologies: [], ideas: [],
    commons: { incorporated: [], contributed: [] }, sections: [...PROFILE_SECTIONS],
  };
}

/**
 * Merge a fresh seed into the current data file. RB-sourced fields update;
 * what the builder wrote stays: practice highlights, ideas, sections, project
 * descriptions, and any technology or project they added by hand. A project
 * that left the account stays only if it carries a description.
 */
export function mergeProfileSeed(current: ProfileData, seed: ProfileData): { next: ProfileData; changes: ProfileChange[] } {
  const changes: ProfileChange[] = [];
  const next: ProfileData = { ...current, commons: { ...current.commons } };

  for (const field of ['name', 'neighborhood', 'about_neighborhood', 'dreams'] as const) {
    if (seed[field] && seed[field] !== current[field]) {
      changes.push({ field, before: show(current[field]), after: show(seed[field]) });
      next[field] = seed[field];
    }
  }

  const byName = new Map(current.projects.map(p => [p.name.trim().toLowerCase(), p]));
  const merged: ProfileProject[] = [];
  for (const p of seed.projects) {
    const have = byName.get(p.name.trim().toLowerCase());
    if (!have) {
      merged.push(p);
      changes.push({ field: 'projects', before: '(not listed)', after: `${p.name}${p.live_url ? ` · ${p.live_url}` : ''}` });
      continue;
    }
    const updated: ProfileProject = {
      ...have,
      live_url: p.live_url ?? have.live_url,
      repo_url: p.repo_url ?? have.repo_url,
    };
    if (updated.live_url !== have.live_url || updated.repo_url !== have.repo_url) {
      changes.push({ field: `projects · ${have.name}`, before: show([have.live_url, have.repo_url].filter(Boolean)), after: show([updated.live_url, updated.repo_url].filter(Boolean)) });
    }
    merged.push(updated);
    byName.delete(p.name.trim().toLowerCase());
  }
  for (const leftover of byName.values()) {
    if (leftover.description?.trim()) merged.push(leftover);
    else changes.push({ field: 'projects', before: leftover.name, after: '(no longer in your account)' });
  }
  next.projects = merged;

  const tech = [...current.technologies];
  for (const t of seed.technologies) if (!tech.includes(t)) tech.push(t);
  if (tech.length !== current.technologies.length) {
    changes.push({ field: 'technologies', before: show(current.technologies), after: show(tech) });
  }
  next.technologies = tech;

  const sameCounts = (a: { type: string; count: number }[], b: { type: string; count: number }[]) =>
    JSON.stringify([...a].sort((x, y) => x.type.localeCompare(y.type))) ===
    JSON.stringify([...b].sort((x, y) => x.type.localeCompare(y.type)));
  const fmtCounts = (c: { type: string; count: number }[]) => c.length ? c.map(x => `${x.count} ${x.type}`).join(', ') : '(none)';
  if (!sameCounts(current.commons.incorporated, seed.commons.incorporated)) {
    changes.push({ field: 'commons · drew on', before: fmtCounts(current.commons.incorporated), after: fmtCounts(seed.commons.incorporated) });
    next.commons.incorporated = seed.commons.incorporated;
  }
  if (!sameCounts(current.commons.contributed, seed.commons.contributed)) {
    changes.push({ field: 'commons · contributed', before: fmtCounts(current.commons.contributed), after: fmtCounts(seed.commons.contributed) });
    next.commons.contributed = seed.commons.contributed;
  }

  return { next, changes };
}

/** Compute what a refresh would change on the OPEN page project */
export async function previewProfileRefresh(): Promise<{ next: ProfileData; changes: ProfileChange[] } | { error: string }> {
  if (!isBuilderProfileProject()) return { error: 'Open your builder page first' };
  const current = currentProfileData() ?? emptyProfile();
  const seed = await gatherProfileSeed();
  return mergeProfileSeed(current, seed);
}

/** Write the merged data where it lives (the file once building started,
 *  the lineage seed before) and let the cloud save it */
export async function applyProfileRefresh(next: ProfileData): Promise<void> {
  if (useProjectStore.getState().getFile(PROFILE_DATA_PATH)) {
    useProjectStore.getState().writeFile(PROFILE_DATA_PATH, JSON.stringify(next, null, 2), 'json');
  } else {
    const { lineage, setLineage } = useProjectStore.getState();
    setLineage({ ...(lineage ?? { source: 'builder-profile' }), profileSeed: next });
  }
  await useCloudStore.getState().saveNow().catch(() => {});
}

/** Import specifiers and file markers worth naming on a page. Anything not
 *  listed stays out: a page says "maps" and "Supabase", not "clsx". */
const TECH_LABELS: Record<string, string> = {
  react: 'React',
  'react-dom': 'React',
  tailwindcss: 'Tailwind CSS',
  'community-cloud': 'Community Cloud',
  serverless: 'Serverless functions',
  leaflet: 'Leaflet maps',
  'react-leaflet': 'Leaflet maps',
  'maplibre-gl': 'MapLibre maps',
  'mapbox-gl': 'Mapbox maps',
  '@supabase/supabase-js': 'Supabase',
  recharts: 'Charts (Recharts)',
  'chart.js': 'Charts (Chart.js)',
  d3: 'D3',
  'react-router-dom': 'React Router',
  'react-router': 'React Router',
  '@tanstack/react-query': 'React Query',
  'framer-motion': 'Motion',
  motion: 'Motion',
  three: 'Three.js',
  '@react-three/fiber': 'Three.js',
  'date-fns': 'date-fns',
  dayjs: 'Day.js',
  zod: 'Zod',
  marked: 'Markdown rendering',
  'react-markdown': 'Markdown rendering',
  ical: 'Calendar feeds (iCal)',
  'ical.js': 'Calendar feeds (iCal)',
  papaparse: 'CSV data',
  'qrcode.react': 'QR codes',
  qrcode: 'QR codes',
  pdfjs: 'PDF handling',
  'pdf-lib': 'PDF generation',
  jspdf: 'PDF generation',
  resend: 'Email (Resend)',
  twilio: 'SMS (Twilio)',
  stripe: 'Payments (Stripe)',
  '@stripe/stripe-js': 'Payments (Stripe)',
};

/** Technologies the builder's projects actually use, read from their files
 *  server-side (my_project_technologies), mapped to plain labels */
export async function inferTechnologies(): Promise<string[]> {
  if (!builderClient) return [];
  const { data } = await builderClient.rpc('my_project_technologies');
  const labels = new Set<string>();
  for (const row of (Array.isArray(data) ? data : []) as { spec: string; projects: number }[]) {
    const label = TECH_LABELS[row.spec];
    if (label) labels.add(label);
  }
  return [...labels];
}

/** What this builder has given back to the commons, counted by type */
export async function contributedCounts(): Promise<{ type: string; count: number }[]> {
  if (!builderClient) return [];
  const { data } = await builderClient.from('commons_contributions').select('contribution_type');
  const counts = new Map<string, number>();
  for (const row of (Array.isArray(data) ? data : []) as { contribution_type: string }[]) {
    counts.set(row.contribution_type, (counts.get(row.contribution_type) ?? 0) + 1);
  }
  return [...counts].map(([type, count]) => ({ type, count }));
}

/** The seed the page was started from, when the data file isn't written yet */
export function lineageSeed(): ProfileData | null {
  return useProjectStore.getState().lineage?.profileSeed ?? null;
}

/** The page's data, wherever it currently lives: the file once building has
 *  started, the lineage seed before that */
export function currentProfileData(): ProfileData | null {
  return readProfileData() ?? lineageSeed();
}

/**
 * Building needs the file. Called at the top of every build-mode send on a
 * page project: writes /data/profile.json from the lineage seed the first
 * time, and leaves an existing file alone.
 */
export function ensureProfileDataFile(): void {
  if (!isBuilderProfileProject()) return;
  if (useProjectStore.getState().getFile(PROFILE_DATA_PATH)) return;
  const seed = lineageSeed();
  if (!seed) return;
  useProjectStore.getState().writeFile(PROFILE_DATA_PATH, JSON.stringify(seed, null, 2), 'json');
}

/** The drafted first message of the page conversation */
function openingDraft(seed: ProfileData): string {
  return [
    "I'd like to build my public builder page — a page that shows my relational tech work in my neighborhood.",
    `Here's what you already have on me: ${seedSummary(seed)}.`,
    'Tell me what you found, then help me choose which sections to include and what it should look like.',
  ].join('\n');
}

/** A one-line inventory for the opening of the plan conversation */
function seedSummary(seed: ProfileData): string {
  const live = seed.projects.filter(p => p.live_url).length;
  const drew = seed.commons.incorporated.reduce((n, c) => n + c.count, 0);
  const parts = [
    `${seed.projects.length} project${seed.projects.length === 1 ? '' : 's'}${live ? ` (${live} live)` : ''}`,
    drew ? `drew on the commons ${drew} time${drew === 1 ? '' : 's'}` : 'no commons items logged yet',
  ];
  if (seed.neighborhood) parts.unshift(seed.neighborhood);
  return parts.join(', ');
}

/** Find the builder's existing profile project, if they have one */
export async function findBuilderProfileProject(): Promise<{ id: string; name: string } | null> {
  const user = useAuthStore.getState().user;
  if (!builderClient || !user) return null;
  const { data } = await builderClient
    .from('projects')
    .select('id, name')
    .eq('owner_id', user.id)
    .eq('lineage->>source', 'builder-profile')
    .limit(1);
  const row = Array.isArray(data) ? data[0] : null;
  return row ? { id: String(row.id), name: String(row.name) } : null;
}

/**
 * Open the builder's page project: the existing one when there is one,
 * otherwise a fresh project seeded with the data file and parked in plan
 * mode with the first message drafted. Requires a signed-in builder (the
 * seed is their account's data, and the free build is keyed on the cloud
 * project row).
 */
export async function startBuilderProfile(): Promise<{ error: string | null }> {
  const user = useAuthStore.getState().user;
  if (!user || !builderClient) return { error: 'Sign in first' };

  const existing = await findBuilderProfileProject();
  if (existing) {
    await promoteWorkspaceToCloud();
    const opened = await useCloudStore.getState().openProject(existing.id);
    if (opened.error) return opened;
    // A page that was opened and left before its first message lands back
    // where it started: the conversation drafted and ready to send
    if (useChatStore.getState().messages.length === 0) {
      useChatStore.getState().setMode('plan');
      // Pages started before the seed moved into lineage carry it as a
      // file; fold it back so the workspace is empty until building starts
      const seed = lineageSeed() ?? readProfileData() ?? (await gatherProfileSeed());
      if (useProjectStore.getState().getFile(PROFILE_DATA_PATH)) {
        useProjectStore.getState().deleteFile(PROFILE_DATA_PATH);
      }
      if (!lineageSeed()) {
        const { lineage, setLineage } = useProjectStore.getState();
        setLineage({ ...(lineage ?? { source: 'builder-profile' }), profileSeed: seed });
      }
      useChatStore.getState().setDraftMessage(openingDraft(seed));
    }
    return { error: null };
  }

  const seed = await gatherProfileSeed();

  // Never destructive: open work goes to the local shelf first
  stashAndStartFresh();
  useCloudStore.getState().closeProject();
  useProjectStore.getState().clearProject();
  useChatStore.getState().clearMessages();
  useEnvStore.getState().clearAll();
  useChatStore.getState().setMode('plan');
  // The seed rides in lineage, not as a file yet: an empty workspace lands
  // in the plan conversation (no preview pane, no placeholder app), and the
  // file is written the moment building starts (ensureProfileDataFile)
  useProjectStore.getState().setLineage({
    source: 'builder-profile',
    planTitle: PROFILE_PROJECT_NAME,
    importedAt: new Date().toISOString(),
    profileSeed: seed,
  });

  // The cloud row exists from the first message: the budget exemption and
  // the one-per-builder rule both key on it. createProject directly, since
  // the promote path treats a workspace with no files or messages as
  // untouched — this one carries its seed in lineage.
  const created = await useCloudStore.getState().createProject(PROFILE_PROJECT_NAME);
  if (created.error) return created;

  useChatStore.getState().setDraftMessage(openingDraft(seed));
  return { error: null };
}

/** The builder's live page on Community Hosting, if published */
export interface LiveBuilderPage {
  slug: string;
  url: string;
  total_views: number;
  updated_at: string;
}

export async function fetchLiveBuilderPage(): Promise<LiveBuilderPage | null> {
  if (!builderClient) return null;
  const { data } = await builderClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const url = import.meta.env.VITE_BUILDER_SUPABASE_URL;
  const res = await fetch(`${url}/functions/v1/publish-site`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'profile' }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return (result as { site?: LiveBuilderPage | null }).site ?? null;
}
