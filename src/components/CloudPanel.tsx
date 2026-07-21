import { useCallback, useEffect, useState } from 'react';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { useEnvStore } from '@/store/env-store';
import {
  getCloudOverview,
  getCollections,
  getDocuments,
  deleteDocument,
  getMembers,
  renameApp,
  deleteApp,
  createAppForProject,
  attachAppToProject,
  detachAppFromProject,
  formatBytes,
  getSecretStatus,
  getEmailLog,
  updateSecretConfig,
  type CloudAppOverview,
  type CloudLimits,
  type CloudCollection,
  type CloudDocument,
  type CloudMember,
  type AppSecretStatus,
  type EmailLogRow,
} from '@/cloud/community-cloud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Cloud, Loader2, ChevronRight, ChevronLeft, Database, Users, Settings2,
  Trash2, RefreshCw, Copy, Check, Plug, Unplug, FileJson,
} from 'lucide-react';

/**
 * The Cloud tab: a builder's window into their Community Cloud — the
 * zero-setup backends behind their apps. See the data neighbors have
 * posted, who has signed in, usage against the free community tier
 * (3 backends, 20MB each), and manage everything without SQL.
 */
export function CloudPanel() {
  const user = useAuthStore(s => s.user);
  const [overview, setOverview] = useState<{ apps: CloudAppOverview[]; limits: CloudLimits } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openApp, setOpenApp] = useState<CloudAppOverview | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getCloudOverview();
      setOverview(data);
      // Keep the drill-in view pointing at fresh numbers
      setOpenApp(prev => prev && (data.apps.find(a => a.app_id === prev.app_id) ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your cloud');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!cloudEnabled || !user) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-2 max-w-xs">
          <Cloud className="size-8 mx-auto text-muted-foreground/60" />
          <p className="text-sm font-medium">
            Sign in to give your apps shared data — no setup
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Boards, RSVPs, and sign-ups your neighbors all see, hosted by RTP.
            No database to create, no keys to paste.
          </p>
        </div>
      </div>
    );
  }

  if (openApp) {
    return (
      <AppDetail
        app={openApp}
        limits={overview?.limits ?? { max_apps: 3, max_bytes: 20971520, max_docs: 5000 }}
        onBack={() => { setOpenApp(null); refresh(); }}
        onChanged={refresh}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Cloud className="size-4 text-green-600" />
              Your Community Cloud
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {overview
                ? `${overview.apps.length} of ${overview.limits.max_apps} free app backends`
                : 'Data for your apps, hosted by RTP'}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="size-7" onClick={refresh} disabled={loading} title="Refresh">
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          </Button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <ThisProjectCard overview={overview} onChanged={refresh} />

        {overview && overview.apps.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              App backends
            </p>
            {overview.apps.map(app => (
              <AppCard
                key={app.app_id}
                app={app}
                limits={overview.limits}
                onOpen={() => setOpenApp(app)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Whether the current project is wired to a backend, and to which one */
function useConnectedAppId(): string | null {
  const vars = useEnvStore(s => s.vars);
  return vars.find(v => v.key === 'APP_ID')?.value ?? null;
}

/**
 * The current project's connection: enable a fresh backend, or attach one
 * of the builder's existing backends — mirrors how projects and backends
 * are actually many-to-many.
 */
function ThisProjectCard({
  overview,
  onChanged,
}: {
  overview: { apps: CloudAppOverview[]; limits: CloudLimits } | null;
  onChanged: () => void;
}) {
  const connectedAppId = useConnectedAppId();
  const projectName = useCloudStore(s => s.currentProjectName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);

  const connectedApp = overview?.apps.find(a => a.app_id === connectedAppId) ?? null;
  const atLimit = !!overview && overview.apps.length >= overview.limits.max_apps;

  async function handleEnable() {
    setBusy(true);
    setError(null);
    try {
      await createAppForProject(projectName || 'my-community-app');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable Community Cloud');
    } finally {
      setBusy(false);
    }
  }

  if (connectedAppId) {
    return (
      <div className="rounded-lg border border-green-600/40 bg-green-600/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Plug className="size-3.5 text-green-600 shrink-0" />
              <span className="truncate">{connectedApp?.name ?? 'Connected backend'}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              This project reads and writes here — the AI uses it automatically.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs shrink-0"
            onClick={() => { detachAppFromProject(); onChanged(); }}
          >
            <Unplug className="size-3" />
            Detach
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">This project has no backend yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            One click adds shared data — boards, RSVPs, sign-ups just work.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(overview?.apps.length ?? 0) > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setChoosing(!choosing)}>
              {choosing ? 'Cancel' : 'Reuse'}
            </Button>
          )}
          <Button size="sm" className="h-7 text-xs" onClick={handleEnable} disabled={busy || atLimit}>
            {busy ? <Loader2 className="size-3 animate-spin" /> : 'Enable'}
          </Button>
        </div>
      </div>
      {atLimit && !choosing && (
        <p className="text-xs text-muted-foreground">
          You're using all {overview?.limits.max_apps} free backends — reuse one below, or remove one you no longer need.
        </p>
      )}
      {choosing && overview && (
        <div className="space-y-1 pt-1">
          {overview.apps.map(app => (
            <button
              key={app.app_id}
              className="w-full flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
              onClick={() => { attachAppToProject(app.app_id, app.app_key); setChoosing(false); onChanged(); }}
            >
              <span className="truncate">{app.name}</span>
              <span className="text-muted-foreground shrink-0">
                {app.doc_count} docs · {formatBytes(app.bytes)}
              </span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function UsageBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-1 rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full ${pct > 85 ? 'bg-destructive' : 'bg-green-600'}`}
        style={{ width: `${Math.max(2, pct)}%` }}
      />
    </div>
  );
}

function AppCard({
  app,
  limits,
  onOpen,
}: {
  app: CloudAppOverview;
  limits: CloudLimits;
  onOpen: () => void;
}) {
  const connectedAppId = useConnectedAppId();
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-lg border p-3 hover:bg-muted/60 transition-colors group"
    >
      <div className="flex items-center gap-2">
        <Database className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">{app.name}</span>
        {app.app_id === connectedAppId && (
          <Badge variant="outline" className="text-xs shrink-0 border-green-600/50 text-green-700 dark:text-green-400">
            this project
          </Badge>
        )}
        <ChevronRight className="size-3.5 text-muted-foreground ml-auto shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span>{app.doc_count.toLocaleString()} documents</span>
        <span>{app.member_count.toLocaleString()} neighbors</span>
        <span className="ml-auto">{formatBytes(app.bytes)} of {formatBytes(limits.max_bytes)}</span>
      </div>
      <div className="mt-1.5">
        <UsageBar value={app.bytes} max={limits.max_bytes} />
      </div>
    </button>
  );
}

// ── App detail: data browser, neighbors, settings ──────────────────

type DetailTab = 'data' | 'neighbors' | 'settings';

function AppDetail({
  app,
  limits,
  onBack,
  onChanged,
}: {
  app: CloudAppOverview;
  limits: CloudLimits;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>('data');

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-3 py-2 border-b shrink-0">
        <Button variant="ghost" size="icon" className="size-7" onClick={onBack} title="Back to your cloud">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium truncate">{app.name}</span>
        <div className="ml-auto flex gap-0.5">
          <DetailTabButton active={tab === 'data'} onClick={() => setTab('data')} icon={<Database className="size-3" />} label="Data" />
          <DetailTabButton active={tab === 'neighbors'} onClick={() => setTab('neighbors')} icon={<Users className="size-3" />} label="Neighbors" badge={app.member_count || undefined} />
          <DetailTabButton active={tab === 'settings'} onClick={() => setTab('settings')} icon={<Settings2 className="size-3" />} label="Settings" />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'data' && <DataBrowser appId={app.app_id} />}
        {tab === 'neighbors' && <NeighborsView appId={app.app_id} />}
        {tab === 'settings' && <AppSettings app={app} limits={limits} onBack={onBack} onChanged={onChanged} />}
      </div>
    </div>
  );
}

function DetailTabButton({
  active, onClick, icon, label, badge,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
        active ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && <span className="text-xs text-muted-foreground">{badge}</span>}
    </button>
  );
}

/** Collections → documents, like a tiny friendly database console */
function DataBrowser({ appId }: { appId: string }) {
  const [collections, setCollections] = useState<CloudCollection[] | null>(null);
  const [openCollection, setOpenCollection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCollections(appId)
      .then(r => setCollections(r.collections))
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load'));
  }, [appId]);

  if (openCollection) {
    return (
      <DocumentsView
        appId={appId}
        collection={openCollection}
        onBack={() => setOpenCollection(null)}
      />
    );
  }

  if (error) return <p className="text-xs text-destructive p-4">{error}</p>;
  if (!collections) {
    return <div className="p-6 flex justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>;
  }
  if (collections.length === 0) {
    return (
      <div className="p-6 text-center space-y-1.5">
        <FileJson className="size-6 mx-auto text-muted-foreground/60" />
        <p className="text-xs text-muted-foreground leading-relaxed max-w-56 mx-auto">
          No data yet. Once your app saves something — a post, an RSVP, a
          sign-up — it shows up here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-1.5">
      {collections.map(c => (
        <button
          key={c.collection}
          onClick={() => setOpenCollection(c.collection)}
          className="w-full flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left hover:bg-muted/60 transition-colors group"
        >
          <FileJson className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{c.collection}</span>
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {c.doc_count.toLocaleString()} · {formatBytes(c.bytes)}
          </span>
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </button>
      ))}
    </div>
  );
}

function DocumentsView({
  appId, collection, onBack,
}: {
  appId: string; collection: string; onBack: () => void;
}) {
  const [docs, setDocs] = useState<CloudDocument[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getDocuments(appId, collection, 100)
      .then(r => setDocs(r.documents))
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load'));
  }, [appId, collection]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this document? The app loses it immediately.')) return;
    await deleteDocument(appId, id);
    load();
  }

  return (
    <div className="p-3 space-y-2">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="size-3" />
        All collections
      </button>
      <p className="text-sm font-medium">{collection}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!docs && !error && (
        <div className="p-4 flex justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
      )}
      {docs && docs.length === 0 && (
        <p className="text-xs text-muted-foreground">Nothing here right now.</p>
      )}
      {docs?.map(doc => {
        const isOpen = expanded === doc.id;
        const preview = JSON.stringify(doc.data);
        return (
          <div key={doc.id} className="rounded-lg border overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : doc.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
            >
              <span className="text-xs font-mono text-muted-foreground truncate flex-1">
                {preview.length > 80 ? preview.slice(0, 80) + '…' : preview}
              </span>
              {doc.visibility === 'members' && (
                <Badge variant="outline" className="text-[9px] shrink-0">members-only</Badge>
              )}
            </button>
            {isOpen && (
              <div className="border-t px-3 py-2 space-y-2 bg-muted/30">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-56 overflow-y-auto">
                  {JSON.stringify(doc.data, null, 2)}
                </pre>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {doc.member_name ? `by ${doc.member_name}` : 'anonymous'} · {new Date(doc.created_at).toLocaleString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 text-xs text-destructive hover:text-destructive"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="size-3" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NeighborsView({ appId }: { appId: string }) {
  const [members, setMembers] = useState<CloudMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMembers(appId)
      .then(r => setMembers(r.members))
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load'));
  }, [appId]);

  if (error) return <p className="text-xs text-destructive p-4">{error}</p>;
  if (!members) {
    return <div className="p-6 flex justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>;
  }
  if (members.length === 0) {
    return (
      <div className="p-6 text-center space-y-1.5">
        <Users className="size-6 mx-auto text-muted-foreground/60" />
        <p className="text-xs text-muted-foreground leading-relaxed max-w-60 mx-auto">
          No neighbors have signed in yet. When your app uses the built-in
          email sign-in, the people who join show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="rounded-lg border divide-y">
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm truncate">{m.name || m.email}</p>
              {m.name && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
            </div>
            <span className="text-xs text-muted-foreground ml-auto shrink-0">
              joined {new Date(m.created_at).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppSettings({
  app, limits, onBack, onChanged,
}: {
  app: CloudAppOverview; limits: CloudLimits; onBack: () => void; onChanged: () => void;
}) {
  const [name, setName] = useState(app.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const connectedAppId = useConnectedAppId();

  async function handleRename() {
    if (!name.trim() || name.trim() === app.name) return;
    setSaving(true);
    try {
      await renameApp(app.app_id, name.trim());
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${app.name}" and everything in it? ${app.doc_count} documents and ${app.member_count} neighbor accounts will be gone for good.`)) return;
    setDeleting(true);
    try {
      await deleteApp(app.app_id);
      if (connectedAppId === app.app_id) detachAppFromProject();
      onChanged();
      onBack();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-4 space-y-5">
      <div className="space-y-1.5">
        <label className="text-xs font-medium">Name</label>
        <div className="flex gap-2">
          <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs shrink-0"
            onClick={handleRename}
            disabled={saving || !name.trim() || name.trim() === app.name}
          >
            {saving ? <Loader2 className="size-3 animate-spin" /> : 'Rename'}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium">Storage</label>
        <UsageBar value={app.bytes} max={limits.max_bytes} />
        <p className="text-xs text-muted-foreground">
          {formatBytes(app.bytes)} of {formatBytes(limits.max_bytes)} · {app.doc_count.toLocaleString()} of {limits.max_docs.toLocaleString()} documents
        </p>
      </div>

      <EmailSection appId={app.app_id} />

      <div className="space-y-1.5">
        <label className="text-xs font-medium">Connection</label>
        <CopyRow label="App ID" value={app.app_id} />
        <CopyRow label="App key" value={app.app_key} secret />
        <p className="text-xs text-muted-foreground leading-relaxed">
          These ship inside the app's pages, so everything stored here is
          community-public by design — great for shared neighborhood info,
          never for secrets.
        </p>
      </div>

      <div className="rounded-lg border border-destructive/30 p-3 space-y-1.5">
        <p className="text-xs font-medium text-destructive">Remove this backend</p>
        <p className="text-xs text-muted-foreground">
          Deletes all its data and neighbor accounts, and frees one of your {limits.max_apps} slots.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
          Delete app backend
        </Button>
      </div>
    </div>
  );
}

/**
 * Vaulted-email status for this backend: sends today against the daily cap,
 * the from-address (editable without re-pasting the key), and recent sends.
 * Connecting the key itself happens in the Services tab.
 */
function EmailSection({ appId }: { appId: string }) {
  const [status, setStatus] = useState<AppSecretStatus | null>(null);
  const [log, setLog] = useState<EmailLogRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ secrets }, { log: rows }] = await Promise.all([
          getSecretStatus(appId),
          getEmailLog(appId),
        ]);
        if (cancelled) return;
        const resend = secrets.find(s => s.service === 'resend') ?? null;
        setStatus(resend);
        setLog(rows);
        setFromName(resend?.config.from_name ?? '');
        setFromEmail(resend?.config.from_email ?? '');
      } catch {
        // Leave the section in its "not set up" state on load failure
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [appId]);

  if (!loaded) return null;

  if (!status) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium">Email</label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Not set up — connect Resend in the Services tab and apps on this
          backend can send email from the preview and hosted sites.
        </p>
      </div>
    );
  }

  const dirty =
    fromName.trim() !== (status.config.from_name ?? '') ||
    fromEmail.trim() !== (status.config.from_email ?? '');

  async function handleSaveFrom() {
    setSaving(true);
    setSaveError(null);
    try {
      const config = {
        ...status!.config,
        from_name: fromName.trim() || undefined,
        from_email: fromEmail.trim() || undefined,
      };
      await updateSecretConfig(appId, 'resend', config);
      setStatus({ ...status!, config });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium">Email</label>
      <p className="text-xs text-muted-foreground">
        {status.sends_today} of {status.daily_cap} sends today
        {status.last_used_at ? ` · last sent ${new Date(status.last_used_at).toLocaleDateString()}` : ' · not used yet'}
      </p>
      <div className="flex gap-2">
        <Input
          value={fromName}
          onChange={e => setFromName(e.target.value)}
          placeholder="From name"
          className="h-7 text-xs"
        />
        <Input
          value={fromEmail}
          onChange={e => setFromEmail(e.target.value)}
          placeholder="from@your-domain.org"
          className="h-7 text-xs font-mono"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs shrink-0"
          onClick={handleSaveFrom}
          disabled={saving || !dirty}
        >
          {saving ? <Loader2 className="size-3 animate-spin" /> : 'Save'}
        </Button>
      </div>
      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Leave blank to send from onboarding@resend.dev. A custom from-address
        needs its domain verified in Resend first.
      </p>
      {log.length > 0 && (
        <div className="rounded-md border divide-y max-h-40 overflow-y-auto">
          {log.map((row, i) => (
            <div key={i} className="px-2.5 py-1.5 text-xs flex items-center gap-2">
              <span className={`shrink-0 ${row.status === 'sent' ? 'text-green-600' : 'text-destructive'}`}>
                {row.status === 'sent' ? '✓' : '✕'}
              </span>
              <span className="font-mono truncate">{row.recipient}</span>
              <span className="text-muted-foreground truncate flex-1">{row.subject}</span>
              <span className="text-muted-foreground shrink-0">
                {new Date(row.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0 w-14">{label}</span>
      <code className="text-xs font-mono truncate flex-1">
        {secret ? value.slice(0, 6) + '••••••••' : value}
      </code>
      <button
        className="text-muted-foreground hover:text-foreground shrink-0"
        title={`Copy ${label}`}
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
      </button>
    </div>
  );
}
