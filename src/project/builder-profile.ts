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

  return {
    name: profile?.display_name?.trim() || profile?.full_name?.trim() || '',
    neighborhood: profile?.neighborhood?.trim() || '',
    about_neighborhood: profile?.neighborhood_description?.trim() || '',
    dreams: profile?.dreams?.trim() || '',
    projects: projectEntries,
    practice_highlights: [],
    technologies,
    ideas: [],
    commons: { incorporated, contributed: [] },
    sections: [...PROFILE_SECTIONS],
  };
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
    return useCloudStore.getState().openProject(existing.id);
  }

  const seed = await gatherProfileSeed();

  // Never destructive: open work goes to the local shelf first
  stashAndStartFresh();
  useCloudStore.getState().closeProject();
  useProjectStore.getState().clearProject();
  useChatStore.getState().clearMessages();
  useEnvStore.getState().clearAll();
  useChatStore.getState().setMode('plan');
  useProjectStore.getState().setLineage({
    source: 'builder-profile',
    planTitle: PROFILE_PROJECT_NAME,
    importedAt: new Date().toISOString(),
  });
  useProjectStore.getState().writeFile(PROFILE_DATA_PATH, JSON.stringify(seed, null, 2), 'json');

  // The cloud row exists from the first message: the budget exemption and
  // the one-per-builder rule both key on it
  const promoted = await promoteWorkspaceToCloud(PROFILE_PROJECT_NAME);
  if (promoted.error) return promoted;

  useChatStore.getState().setDraftMessage(
    [
      "I'd like to build my public builder page — a page that shows my relational tech work in my neighborhood.",
      `Here's what you already have on me: ${seedSummary(seed)}. It's in /data/profile.json.`,
      'Tell me what you found, then help me choose which sections to include and what it should look like.',
    ].join('\n'),
  );
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
