import { useState } from 'react';
import { useEnvStore } from '@/store/env-store';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { builderClient } from '@/cloud/builder-client';
import {
  INTEGRATIONS,
  getConnectedIntegrations,
  communityCloudConnected,
  type IntegrationDef,
} from '@/integrations/catalog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, ExternalLink, Unplug, Cloud, Loader2 } from 'lucide-react';

/**
 * Guided service connections for the app being built. Writes through the
 * env-store, so preview injection, share exclusion, and deploy env vars
 * all work exactly like hand-entered env vars.
 */
export function IntegrationsPanel() {
  const vars = useEnvStore(s => s.vars);
  const connected = new Set(getConnectedIntegrations(vars).map(d => d.id));

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Connect services for the app you're building. The AI knows what's
        connected and generates code that uses it — public keys flow into the
        live preview, secret keys only reach Netlify/Vercel at deploy time.
      </p>
      <CommunityCloudCard />
      {INTEGRATIONS.map(def => (
        <IntegrationCard key={def.id} def={def} isConnected={connected.has(def.id)} />
      ))}
    </div>
  );
}

/**
 * Community Cloud: one click gives this project zero-setup shared storage
 * hosted by RTP. Public-by-design — right for boards, calendars, signups.
 */
function CommunityCloudCard() {
  const vars = useEnvStore(s => s.vars);
  const setVar = useEnvStore(s => s.setVar);
  const removeVar = useEnvStore(s => s.removeVar);
  const user = useAuthStore(s => s.user);
  const projectName = useCloudStore(s => s.currentProjectName);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = communityCloudConnected(vars);
  if (!cloudEnabled) return null;

  async function handleEnable() {
    if (!builderClient) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await builderClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError('Sign in (top right) to enable Community Cloud.');
        return;
      }
      const url = import.meta.env.VITE_BUILDER_SUPABASE_URL;
      const res = await fetch(`${url}/functions/v1/app-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'create_app', name: projectName || 'my-community-app' }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? 'Could not enable Community Cloud');
        return;
      }
      setVar('COMMUNITY_CLOUD_URL', `${url}/functions/v1/app-data`, false);
      setVar('APP_ID', result.app_id, false);
      setVar('APP_KEY', result.app_key, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable Community Cloud');
    } finally {
      setBusy(false);
    }
  }

  function handleDisable() {
    for (const key of ['COMMUNITY_CLOUD_URL', 'APP_ID', 'APP_KEY']) removeVar(key);
  }

  return (
    <div className="rounded-lg border border-dashed border-green-600/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Cloud className="size-3.5 text-green-600 shrink-0" />
            <span className="text-sm font-medium">Community Cloud</span>
            {isConnected && (
              <Badge className="text-[10px] gap-0.5 bg-green-600 hover:bg-green-600">
                <Check className="size-2.5" />
                Enabled
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Zero-setup shared data for your app, hosted by RTP
          </p>
        </div>
        {isConnected ? (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs shrink-0" onClick={handleDisable}>
            <Unplug className="size-3" />
            Disable
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={handleEnable}
            disabled={busy || !user}
            title={!user ? 'Sign in to enable' : undefined}
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : 'Enable'}
          </Button>
        )}
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        {isConnected
          ? 'The AI will store this app\'s shared data (posts, events, signups) here automatically. Community-public by design — great for open neighborhood info, never for secrets.'
          : !user
            ? 'Sign in (top right), then enable — no accounts or setup needed for the neighbors who use your app.'
            : 'One click gives this project a shared data store — no Supabase account, no SQL, no keys to paste.'}
      </p>
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

  const allFilled = def.fields.every(f => (inputs[f.envKey] ?? '').trim());

  function handleConnect() {
    for (const f of def.fields) {
      setVar(f.envKey, inputs[f.envKey].trim(), f.isSecret);
    }
    setExpanded(false);
  }

  function handleDisconnect() {
    for (const f of def.fields) {
      removeVar(f.envKey);
      setInputs(prev => ({ ...prev, [f.envKey]: '' }));
    }
  }

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{def.name}</span>
            {isConnected && (
              <Badge className="text-[10px] gap-0.5 bg-green-600 hover:bg-green-600">
                <Check className="size-2.5" />
                Connected
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">{def.tagline}</p>
        </div>
        {isConnected ? (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs shrink-0" onClick={handleDisconnect}>
            <Unplug className="size-3" />
            Disconnect
          </Button>
        ) : (
          <Button
            variant={expanded ? 'ghost' : 'outline'}
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Cancel' : 'Connect'}
          </Button>
        )}
      </div>

      {expanded && !isConnected && (
        <div className="space-y-2 pt-1">
          {def.fields.map(f => (
            <div key={f.envKey} className="space-y-1">
              <label className="text-[11px] font-medium flex items-center gap-1.5">
                {f.label}
                <code className="text-[10px] text-muted-foreground font-normal">{f.envKey}</code>
                {f.isSecret && <Badge variant="outline" className="text-[9px]">secret</Badge>}
              </label>
              <Input
                type={f.isSecret ? 'password' : 'text'}
                value={inputs[f.envKey] ?? ''}
                onChange={e => setInputs(prev => ({ ...prev, [f.envKey]: e.target.value }))}
                placeholder={f.placeholder}
                className="h-7 text-xs font-mono"
              />
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <a
              href={def.keysUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-muted-foreground underline hover:text-foreground inline-flex items-center gap-1"
            >
              {def.keysLabel} <ExternalLink className="size-2.5" />
            </a>
            <Button size="sm" className="h-7 text-xs" disabled={!allFilled} onClick={handleConnect}>
              Connect {def.name}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">{def.setupHint}</p>
        </div>
      )}
    </div>
  );
}
