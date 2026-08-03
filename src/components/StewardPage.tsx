import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminListRequests,
  adminDecideRequest,
  isSuperAdmin,
  type AccountRequest,
} from '@/cloud/account-requests';
import { useAuthStore } from '@/store/auth-store';
import { adminListAccounts, type StewardAccount } from '@/cloud/steward-accounts';
import {
  adminListContributions,
  adminReviewContribution,
  type CommonsContribution,
} from '@/cloud/commons-admin';
import {
  fetchGalleryLinks,
  adminAddGalleryLink,
  adminRemoveGalleryLink,
  type GalleryLink,
} from '@/cloud/gallery-links';
import {
  fetchGalleryReferences,
  invalidateGalleryReferences,
  adminAddReference,
  adminConfirmReference,
  adminRemoveReference,
} from '@/cloud/gallery-references';
import { RELATION_LABELS, type GalleryReference, type RefRelation, type RefSource } from '@/knowledge/gallery-references';
import {
  fetchCivicMediaCards,
  fetchNeighboringRecipeCards,
} from '@/knowledge/commons-items';
import { fetchVisibleStudioItems } from '@/cloud/studio-library';
import { listAllStudios, type StudioContext } from '@/knowledge/studio-context';
import {
  fetchStudioAccessMap,
  listStudioMembers,
  stewardSetStudioAccess,
  stewardSetStudioAdmin,
  type StudioAccess,
  type StudioMemberRow,
} from '@/cloud/studios';
import { useKnowledgeStore } from '@/store/knowledge-store';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Check, X, Loader2, ChevronDown, ChevronRight, ShieldCheck, KeyRound, Link2, Lock, LockOpen } from 'lucide-react';

/**
 * The Steward page — every steward task in one full-width space (these
 * queues outgrew a dialog):
 *  - Accounts: every builder, their place, and their cloud project count
 *  - Account requests: pending requests, one-tap approve/decline
 *  - Commons review: the RT Commons contribution review queue (absorbed
 *    from RT Studio; decisions flow through the commons' review function)
 *  - Studio gallery: which Commons Gallery tools belong to which studios,
 *    powering studio-scoped highlighting
 *  - Studio access: which studios are gated (members need approval) and who
 *    holds each studio's admin role — the role that approves members and
 *    tends the studio's private library
 * Visibility is gated by email client-side for convenience; the
 * admin-requests edge function is the real boundary. The gate lives here as
 * well as on the menu item that opens it — the page has an address now, and
 * an address can be typed by anyone.
 */
