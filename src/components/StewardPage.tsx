import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminListRequests,
  adminDecideRequest,
  type AccountRequest,
} from '@/cloud/account-requests';
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
import { listAllStudios, type StudioContext } from '@/knowledge/studio-context';
import { useKnowledgeStore } from '@/store/knowledge-store';
import { useUIStore } from '@/store/ui-store';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';

/**
 * The Steward page — every steward task in one full-width space (these
 * queues outgrew a dialog):
 *  - Accounts: every builder, their place, and their cloud project count
 *  - Account requests: pending requests, one-tap approve/decline
 *  - Commons review: the RT Commons contribution review queue (absorbed
 *    from RT Studio; decisions flow through the commons' review function)
 *  - Studio gallery: which Studio Gallery tools belong to which studios,
 *    powering studio-scoped highlighting
 * Visibility is gated by email client-side for convenience; the
 * admin-requests edge function is the real boundary.
 */
export function StewardPage() {
  const setStewardOpen = useUIStore(s => s.setStewardOpen);

  return (
    <div className="flex-1 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="size-6 text-primary shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Steward</h1>
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs shrink-0" onClick={() => setStewardOpen(false)}>
            <X className="size-3.5" />
            Close
          </Button>
        </div>
        <Tabs defaultValue="accounts">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="accounts" className="flex-1 sm:flex-none text-xs sm:px-4">Accounts</TabsTrigger>
            <TabsTrigger value="door" className="flex-1 sm:flex-none text-xs sm:px-4">Account requests</TabsTrigger>
            <TabsTrigger value="commons" className="flex-1 sm:flex-none text-xs sm:px-4">Commons review</TabsTrigger>
            <TabsTrigger value="gallery" className="flex-1 sm:flex-none text-xs sm:px-4">Studio gallery</TabsTrigger>
          </TabsList>
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
                <span className="ml-auto text-xs text-muted-foreground/70 shrink-0">
                  {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
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
                      className="w-full resize-none rounded-md border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
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
        studios' tools highlighted (and sorted first) in the Studio Gallery.
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
