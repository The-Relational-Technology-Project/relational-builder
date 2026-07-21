import { useState } from 'react';
import { useEnvStore } from '@/store/env-store';
import { useChatStore } from '@/store/chat-store';
import { useCloudStore } from '@/store/cloud-store';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import {
  INTEGRATIONS,
  GUIDED_SERVICES,
  getConnectedIntegrations,
  communityCloudConnected,
  type IntegrationDef,
  type GuidedServiceDef,
} from '@/integrations/catalog';
import { verifyIntegration, type VerifyResult } from '@/integrations/verify';
import {
  createAppForProject,
  setAppSecret,
  deleteAppSecret,
  testAppSecret,
} from '@/cloud/community-cloud';
import {
  patSet,
  patStatus,
  sbProjects,
  attachSupabaseProject,
  detachSupabaseProject,
  SUPABASE_MANAGED_KEY,
  type SbProject,
} from '@/cloud/supabase-admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, Cloud, ExternalLink, Loader2, MessageCircle, Unplug } from 'lucide-react';

/**
 * Guided BYOK service connections for the app being built (zero-setup data
 * lives in the Cloud tab). Connect checks the credentials against the live
 * service before anything is saved, so the green badge means "these keys
 * actually work" — then writes through the env-store, so preview injection,
 * share exclusion, and deploy env vars all work exactly like hand-entered
 * env vars. The AI is told what's connected.
 *
 * Below the connectable services sits the guided list: services without a
 * credentials-based connect, where the Builder walks through setup in chat.
 */
export function IntegrationsPanel() {
  const vars = useEnvStore(s => s.vars);
  const connected = new Set(getConnectedIntegrations(vars).map(d => d.id));

  return (
    <div className="h-full overflow-y-auto p-3 space-y-2.5">
      {INTEGRATIONS.map(def =>
        def.id === 'resend' ? (
          <ResendCard key={def.id} def={def} isConnected={connected.has(def.id)} />
        ) : def.id === 'supabase' ? (
          <SupabaseCard key={def.id} def={def} isConnected={connected.has(def.id)} />
        ) : (
          <IntegrationCard key={def.id} def={def} isConnected={connected.has(def.id)} />
        ),
      )}
      <p className="text-xs text-muted-foreground leading-relaxed px-1 pt-1">
        Connect checks your credentials against the service before saving them.
        The AI writes code for whatever you connect. Public keys flow into the
        live preview; secret keys are vaulted server-side with Community Cloud
        (and work everywhere), or reach Netlify or Vercel when you deploy.
      </p>

      <h3 className="text-xs font-semibold pt-3 px-1">More services</h3>
      <p className="text-xs text-muted-foreground leading-relaxed px-1 -mt-1">
        No Connect button for these — set them up together with the Builder
        instead. It knows the steps, the keys, and the wiring.
      </p>
      {GUIDED_SERVICES.map(def => (
        <GuidedServiceCard key={def.id} def={def} />
      ))}
    </div>
  );
}

/** Transient per-card verification state (session-only, env vars stay the source of truth) */
type CheckState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'done'; result: VerifyResult };

/**
 * Supabase gets the managed treatment: paste a personal access token once
 * (vaulted server-side) and pick a project — the Builder then wires the app's
 * env vars automatically and applies AI-written migrations / deploys edge
 * functions after a plain-language confirm. The manual URL+key path stays
 * for signed-out builders.
 */