export function StewardPage() {
  const user = useAuthStore(s => s.user);
  if (!isSuperAdmin(user?.email)) {
    return (
      <div className="flex-1 overflow-y-auto h-full">
        <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-2">
          <ShieldCheck className="size-6 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            This page is for RTP stewards.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="size-6 text-primary shrink-0" />
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Steward</h1>
        </div>
        <Tabs defaultValue="accounts">
          {/* Four labels don't fit a phone width — the strip scrolls edge-to-edge
              instead of clipping (justify-center inside an overflowing list cuts
              off both ends) */}
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="w-max">
              <TabsTrigger value="accounts" className="text-xs px-3 sm:px-4">Accounts</TabsTrigger>
              <TabsTrigger value="door" className="text-xs px-3 sm:px-4">Account requests</TabsTrigger>
              <TabsTrigger value="commons" className="text-xs px-3 sm:px-4">Commons review</TabsTrigger>
              <TabsTrigger value="gallery" className="text-xs px-3 sm:px-4">Studio gallery</TabsTrigger>
              <TabsTrigger value="connections" className="text-xs px-3 sm:px-4">Connections</TabsTrigger>
              <TabsTrigger value="access" className="text-xs px-3 sm:px-4">Studio access</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="accounts" className="pt-4">
            <AccountsTab />
          </TabsContent>
          <TabsContent value="door" className="pt-4">
            <RequestsTab active />
          </TabsContent>
          <TabsContent value="commons" className="pt-4">
            <CommonsTab />
          </TabsContent>
          <TabsContent value="gallery" className="pt-4">
            <GalleryTab />
          </TabsContent>
          <TabsContent value="connections" className="pt-4">
            <ConnectionsTab />
          </TabsContent>
          <TabsContent value="access" className="pt-4">
            <StudioAccessTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// --- Accounts: every builder, their place, their projects ---

function AccountsTab() {
  const [accounts, setAccounts] = useState<StewardAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminListAccounts()
      .then(setAccounts)
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load accounts'))
      .finally(() => setLoading(false));
  }, []);

  const totalProjects = useMemo(
    () => accounts.reduce((sum, a) => sum + a.project_count, 0),
    [accounts],
  );

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-3.5 animate-spin" /> Loading accounts…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} ·{' '}
        {totalProjects} cloud {totalProjects === 1 ? 'project' : 'projects'} — builds kept
        only on someone's local shelf aren't counted.
      </p>
      <div className="space-y-1.5">
        {accounts.map(a => (
          <div key={a.id} className="rounded-lg border px-3 py-2 flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{a.name || a.email}</span>
                {a.name && (
                  <span className="text-xs text-muted-foreground truncate">{a.email}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {a.neighborhood || (a.profile_completed ? 'No neighborhood given' : 'Profile not completed yet')}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 tabular-nums">
              {a.project_count} {a.project_count === 1 ? 'project' : 'projects'}
            </Badge>
            <span className="text-xs text-muted-foreground/60 shrink-0 w-16 text-right">
              {new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
        ))}
        {accounts.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">No accounts yet.</p>
        )}
      </div>
    </div>
  );
}

// --- Door: account requests ---

function RequestsTab({ active }: { active: boolean }) {
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await adminListRequests());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) void refresh();
  }, [active, refresh]);

  async function decide(id: string, action: 'approve' | 'decline') {
    setBusyId(id);
    setError(null);
    try {
      await adminDecideRequest(id, action);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That decision did not save');
    } finally {
      setBusyId(null);
    }
  }

  const pending = requests.filter(r => r.status === 'pending');
  const decided = requests.filter(r => r.status !== 'pending').slice(0, 10);

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin" /> Loading…
        </p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pending requests — the door is quiet.
        </p>
      ) : (
        <div className="space-y-3">
          {pending.map(r => (
            <div key={r.id} className="rounded-lg border p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{r.name || r.email}</span>
                {r.name && (
                  <span className="text-xs text-muted-foreground truncate">{r.email}</span>
                )}
                {r.studio_label && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    via {r.studio_label}
                  </Badge>
                )}
                {/* An existing builder already vouched for this person by
                    inviting them to something they own — the most useful
                    single fact on this screen, so it gets the loud badge */}
                {r.invited_by_email && (
                  <Badge className="text-[10px] shrink-0">invited</Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground/70 shrink-0">
                  {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
              {r.invited_by_email && (
                <p className="text-xs text-muted-foreground">
                  Invited by <strong className="font-medium">{r.invited_by_email}</strong>
                  {r.invited_project_name && <> to collaborate on “{r.invited_project_name}”</>}
                </p>
              )}
              {r.neighborhood && (
                <p className="text-xs text-muted-foreground">From {r.neighborhood}</p>
              )}
              {r.reason && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{r.reason}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={busyId !== null}
                  onClick={() => decide(r.id, 'approve')}
                >
                  {busyId === r.id ? (
                    <Loader2 className="size-3 mr-1 animate-spin" />
                  ) : (
                    <Check className="size-3 mr-1" />
                  )}
                  Approve — sends welcome email
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={busyId !== null}
                  onClick={() => decide(r.id, 'decline')}
                >
                  <X className="size-3 mr-1" />
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent decisions</p>
          {decided.map(r => (
            <div key={r.id} className="flex items-center gap-2 text-xs">
              <Badge
                variant="outline"
                className={r.status === 'approved' ? 'text-green-600 border-green-600/40' : 'text-muted-foreground'}
              >
                {r.status}
              </Badge>
              <span className="truncate">{r.name || r.email}</span>
              {r.decided_at && (
                <span className="ml-auto text-muted-foreground/60 shrink-0">
                  {new Date(r.decided_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Commons: the contribution review queue ---

function CommonsTab() {
  const [contributions, setContributions] = useState<CommonsContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setContributions(await adminListContributions());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the review queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function review(id: string, decision: 'approve' | 'reject') {
    setBusyId(id);
    setError(null);
    try {
      await adminReviewContribution(id, decision, notes.trim() || undefined);
      setNotes('');
      setOpenId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That review did not save');
    } finally {
      setBusyId(null);
    }
  }

  const pending = contributions.filter(
    c => c.status === 'pending' || c.status === 'changes_requested',
  );
  const decided = contributions.filter(
    c => c.status === 'approved' || c.status === 'rejected',
  );

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin" /> Loading the queue…
        </p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing waiting for review — the commons is tended.
        </p>
      ) : (
        <div className="space-y-3">
          {pending.map(c => {
            const isOpen = openId === c.id;
            const from = c.proposed_attribution?.name;
            return (
              <div key={c.id} className="rounded-lg border p-3 space-y-1.5">
                <button
                  className="w-full flex items-center gap-2 text-left"
                  onClick={() => { setOpenId(isOpen ? null : c.id); setNotes(''); }}
                >
                  {isOpen ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
                  <span className="text-sm font-medium truncate">{c.proposed_title}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{c.proposed_kind}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground/70 shrink-0">
                    {new Date(c.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </button>
                <p className="text-xs text-muted-foreground">
                  {from ? `From ${from} — ` : ''}via {c.source_studio_slug}
                </p>
                {c.proposed_summary && (
                  <p className="text-xs text-muted-foreground line-clamp-3">{c.proposed_summary}</p>
                )}
                {isOpen && (
                  <div className="space-y-2 pt-1">
                    {c.proposed_body && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto rounded bg-muted/50 p-2">
                        {c.proposed_body}
                      </p>
                    )}
                    {(c.proposed_tags?.length ?? 0) > 0 && (
                      <p className="text-xs text-muted-foreground">Tags: {c.proposed_tags!.join(', ')}</p>
                    )}
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Steward notes (optional — saved with the decision)"
                      rows={2}
                      className="w-full resize-none rounded-md border bg-background px-2.5 py-1.5 text-base sm:text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={busyId !== null}
                        onClick={() => review(c.id, 'approve')}
                      >
                        {busyId === c.id ? (
                          <Loader2 className="size-3 mr-1 animate-spin" />
                        ) : (
                          <Check className="size-3 mr-1" />
                        )}
                        Approve — publishes to the commons
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={busyId !== null}
                        onClick={() => review(c.id, 'reject')}
                      >
                        <X className="size-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {decided.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent decisions</p>
          {decided.map(c => (
            <div key={c.id} className="flex items-center gap-2 text-xs">
              <Badge
                variant="outline"
                className={c.status === 'approved' ? 'text-green-600 border-green-600/40' : 'text-muted-foreground'}
              >
                {c.status}
              </Badge>
              <span className="truncate">{c.proposed_title}</span>
              {c.reviewed_at && (
                <span className="ml-auto text-muted-foreground/60 shrink-0">
                  {new Date(c.reviewed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Gallery: studio ↔ tool curation ---

function GalleryTab() {
  const tools = useKnowledgeStore(s => s.tools);
  const toolsLoaded = useKnowledgeStore(s => s.loaded);
  const loadAll = useKnowledgeStore(s => s.loadAll);
  const [studios, setStudios] = useState<StudioContext[]>([]);
  const [links, setLinks] = useState<GalleryLink[]>([]);
  const [studioSlug, setStudioSlug] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAll();
    Promise.all([listAllStudios(), fetchGalleryLinks()])
      .then(([allStudios, allLinks]) => {
        setStudios(allStudios);
        setLinks(allLinks);
        setStudioSlug(slug => slug || allStudios[0]?.slug || '');
      })
      .catch(() => setError('Could not load studios'))
      .finally(() => setLoading(false));
  }, [loadAll]);

  const linked = useMemo(
    () => new Set(links.filter(l => l.studio_slug === studioSlug).map(l => l.tool_id)),
    [links, studioSlug],
  );

  async function toggle(toolId: string, toolName: string) {
    if (!studioSlug) return;
    setBusyId(toolId);
    setError(null);
    try {
      if (linked.has(toolId)) {
        await adminRemoveGalleryLink(studioSlug, toolId);
        setLinks(ls => ls.filter(l => !(l.studio_slug === studioSlug && l.tool_id === toolId)));
      } else {
        await adminAddGalleryLink(studioSlug, toolId, toolName);
        setLinks(ls => [...ls, { studio_slug: studioSlug, tool_id: toolId }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change did not save');
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !toolsLoaded) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-3.5 animate-spin" /> Loading…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Mark which gallery tools belong to each studio — members see their
        studios' tools highlighted (and sorted first) in the Commons Gallery.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-1">
        {studios.map(s => (
          <button
            key={s.slug}
            onClick={() => setStudioSlug(s.slug)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
              studioSlug === s.slug
                ? 'bg-foreground text-background border-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span
              className="size-1.5 rounded-full shrink-0"
              style={{ background: s.color ?? 'hsl(var(--muted-foreground))' }}
            />
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
        {tools.map(t => {
          const isLinked = linked.has(t.id);
          return (
            <button
              key={t.id}
              disabled={busyId !== null}
              onClick={() => toggle(t.id, t.name)}
              className={`w-full flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs text-left transition-colors ${
                isLinked ? 'border-foreground/40 bg-muted/60' : 'hover:bg-muted/40'
              }`}
            >
              <span
                className={`size-3.5 rounded border flex items-center justify-center shrink-0 ${
                  isLinked ? 'bg-foreground text-background border-foreground' : ''
                }`}
              >
                {busyId === t.id ? (
                  <Loader2 className="size-2.5 animate-spin" />
                ) : isLinked ? (
                  <Check className="size-2.5" />
                ) : null}
              </span>
              <span className="truncate font-medium">{t.name}</span>
              <span className="ml-auto text-muted-foreground/60 shrink-0">{t.tool_category}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Gallery connections: cross-references between entries ---

interface RefOption {
  source: RefSource;
  id: string;
  title: string;
  kind: string | null;
  group: string;
}

const optionKey = (o: { source: RefSource; id: string }) => `${o.source}:${o.id}`;

function ConnectionsTab() {
  const tools = useKnowledgeStore(s => s.tools);
  const stories = useKnowledgeStore(s => s.stories);
  const loadAll = useKnowledgeStore(s => s.loadAll);
  const [refs, setRefs] = useState<GalleryReference[]>([]);
  const [remoteOptions, setRemoteOptions] = useState<RefOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromKey, setFromKey] = useState('');
  const [toKey, setToKey] = useState('');
  const [relation, setRelation] = useState<RefRelation>('mentions');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadAll();
    Promise.all([
      fetchGalleryReferences(),
      fetchCivicMediaCards().catch(() => []),
      fetchNeighboringRecipeCards().catch(() => []),
      fetchVisibleStudioItems().catch(() => []),
    ])
      .then(([allRefs, civic, neighboring, studioItems]) => {
        setRefs(allRefs);
        setRemoteOptions([
          ...civic.map(c => ({
            source: 'commons' as const, id: c.slug, title: c.title, kind: c.kind, group: 'Civic media',
          })),
          ...neighboring.map(c => ({
            source: 'commons' as const, id: c.slug, title: c.title, kind: c.kind, group: 'Neighboring recipes',
          })),
          ...studioItems.map(i => ({
            source: 'studio' as const, id: i.id, title: i.title, kind: i.kind, group: 'Studio libraries',
          })),
        ]);
      })
      .catch(() => setError('Could not load connections'))
      .finally(() => setLoading(false));
  }, [loadAll]);

  const refresh = useCallback(async () => {
    invalidateGalleryReferences();
    setRefs(await fetchGalleryReferences());
  }, []);

  const allOptions = useMemo<RefOption[]>(
    () => [
      ...tools.map(t => ({
        source: 'kb_tool' as const, id: t.id, title: t.name, kind: 'tool', group: 'Relational tech tools',
      })),
      ...stories.map(s => ({
        source: 'kb_story' as const, id: s.id, title: s.title ?? 'Community story', kind: 'story', group: 'Community stories',
      })),
      ...remoteOptions,
    ],
    [tools, stories, remoteOptions],
  );

  const groups = useMemo(() => {
    const map = new Map<string, RefOption[]>();
    for (const o of allOptions) map.set(o.group, [...(map.get(o.group) ?? []), o]);
    return [...map.entries()];
  }, [allOptions]);

  const byKey = useMemo(
    () => new Map(allOptions.map(o => [optionKey(o), o])),
    [allOptions],
  );

  // Suggested links lead — they're the queue; confirmed follow as the record
  const sorted = useMemo(
    () => [...refs].sort((a, b) =>
      (a.status === 'suggested' ? 0 : 1) - (b.status === 'suggested' ? 0 : 1)),
    [refs],
  );

  async function add() {
    const from = byKey.get(fromKey);
    const to = byKey.get(toKey);
    if (!from || !to || optionKey(from) === optionKey(to)) return;
    setSaving(true);
    setError(null);
    try {
      await adminAddReference({
        from_source: from.source, from_id: from.id, from_title: from.title, from_kind: from.kind,
        to_source: to.source, to_id: to.id, to_title: to.title, to_kind: to.kind,
        relation, note: note.trim() || null,
      });
      setFromKey(''); setToKey(''); setNote('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the connection');
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, action: 'confirm' | 'remove') {
    setBusyId(id);
    setError(null);
    try {
      if (action === 'confirm') await adminConfirmReference(id);
      else await adminRemoveReference(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change did not save');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-3.5 animate-spin" /> Loading connections…
      </p>
    );
  }

  const selectClass =
    'h-8 rounded-md border bg-background px-2 text-xs min-w-0 flex-1';

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Connections link gallery entries across the shelves — a story that
        features a tool, a recipe that pairs with a neighboring practice. They
        show in every entry's detail dialog and travel into the AI's context, so
        it can say where else something was used. Suggested links come from the
        scan script (<code>scripts/suggest-gallery-references.mjs</code>) and
        wait here for your eye.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="rounded-lg border px-3 py-2.5 space-y-2">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          <Link2 className="size-3" /> Add a connection
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <select value={fromKey} onChange={e => setFromKey(e.target.value)} className={selectClass}>
            <option value="">This entry…</option>
            {groups.map(([group, opts]) => (
              <optgroup key={group} label={group}>
                {opts.map(o => (
                  <option key={optionKey(o)} value={optionKey(o)}>{o.title}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            value={relation}
            onChange={e => setRelation(e.target.value as RefRelation)}
            className="h-8 rounded-md border bg-background px-2 text-xs shrink-0"
          >
            {RELATION_LABELS.map(r => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
          <select value={toKey} onChange={e => setToKey(e.target.value)} className={selectClass}>
            <option value="">…this entry</option>
            {groups.map(([group, opts]) => (
              <optgroup key={group} label={group}>
                {opts.map(o => (
                  <option key={optionKey(o)} value={optionKey(o)}>{o.title}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Why the pairing mattered (optional) — “worked well for listening sessions”"
            className="h-8 text-xs flex-1"
          />
          <Button
            size="sm"
            className="h-8 text-xs shrink-0"
            disabled={saving || !byKey.get(fromKey) || !byKey.get(toKey) || fromKey === toKey}
            onClick={add}
          >
            {saving ? <Loader2 className="size-3 animate-spin mr-1" /> : <Link2 className="size-3 mr-1" />}
            Connect
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No connections yet — add one above, or run the scan script to suggest
          links from what entries already say about each other.
        </p>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
          {sorted.map(r => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <span className="font-medium">{r.from_title}</span>
                  {r.from_kind && <span className="text-muted-foreground/60"> ({r.from_kind})</span>}
                  <span className="text-muted-foreground">
                    {' '}{RELATION_LABELS.find(o => o.key === r.relation)?.label ?? r.relation}{' '}
                  </span>
                  <span className="font-medium">{r.to_title}</span>
                  {r.to_kind && <span className="text-muted-foreground/60"> ({r.to_kind})</span>}
                </p>
                {r.note && <p className="text-muted-foreground truncate">{r.note}</p>}
              </div>
              {r.status === 'suggested' && (
                <>
                  <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-600/40 shrink-0">
                    suggested
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] shrink-0"
                    disabled={busyId !== null}
                    onClick={() => act(r.id, 'confirm')}
                  >
                    {busyId === r.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                    Confirm
                  </Button>
                </>
              )}
              <button
                disabled={busyId !== null}
                onClick={() => act(r.id, 'remove')}
                className="text-muted-foreground hover:text-destructive shrink-0"
                title="Remove connection"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Studio access: gated studios + Studio Admin grants ---

function StudioAccessTab() {
  const [studios, setStudios] = useState<StudioContext[]>([]);
  const [accessMap, setAccessMap] = useState<Map<string, StudioAccess>>(new Map());
  const [admins, setAdmins] = useState<Map<string, StudioMemberRow[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [allStudios, access] = await Promise.all([listAllStudios(), fetchStudioAccessMap()]);
      setStudios(allStudios);
      setAccessMap(access);
      const adminLists = await Promise.all(
        allStudios.map(async s => {
          const members = await listStudioMembers(s.slug);
          return [s.slug, members.filter(m => m.role === 'admin' && m.status === 'approved')] as const;
        }),
      );
      setAdmins(new Map(adminLists));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load studio access');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function toggleAccess(studio: StudioContext) {
    const current = accessMap.get(studio.slug) ?? 'open';
    const next: StudioAccess = current === 'gated' ? 'open' : 'gated';
    setBusyKey(`access-${studio.slug}`);
    setError(null);
    try {
      await stewardSetStudioAccess(studio.slug, next);
      setAccessMap(m => new Map(m).set(studio.slug, next));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change did not save');
    } finally {
      setBusyKey(null);
    }
  }

  async function setAdmin(studio: StudioContext, email: string, grant: boolean) {
    if (!email.trim()) return;
    setBusyKey(`admin-${studio.slug}`);
    setError(null);
    try {
      await stewardSetStudioAdmin(studio.slug, studio.label, email.trim(), grant);
      setEmails(e => ({ ...e, [studio.slug]: '' }));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change did not save');
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-3.5 animate-spin" /> Loading studios…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        A gated studio approves its members: joining files a request that its
        Studio Admins decide. Admins also tend the studio's private library —
        what approved members see in the gallery and in the AI's context.
        Granting admin is yours alone.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {studios.map(studio => {
        const gated = (accessMap.get(studio.slug) ?? 'open') === 'gated';
        const studioAdmins = admins.get(studio.slug) ?? [];
        return (
          <div key={studio.slug} className="rounded-lg border p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <span
                className="size-2 rounded-full shrink-0"
                style={{ background: studio.color ?? 'hsl(var(--muted-foreground))' }}
              />
              <span className="text-sm font-medium">{studio.label}</span>
              <Badge variant="outline" className="text-[10px]">
                {gated ? 'gated' : 'open'}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs ml-auto"
                disabled={busyKey !== null}
                onClick={() => toggleAccess(studio)}
              >
                {busyKey === `access-${studio.slug}` ? (
                  <Loader2 className="size-3 mr-1 animate-spin" />
                ) : gated ? (
                  <LockOpen className="size-3 mr-1" />
                ) : (
                  <Lock className="size-3 mr-1" />
                )}
                {gated ? 'Open it up' : 'Gate it'}
              </Button>
            </div>

            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                <KeyRound className="size-3" /> Studio admins
              </p>
              {studioAdmins.length === 0 ? (
                <p className="text-xs text-muted-foreground">None yet.</p>
              ) : (
                studioAdmins.map(a => (
                  <div key={a.user_id} className="flex items-center gap-2 text-xs">
                    <span className="truncate">{a.display_name || 'A builder'}</span>
                    <button
                      className="text-muted-foreground hover:text-foreground underline decoration-dotted ml-auto"
                      disabled={busyKey !== null}
                      onClick={() => {
                        const email = window.prompt(
                          `Revoke ${a.display_name || 'this admin'}'s role — confirm their account email:`,
                        );
                        if (email) void setAdmin(studio, email, false);
                      }}
                    >
                      revoke
                    </button>
                  </div>
                ))
              )}
              <div className="flex gap-1.5">
                <Input
                  value={emails[studio.slug] ?? ''}
                  onChange={e => setEmails(v => ({ ...v, [studio.slug]: e.target.value }))}
                  onKeyDown={e =>
                    e.key === 'Enter' && setAdmin(studio, emails[studio.slug] ?? '', true)
                  }
                  placeholder="builder@example.org"
                  className="h-7 text-xs flex-1"
                />
                <Button
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  disabled={busyKey !== null || !(emails[studio.slug] ?? '').trim()}
                  onClick={() => setAdmin(studio, emails[studio.slug] ?? '', true)}
                >
                  {busyKey === `admin-${studio.slug}` ? (
                    <Loader2 className="size-3 mr-1 animate-spin" />
                  ) : (
                    <KeyRound className="size-3 mr-1" />
                  )}
                  Grant admin
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
