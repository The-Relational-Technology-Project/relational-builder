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
  adminCommunityUsage,
  type CommunityUsageReport,
  type MemberUsage,
} from '@/cloud/community-usage';
import { listAllStudios, DEFAULT_STUDIO_SLUG, type StudioContext } from '@/knowledge/studio-context';
import {
  fetchStudioAccessMap,
  listStudioMembers,
  stewardSetStudioAccess,
  stewardSetStudioAdmin,
  type StudioAccess,
  type StudioMemberRow,
} from '@/cloud/studios';
import {
  adminListEventCodes,
  adminCreateEventCode,
  adminSetEventCodeActive,
  adminReferralStats,
  eventInviteLink,
  type EventCode,
  type ReferralStat,
} from '@/cloud/event-codes';
import { openRoomKey } from '@/project/room-key';
import { useKnowledgeStore } from '@/store/knowledge-store';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Check, X, Loader2, ChevronDown, ChevronRight, ShieldCheck, KeyRound, Lock, LockOpen, Ticket, Copy, Printer, Trophy } from 'lucide-react';

/**
 * The Steward page — every steward task in one full-width space (these
 * queues outgrew a dialog):
 *  - Accounts: every builder, their place, and their cloud project count
 *  - Plan usage: the community plan cost leaderboard — who's building on the
 *    subsidized plan and what it's costing, today and all-time
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
              <TabsTrigger value="usage" className="text-xs px-3 sm:px-4">Plan usage</TabsTrigger>
              <TabsTrigger value="door" className="text-xs px-3 sm:px-4">Account requests</TabsTrigger>
              <TabsTrigger value="events" className="text-xs px-3 sm:px-4">Codes</TabsTrigger>
              <TabsTrigger value="commons" className="text-xs px-3 sm:px-4">Commons review</TabsTrigger>
              <TabsTrigger value="gallery" className="text-xs px-3 sm:px-4">Studio gallery</TabsTrigger>
              <TabsTrigger value="access" className="text-xs px-3 sm:px-4">Studio access</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="accounts" className="pt-4">
            <AccountsTab />
          </TabsContent>
          <TabsContent value="usage" className="pt-4">
            <UsageTab />
          </TabsContent>
          <TabsContent value="door" className="pt-4">
            <RequestsTab active />
          </TabsContent>
          <TabsContent value="events" className="pt-4">
            <EventsTab />
          </TabsContent>
          <TabsContent value="commons" className="pt-4">
            <CommonsTab />
          </TabsContent>
          <TabsContent value="gallery" className="pt-4">
            <GalleryTab />
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

// --- Plan usage: the community plan cost leaderboard ---

/** 1_234_567 → "1.2M", 45_600 → "46k" — tokens at a glance */
function fmtTokens(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 10e6 ? 0 : 1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
}

