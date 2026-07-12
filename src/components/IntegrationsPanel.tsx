import { useState } from 'react';
import { useEnvStore } from '@/store/env-store';
import { useChatStore } from '@/store/chat-store';
import {
  INTEGRATIONS,
  GUIDED_SERVICES,
  getConnectedIntegrations,
  type IntegrationDef,
  type GuidedServiceDef,
} from '@/integrations/catalog';
import { verifyIntegration, type VerifyResult } from '@/integrations/verify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, ExternalLink, Loader2, MessageCircle, Unplug } from 'lucide-react';

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
      {INTEGRATIONS.map(def => (
        <IntegrationCard key={def.id} def={def} isConnected={connected.has(def.id)} />
      ))}
      <p className="text-xs text-muted-foreground leading-relaxed px-1 pt-1">
        Connect checks your credentials against the service before saving them.
        The AI writes code for whatever you connect. Public keys flow into the
        live preview; secret keys only reach Netlify or Vercel when you deploy.
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