function SupabaseCard({ def, isConnected }: { def: IntegrationDef; isConnected: boolean }) {
  const vars = useEnvStore(s => s.vars);
  const user = useAuthStore(s => s.user);
  const cloudAvailable = cloudEnabled && !!user;

  const managed = !!vars.find(v => v.key === SUPABASE_MANAGED_KEY && v.value.trim());
  const projectRef = vars.find(v => v.key === 'SUPABASE_PROJECT_REF')?.value ?? '';

  const [expanded, setExpanded] = useState(false);
  const [patInput, setPatInput] = useState('');
  const [patConnected, setPatConnected] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<SbProject[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  if (!cloudAvailable) {
    return <IntegrationCard def={def} isConnected={isConnected} />;
  }

  async function handleExpand() {
    setExpanded(!expanded);
    setNote(null);
    if (!expanded && patConnected === null) {
      try {
        const status = await patStatus();
        setPatConnected(status.connected);
        if (status.connected) await loadProjects();
      } catch {
        setPatConnected(false);
      }
    }
  }

  async function loadProjects() {
    const res = await sbProjects();
    setProjects(res.projects.filter(p => p.status !== 'INACTIVE'));
  }

  async function handlePatConnect() {
    const secret = patInput.trim();
    if (!secret) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await patSet(secret);
      setPatInput('');
      setPatConnected(true);
      setNote({ tone: 'ok', text: `Token verified — ${res.projects_count} project${res.projects_count === 1 ? '' : 's'} found.` });
      await loadProjects();
    } catch (err) {
      setNote({ tone: 'error', text: err instanceof Error ? err.message : 'Could not save the token' });
    } finally {
      setBusy(false);
    }
  }

  async function handlePick(project: SbProject) {
    setBusy(true);
    setNote(null);
    try {
      await attachSupabaseProject(project);
      setExpanded(false);
    } catch (err) {
      setNote({ tone: 'error', text: err instanceof Error ? err.message : 'Could not read that project' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{def.name}</span>
            {managed ? (
              <Badge className="text-xs gap-0.5 bg-green-600 hover:bg-green-600">
                <Check className="size-2.5" />
                Managed
              </Badge>
            ) : isConnected ? (
              <Badge className="text-xs gap-0.5 bg-green-600 hover:bg-green-600">
                <Check className="size-2.5" />
                Connected
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{def.tagline}</p>
        </div>
        {managed ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs shrink-0"
            onClick={() => { detachSupabaseProject(); setNote(null); }}
          >
            <Unplug className="size-3" />
            Detach
          </Button>
        ) : (
          <Button
            variant={expanded ? 'ghost' : 'outline'}
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={handleExpand}
          >
            {expanded ? 'Cancel' : 'Connect'}
          </Button>
        )}
      </div>

      {managed && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your own database (<code className="font-mono">{projectRef}</code>), operated by the
          Builder — migrations apply and edge functions deploy automatically after your OK.
        </p>
      )}

      {note && (
        <p className={`text-xs leading-relaxed flex items-start gap-1.5 ${note.tone === 'ok' ? 'text-green-700 dark:text-green-500' : 'text-destructive'}`}>
          {note.tone === 'ok' ? <Check className="size-3 mt-0.5 shrink-0" /> : <AlertTriangle className="size-3 mt-0.5 shrink-0" />}
          <span>{note.text}</span>
        </p>
      )}

      {expanded && !managed && (
        <div className="space-y-2 pt-1">
          {patConnected === false && (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Paste a Supabase personal access token and the Builder runs your
                database for you: migrations applied after your OK, edge functions
                deployed, keys wired automatically. The token is vaulted server-side.
              </p>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={patInput}
                  onChange={e => { setPatInput(e.target.value); setNote(null); }}
                  placeholder="sbp_..."
                  className="h-7 text-xs font-mono"
                />
                <Button size="sm" className="h-7 text-xs shrink-0" disabled={!patInput.trim() || busy} onClick={handlePatConnect}>
                  {busy ? <Loader2 className="size-3 animate-spin" /> : 'Verify'}
                </Button>
              </div>
              <a
                href="https://supabase.com/dashboard/account/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground underline hover:text-foreground inline-flex items-center gap-1"
              >
                supabase.com → Account → Access Tokens <ExternalLink className="size-2.5" />
              </a>
            </>
          )}
          {patConnected && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium">Pick the project this app should use:</p>
              {projects === null ? (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              ) : projects.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No active projects — create one (free) at supabase.com, then reopen this card.
                </p>
              ) : (
                projects.map(p => (
                  <button
                    key={p.ref}
                    className="w-full text-left rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                    disabled={busy}
                    onClick={() => handlePick(p)}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground ml-2 font-mono">{p.ref}</span>
                  </button>
                ))
              )}
            </div>
          )}
          {patConnected === null && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </div>
      )}
    </div>
  );
}

/**
 * Resend gets the managed-capability treatment: with Community Cloud on,
 * the key is vaulted server-side (never in the env store, never in the
 * browser) and email works in the preview and on community-hosted sites.
 * The plain secret-env-var path stays available for Netlify/Vercel-only
 * builders, and is the whole card when cloud isn't an option.
 */
function ResendCard({ def, isConnected }: { def: IntegrationDef; isConnected: boolean }) {
  const vars = useEnvStore(s => s.vars);
  const setVar = useEnvStore(s => s.setVar);
  const removeVar = useEnvStore(s => s.removeVar);
  const user = useAuthStore(s => s.user);
  const projectName = useCloudStore(s => s.currentProjectName);

  const cloudAvailable = cloudEnabled && !!user;
  const cloudAttached = communityCloudConnected(vars);
  const appId = vars.find(v => v.key === 'APP_ID')?.value ?? '';
  const viaCloud = !!vars.find(v => v.key === 'COMMUNITY_EMAIL' && v.value.trim());
  const legacyKeySet = !!vars.find(v => v.key === 'RESEND_API_KEY' && v.value.trim());

  const [expanded, setExpanded] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState<'idle' | 'enabling' | 'connecting' | 'testing'>('idle');
  const [note, setNote] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  // Legacy secret-env-var connection (or no cloud in reach): the standard card
  if (!cloudAvailable || (legacyKeySet && !viaCloud)) {
    return <IntegrationCard def={def} isConnected={isConnected} />;
  }

  async function handleEnableCloud() {
    setBusy('enabling');
    setNote(null);
    try {
      await createAppForProject(projectName || 'my-community-app');
    } catch (err) {
      setNote({ tone: 'error', text: err instanceof Error ? err.message : 'Could not enable Community Cloud' });
    } finally {
      setBusy('idle');
    }
  }

  async function handleConnect() {
    const key = keyInput.trim();
    if (!key || !appId) return;
    setBusy('connecting');
    setNote(null);
    try {
      await setAppSecret(appId, 'resend', key);
      const test = await testAppSecret(appId, 'resend');
      if (!test.ok) {
        // A key Resend rejects doesn't belong in the vault
        await deleteAppSecret(appId, 'resend').catch(() => {});
        setNote({ tone: 'error', text: test.error ?? 'Resend rejected this key' });
        return;
      }
      setVar('COMMUNITY_EMAIL', 'on', false);
      setKeyInput('');
      setExpanded(false);
      const domains = test.verified_domains ?? [];
      setNote({
        tone: 'ok',
        text: domains.length
          ? `Key verified with Resend. You can send from: ${domains.join(', ')} — set the from-address in the Cloud tab.`
          : 'Key verified with Resend. Sends from onboarding@resend.dev until you verify a domain in Resend.',
      });
    } catch (err) {
      setNote({ tone: 'error', text: err instanceof Error ? err.message : 'Could not save the key' });
    } finally {
      setBusy('idle');
    }
  }

  async function handleTest() {
    if (!appId) return;
    setBusy('testing');
    try {
      const test = await testAppSecret(appId, 'resend');
      setNote(
        test.ok
          ? { tone: 'ok', text: 'Key checks out with Resend.' }
          : { tone: 'error', text: test.error ?? 'Resend rejected this key' },
      );
    } catch (err) {
      setNote({ tone: 'error', text: err instanceof Error ? err.message : 'Could not test the key' });
    } finally {
      setBusy('idle');
    }
  }

  async function handleDisconnect() {
    if (appId) await deleteAppSecret(appId, 'resend').catch(() => {});
    removeVar('COMMUNITY_EMAIL');
    setNote(null);
  }

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{def.name}</span>
            {viaCloud && (
              <Badge className="text-xs gap-0.5 bg-green-600 hover:bg-green-600">
                <Check className="size-2.5" />
                Connected
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{def.tagline}</p>
        </div>
        {viaCloud ? (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={busy !== 'idle'} onClick={handleTest}>
              {busy === 'testing' ? <Loader2 className="size-3 animate-spin" /> : 'Test'}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleDisconnect}>
              <Unplug className="size-3" />
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            variant={expanded ? 'ghost' : 'outline'}
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={() => { setExpanded(!expanded); setNote(null); }}
          >
            {expanded ? 'Cancel' : 'Connect'}
          </Button>
        )}
      </div>

      {viaCloud && (
        <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
          <Cloud className="size-3 mt-0.5 shrink-0 text-green-600" />
          <span>
            Your key is vaulted server-side — email works in the preview and on
            your community-hosted site. Sending history lives in the Cloud tab.
          </span>
        </p>
      )}

      {note && (
        <p
          className={`text-xs leading-relaxed flex items-start gap-1.5 ${
            note.tone === 'ok' ? 'text-green-700 dark:text-green-500' : note.tone === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-500'
          }`}
        >
          {note.tone === 'ok' ? <Check className="size-3 mt-0.5 shrink-0" /> : <AlertTriangle className="size-3 mt-0.5 shrink-0" />}
          <span>{note.text}</span>
        </p>
      )}

      {expanded && !viaCloud && (
        <div className="space-y-2 pt-1">
          {!cloudAttached ? (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Turn on Community Cloud first and your Resend key gets vaulted
                server-side — email then works everywhere, including the live
                preview. No Netlify or Vercel account needed.
              </p>
              <Button size="sm" className="h-7 text-xs gap-1.5" disabled={busy !== 'idle'} onClick={handleEnableCloud}>
                {busy === 'enabling' ? <Loader2 className="size-3 animate-spin" /> : <Cloud className="size-3" />}
                Turn on Community Cloud
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  API key
                  <Badge variant="outline" className="text-[9px]">vaulted server-side</Badge>
                </label>
                <Input
                  type="password"
                  value={keyInput}
                  onChange={e => { setKeyInput(e.target.value); setNote(null); }}
                  placeholder="re_..."
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <a
                  href={def.keysUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground underline hover:text-foreground inline-flex items-center gap-1"
                >
                  {def.keysLabel} <ExternalLink className="size-2.5" />
                </a>
                <Button size="sm" className="h-7 text-xs gap-1.5" disabled={!keyInput.trim() || busy !== 'idle'} onClick={handleConnect}>
                  {busy === 'connecting' && <Loader2 className="size-3 animate-spin" />}
                  {busy === 'connecting' ? 'Checking…' : 'Connect Resend'}
                </Button>
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground leading-relaxed">{def.setupHint}</p>
        </div>
      )}
    </div>
  );
}

function IntegrationCard({ def, isConnected }: { def: IntegrationDef; isConnected: boolean }) {
  const vars = useEnvStore(s => s.vars);
  const setVar = useEnvStore(s => s.setVar);
  const removeVar = useEnvStore(s => s.removeVar);

  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      def.fields.map(f => [f.envKey, vars.find(v => v.key === f.envKey)?.value ?? '']),
    ),
  );
  const [expanded, setExpanded] = useState(false);
  const [check, setCheck] = useState<CheckState>({ phase: 'idle' });

  const allFilled = def.fields.every(f => (inputs[f.envKey] ?? '').trim());
  const checking = check.phase === 'checking';
  const result = check.phase === 'done' ? check.result : null;

  function saveVars(values: Record<string, string>) {
    for (const f of def.fields) {
      setVar(f.envKey, values[f.envKey].trim(), f.isSecret);
    }
    setExpanded(false);
  }

  async function handleConnect() {
    setCheck({ phase: 'checking' });
    const values = Object.fromEntries(def.fields.map(f => [f.envKey, (inputs[f.envKey] ?? '').trim()]));
    const outcome = await verifyIntegration(def.id, values);
    setCheck({ phase: 'done', result: outcome });
    // Confirmed working — and "unverifiable" is as good as it gets for
    // services that refuse browser checks, so save honestly rather than
    // pretending a check happened.
    if (outcome.status === 'ok' || outcome.status === 'unverifiable') {
      saveVars(values);
    }
  }

  /** "Connect anyway" after an inconclusive check */
  function handleConnectAnyway() {
    saveVars(Object.fromEntries(def.fields.map(f => [f.envKey, (inputs[f.envKey] ?? '').trim()])));
  }

  /** Re-check a connected service using whatever the env vars hold now */
  async function handleTest() {
    setCheck({ phase: 'checking' });
    const values = Object.fromEntries(
      def.fields.map(f => [f.envKey, vars.find(v => v.key === f.envKey)?.value ?? '']),
    );
    setCheck({ phase: 'done', result: await verifyIntegration(def.id, values) });
  }

  function handleDisconnect() {
    for (const f of def.fields) {
      removeVar(f.envKey);
      setInputs(prev => ({ ...prev, [f.envKey]: '' }));
    }
    setCheck({ phase: 'idle' });
  }

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{def.name}</span>
            {isConnected && (
              <Badge className="text-xs gap-0.5 bg-green-600 hover:bg-green-600">
                <Check className="size-2.5" />
                Connected
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{def.tagline}</p>
        </div>
        {isConnected ? (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={checking}
              onClick={handleTest}
            >
              {checking ? <Loader2 className="size-3 animate-spin" /> : 'Test'}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleDisconnect}>
              <Unplug className="size-3" />
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            variant={expanded ? 'ghost' : 'outline'}
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={() => {
              setExpanded(!expanded);
              setCheck({ phase: 'idle' });
            }}
          >
            {expanded ? 'Cancel' : 'Connect'}
          </Button>
        )}
      </div>

      {/* Result of a Test on a connected card, or an unverifiable-save note */}
      {isConnected && result && <ResultNote result={result} />}

      {expanded && !isConnected && (
        <div className="space-y-2 pt-1">
          {def.fields.map(f => (
            <div key={f.envKey} className="space-y-1">
              <label className="text-xs font-medium flex items-center gap-1.5">
                {f.label}
                <code className="text-xs text-muted-foreground font-normal">{f.envKey}</code>
                {f.isSecret && <Badge variant="outline" className="text-[9px]">secret</Badge>}
              </label>
              <Input
                type={f.isSecret ? 'password' : 'text'}
                value={inputs[f.envKey] ?? ''}
                onChange={e => {
                  setInputs(prev => ({ ...prev, [f.envKey]: e.target.value }));
                  if (check.phase === 'done') setCheck({ phase: 'idle' });
                }}
                placeholder={f.placeholder}
                className="h-7 text-xs font-mono"
              />
            </div>
          ))}

          {result && <ResultNote result={result} />}

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <a
              href={def.keysUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground underline hover:text-foreground inline-flex items-center gap-1"
            >
              {def.keysLabel} <ExternalLink className="size-2.5" />
            </a>
            <div className="flex items-center gap-1.5">
              {result?.status === 'unknown' && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleConnectAnyway}>
                  Connect anyway
                </Button>
              )}
              <Button size="sm" className="h-7 text-xs gap-1.5" disabled={!allFilled || checking} onClick={handleConnect}>
                {checking && <Loader2 className="size-3 animate-spin" />}
                {checking ? 'Checking…' : result?.status === 'invalid' || result?.status === 'unknown' ? 'Check again' : `Connect ${def.name}`}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{def.setupHint}</p>
        </div>
      )}
    </div>
  );
}

function ResultNote({ result }: { result: VerifyResult }) {
  if (result.status === 'ok') {
    return (
      <p className="text-xs text-green-700 dark:text-green-500 flex items-start gap-1.5">
        <Check className="size-3 mt-0.5 shrink-0" />
        <span>{result.detail ?? 'Credentials check out.'}</span>
      </p>
    );
  }
  const tone =
    result.status === 'invalid'
      ? 'text-destructive'
      : 'text-amber-700 dark:text-amber-500';
  return (
    <p className={`text-xs leading-relaxed flex items-start gap-1.5 ${tone}`}>
      <AlertTriangle className="size-3 mt-0.5 shrink-0" />
      <span>{result.message}</span>
    </p>
  );
}

function GuidedServiceCard({ def }: { def: GuidedServiceDef }) {
  const setDraftMessage = useChatStore(s => s.setDraftMessage);
  const [handedOff, setHandedOff] = useState(false);

  function handleAsk() {
    setDraftMessage(def.chatPrompt);
    setHandedOff(true);
    setTimeout(() => setHandedOff(false), 3000);
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <a
            href={def.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium hover:underline inline-flex items-center gap-1"
          >
            {def.name} <ExternalLink className="size-2.5 text-muted-foreground" />
          </a>
          <p className="text-xs text-muted-foreground">{def.tagline}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 shrink-0"
          onClick={handleAsk}
        >
          <MessageCircle className="size-3" />
          Set up in chat
        </Button>
      </div>
      {handedOff && (
        <p className="text-xs text-green-700 dark:text-green-500 pt-1.5">
          Ready in the chat box — press send and the Builder will walk you through it.
        </p>
      )}
    </div>
  );
}