function fmtUsd(n: number): string {
  return n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`;
}

/** "claude-fable-5 $6.10 · claude-opus-5 $3.20" → "fable-5 $6.10 · opus-5 $3.20" */
function modelMix(models: MemberUsage['models']): string {
  return models
    .filter(m => m.usd >= 0.005)
    .slice(0, 3)
    .map(m => `${m.model.replace(/^claude-/, '')} ${fmtUsd(m.usd)}`)
    .join(' · ');
}

function UsageTab() {
  const [report, setReport] = useState<CommunityUsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'today' | 'all'>('today');

  useEffect(() => {
    adminCommunityUsage()
      .then(setReport)
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load plan usage'))
      .finally(() => setLoading(false));
  }, []);

  const ranked = useMemo(() => {
    if (!report) return [];
    const list =
      view === 'today'
        ? report.members.filter(m => m.today.tokens > 0)
        : report.members.filter(m => m.all_time.tokens > 0);
    return [...list].sort((a, b) =>
      view === 'today' ? b.today.usd - a.today.usd : b.all_time.usd - a.all_time.usd,
    );
  }, [report, view]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-3.5 animate-spin" /> Loading plan usage…
      </p>
    );
  }
  if (error || !report) {
    return <p className="text-xs text-destructive">{error ?? 'Could not load plan usage'}</p>;
  }

  const maxDayUsd = Math.max(...report.recent_days.map(d => d.usd), 0.01);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Estimated subsidized spend on the community plan, priced per model at
        the same rates as the monitor's alerts (cache traffic included). Days
        roll over at midnight UTC.
      </p>

      {/* The headline numbers */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Today</p>
          <p className="text-xl font-semibold tabular-nums">{fmtUsd(report.totals.today.usd)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {fmtTokens(report.totals.today.tokens)} tokens ·{' '}
            {report.members.filter(m => m.today.tokens > 0).length} building
          </p>
        </div>
        <div className="rounded-lg border px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">All time</p>
          <p className="text-xl font-semibold tabular-nums">{fmtUsd(report.totals.all_time.usd)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {fmtTokens(report.totals.all_time.tokens)} tokens · {report.members.length} {report.members.length === 1 ? 'builder' : 'builders'}
          </p>
        </div>
      </div>

      {/* Two weeks of daily spend, oldest first — the pulse */}
      <div className="rounded-lg border px-3 py-2.5 space-y-1.5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Last 14 days</p>
        <div className="flex items-end gap-1 h-12">
          {report.recent_days.map(d => (
            <div
              key={d.day}
              className="flex-1 rounded-sm bg-primary/70 min-h-[2px]"
              style={{ height: `${Math.max(4, (d.usd / maxDayUsd) * 100)}%` }}
              title={`${d.day}: ${fmtUsd(d.usd)} · ${fmtTokens(d.tokens)} tokens`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground/70 tabular-nums">
          <span>{report.recent_days[0]?.day.slice(5)}</span>
          <span>today</span>
        </div>
      </div>

      {/* The leaderboard */}
      <div className="flex items-center gap-1.5">
        <Trophy className="size-3.5 text-muted-foreground" />
        {(['today', 'all'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs transition-colors ${
              view === v
                ? 'bg-foreground text-background border-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v === 'today' ? 'Today' : 'All time'}
          </button>
        ))}
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {view === 'today'
            ? 'Nobody has built on the plan yet today.'
            : 'No plan usage recorded yet.'}
        </p>
      ) : (
        <div className="space-y-1.5">
          {ranked.map((m, i) => {
            const t = view === 'today' ? m.today : m.all_time;
            const budgetShare =
              view === 'today' && m.daily_budget
                ? Math.round((t.tokens / m.daily_budget) * 100)
                : null;
            return (
              <div key={m.email} className="rounded-lg border px-3 py-2 flex items-center gap-2.5">
                <span className="w-6 text-center shrink-0 text-sm tabular-nums text-muted-foreground">
                  {i < 3 ? medals[i] : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{m.name || m.email}</span>
                    {m.name && (
                      <span className="text-xs text-muted-foreground truncate">{m.email}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate tabular-nums">
                    {fmtTokens(t.tokens)} tokens · {t.requests} {t.requests === 1 ? 'request' : 'requests'}
                    {view === 'all' && ` · ${m.all_time.days_active} ${m.all_time.days_active === 1 ? 'day' : 'days'}`}
                    {budgetShare !== null && ` · ${budgetShare}% of today's budget`}
                    {view === 'all' && m.models.length > 0 && ` — ${modelMix(m.models)}`}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 tabular-nums">
                  {fmtUsd(t.usd)}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
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
              {/* Referred joins settle themselves — this badge is how the
                  steward keeps an eye on the self-serve door */}
              {r.referral_code && (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  code {r.referral_code}
                </Badge>
              )}
              {r.event_code && (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  event {r.event_code}
                </Badge>
              )}
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

// --- Events: room keys + who's opening the door ---

function EventsTab() {
  const [codes, setCodes] = useState<EventCode[]>([]);
  const [stats, setStats] = useState<ReferralStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [expires, setExpires] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [codeList, statList] = await Promise.all([
        adminListEventCodes(),
        adminReferralStats(),
      ]);
      setCodes(codeList);
      setStats(statList);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load event codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function create() {
    if (!name.trim()) return;
    setBusyKey('create');
    setError(null);
    try {
      // A date picked in the steward's timezone should last through that
      // whole day — expiry lands at local midnight after it
      const expiresAt = expires
        ? new Date(`${expires}T23:59:59`).toISOString()
        : undefined;
      const created = await adminCreateEventCode({
        name: name.trim(),
        code: customCode.trim() || undefined,
        expiresAt,
      });
      setCodes(list => [created, ...list]);
      setName('');
      setCustomCode('');
      setExpires('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the code');
    } finally {
      setBusyKey(null);
    }
  }

  async function setActive(code: EventCode, active: boolean) {
    setBusyKey(`active-${code.code}`);
    setError(null);
    try {
      await adminSetEventCodeActive(code.code, active);
      setCodes(list => list.map(c => (c.code === code.code ? { ...c, active } : c)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change did not save');
    } finally {
      setBusyKey(null);
    }
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(eventInviteLink(code));
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(current => (current === code ? null : current)), 2000);
    } catch {
      setError('Could not copy — the link is ' + eventInviteLink(code));
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-3.5 animate-spin" /> Loading event codes…
      </p>
    );
  }

  const expired = (c: EventCode) =>
    c.expires_at !== null && Date.parse(c.expires_at) < Date.now();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          An event code is a room key: everyone who joins with it gets in on the
          spot — no waiting on you — and their profile carries the event, so the
          Builder knows who was in the room together. Share the link, or put the
          code on a slide.
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="rounded-lg border p-3 space-y-2">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <Ticket className="size-3" /> New event code
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Event name — e.g. Oakland Build-a-thon"
              className="h-7 text-xs flex-1 min-w-40"
              maxLength={80}
            />
            <Input
              value={customCode}
              onChange={e => setCustomCode(e.target.value.toUpperCase())}
              placeholder="Code (blank = generated)"
              className="h-7 text-xs w-44 font-mono"
              maxLength={12}
            />
            <Input
              type="date"
              value={expires}
              onChange={e => setExpires(e.target.value)}
              title="Last day the code works (optional)"
              className="h-7 text-xs w-36"
            />
            <Button
              size="sm"
              className="h-7 text-xs shrink-0"
              disabled={busyKey !== null || !name.trim()}
              onClick={create}
            >
              {busyKey === 'create' ? (
                <Loader2 className="size-3 mr-1 animate-spin" />
              ) : (
                <Ticket className="size-3 mr-1" />
              )}
              Create
            </Button>
          </div>
        </div>

        {codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No event codes yet.</p>
        ) : (
          <div className="space-y-1.5">
            {codes.map(c => (
              <div key={c.code} className="rounded-lg border px-3 py-2 flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-sm font-semibold tracking-wide">{c.code}</span>
                <span className="text-sm truncate">{c.name}</span>
                <Badge variant="outline" className="shrink-0 tabular-nums">
                  {c.joined} joined
                </Badge>
                {!c.active ? (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">off</Badge>
                ) : expired(c) ? (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">expired</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-green-600 border-green-600/40 shrink-0">live</Badge>
                )}
                {c.expires_at && !expired(c) && (
                  <span className="text-xs text-muted-foreground/70 shrink-0">
                    until {new Date(c.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copyLink(c.code)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    title={eventInviteLink(c.code)}
                  >
                    {copiedCode === c.code ? <Check className="size-3" /> : <Copy className="size-3" />}
                    {copiedCode === c.code ? 'Copied' : 'Copy link'}
                  </button>
                  {/* The room key: a full-page QR + code for the projector,
                      the door, or a stack on the welcome table */}
                  <button
                    onClick={() => {
                      if (!openRoomKey({ name: c.name, code: c.code, link: eventInviteLink(c.code) })) {
                        setError('The room key opens in a new tab — allow pop-ups for this site');
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    title="Open a printable page: big QR code + the code itself"
                  >
                    <Printer className="size-3" />
                    Room key
                  </button>
                  <button
                    onClick={() => setActive(c, !c.active)}
                    disabled={busyKey !== null}
                    className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted"
                  >
                    {busyKey === `active-${c.code}` ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : c.active ? (
                      'turn off'
                    ) : (
                      'turn on'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Builders opening the door
        </p>
        <p className="text-xs text-muted-foreground">
          Everyone a builder has brought in — through their personal invite code
          or by inviting a collaborator to a project.
        </p>
        {stats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No referred joins yet.</p>
        ) : (
          stats.map(s => (
            <div key={s.code} className="flex items-center gap-2 text-xs rounded-lg border px-3 py-2">
              <span className="text-sm font-medium truncate">{s.name || s.email}</span>
              {s.name && <span className="text-muted-foreground truncate">{s.email}</span>}
              <Badge variant="outline" className="text-[10px] shrink-0 font-mono">{s.code}</Badge>
              <Badge variant="outline" className="ml-auto shrink-0 tabular-nums">
                {s.joined} joined
              </Badge>
            </div>
          ))
        )}
      </div>
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
      // The default Relational Tech studio isn't a door anyone stands at —
      // its frame and principles are standard for every builder out of the
      // box, so there's nothing to gate and no admins to grant. Only real
      // studios (a distinct community with its own shelf) are managed here.
      const [fetched, access] = await Promise.all([listAllStudios(), fetchStudioAccessMap()]);
      const allStudios = fetched.filter(s => s.slug !== DEFAULT_STUDIO_SLUG);
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
