import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useProjectStore } from '@/store/project-store';
import { useCloudStore } from '@/store/cloud-store';
import { useDeployStore } from '@/store/deploy-store';
import { useLocalProjects } from '@/project/local-projects';
import {
  STUDIO_BRIEF_FRAME,
  STUDIO_BRIEF_PATH,
  STUDIO_PAGE_PATH,
} from '@/knowledge/studio-brief';

/**
 * Sharing a Studio Brief with RTP — the opt-in door at the end of the
 * "design your studio" journey.
 *
 * Nothing here runs until the partner presses the button on the card
 * (StudioBriefShareCard). At that moment the brief and, when they leave the
 * box ticked, the one-page site are read from the project and posted to the
 * studio-brief-share edge function, which emails them to Josh at the
 * Relational Tech Project with the partner's name, email, and note, and
 * keeps a row in contact_messages as the durable record.
 *
 * Unlike the build day notice, this is never automatic: the brief names the
 * partner's stewards and their emails, so it goes only when they send it.
 */

const FUNCTIONS_URL = `${import.meta.env.VITE_BUILDER_SUPABASE_URL ?? ''}/functions/v1`;

const PROJECT_NAME_RE = /^\s*`?PROJECT-NAME:\s*([^`\n]+?)`?\s*$/im;

/** Bold-labelled lines of the brief block, e.g. `- **Studio name:** River City Civic Studio` */
function briefLine(text: string, label: string): string | null {
  const re = new RegExp(`^\\s*(?:[-*]\\s*)?\\*\\*${label}:?\\*\\*:?\\s*(.+?)\\s*$`, 'im');
  const v = re.exec(text)?.[1]?.trim();
  return v ? v.replace(/\s+/g, ' ') : null;
}

export interface StudioBriefSummary {
  studioName: string | null;
  tagline: string | null;
  inCommon: string | null;
  stewards: string | null;
  door: string | null;
  contact: string | null;
}

/** The headline lines of a brief — what the email's subject and table show */
export function summarizeStudioBrief(brief: string): StudioBriefSummary {
  const heading = /^#\s+(.+?)\s*$/m.exec(brief)?.[1]?.trim() ?? null;
  return {
    studioName: briefLine(brief, 'Studio name') ?? heading,
    tagline: briefLine(brief, 'Tagline'),
    inCommon: briefLine(brief, 'What we hold in common'),
    stewards: briefLine(brief, 'Stewards'),
    door: briefLine(brief, 'Door'),
    contact: briefLine(brief, 'Contact'),
  };
}

/** Did this project come through the studio door? The frame must be in lineage. */
export function isStudioBriefProject(): boolean {
  const lineage = useProjectStore.getState().lineage;
  return (lineage?.frames ?? []).includes(STUDIO_BRIEF_FRAME.slug);
}

/** The brief's markdown, when the project has one */
export function readStudioBrief(): string | null {
  const fs = useProjectStore.getState();
  const entry =
    fs.getFile(STUDIO_BRIEF_PATH) ??
    fs.getFile(`/${STUDIO_BRIEF_PATH}`) ??
    fs.getAllFiles().find(f => /(^|\/)brief\.md$/i.test(f.path));
  const content = entry?.content?.trim();
  return content ? content : null;
}

/** The one-page site's HTML, when the project has one */
export function readStudioPage(): string | null {
  const fs = useProjectStore.getState();
  const entry = fs.getFile(STUDIO_PAGE_PATH) ?? fs.getFile(`/${STUDIO_PAGE_PATH}`);
  const content = entry?.content?.trim();
  return content ? content : null;
}

/** The project key the deploy store remembers live sites under (same as ShareMenu) */
export function currentProjectKey(): string {
  return useCloudStore.getState().currentProjectId ?? useLocalProjects.getState().currentId ?? 'local';
}

/** Where the page already went live, if it did */
export function readLiveSiteUrl(): string | null {
  return useDeployStore.getState().liveSites[currentProjectKey()]?.url ?? null;
}

export interface StudioBriefSharePayload {
  projectName: string | null;
  studioName: string | null;
  tagline: string | null;
  inCommon: string | null;
  stewards: string | null;
  door: string | null;
  contact: string | null;
  builderName: string | null;
  builderEmail: string | null;
  note: string | null;
  brief: string;
  /** The page's HTML — present only when the box stayed ticked */
  siteHtml: string | null;
  siteUrl: string | null;
  consentAt: string;
}

/** Assembles the payload at the moment of consent — the preview shows the same object */
export function assembleStudioBriefShare(input: {
  builderName: string | null;
  builderEmail: string | null;
  note: string | null;
  includeSite: boolean;
}): StudioBriefSharePayload | null {
  const brief = readStudioBrief();
  if (!brief) return null;
  const summary = summarizeStudioBrief(brief);
  const planName = useProjectStore.getState().lineage?.planTitle ?? null;
  return {
    projectName: PROJECT_NAME_RE.exec(brief)?.[1]?.trim() ?? planName,
    ...summary,
    builderName: input.builderName,
    builderEmail: input.builderEmail,
    note: input.note,
    brief,
    siteHtml: input.includeSite ? readStudioPage() : null,
    siteUrl: readLiveSiteUrl(),
    consentAt: new Date().toISOString(),
  };
}

export async function sendStudioBriefShare(payload: StudioBriefSharePayload): Promise<void> {
  const res = await fetch(`${FUNCTIONS_URL}/studio-brief-share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not send the brief');
}

/**
 * Where the card stands for each project: offered (shows once the brief
 * exists), put away (the partner closed it; Share → "Send to Josh at RTP"
 * brings it back), or sent. Keyed like live sites, so a project that moves
 * from the local shelf to the cloud keeps its answer.
 */
export type StudioShareStatus = 'offered' | 'dismissed' | 'sent';

interface StudioShareState {
  status: Record<string, StudioShareStatus>;
  setStatus: (key: string, status: StudioShareStatus) => void;
}

export const useStudioShareStore = create<StudioShareState>()(
  persist(
    set => ({
      status: {},
      setStatus: (key, status) => set(s => ({ status: { ...s.status, [key]: status } })),
    }),
    { name: 'rb-studio-brief-share' },
  ),
);
