import { useState } from 'react';
import { useEnvStore } from '@/store/env-store';
import {
  INTEGRATIONS,
  getConnectedIntegrations,
  type IntegrationDef,
} from '@/integrations/catalog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, ExternalLink, Unplug } from 'lucide-react';

/**
 * Guided BYOK service connections for the app being built (zero-setup data
 * lives in the Cloud tab). Writes through the env-store, so preview
 * injection, share exclusion, and deploy env vars all work exactly like
 * hand-entered env vars. The AI is told what's connected.
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
        The AI writes code for whatever you connect. Public keys flow into the
        live preview; secret keys only reach Netlify or Vercel when you deploy.
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
              <Badge className="text-xs gap-0.5 bg-green-600 hover:bg-green-600">
                <Check className="size-2.5" />
                Connected
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{def.tagline}</p>
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
              <label className="text-xs font-medium flex items-center gap-1.5">
                {f.label}
                <code className="text-xs text-muted-foreground font-normal">{f.envKey}</code>
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
              className="text-xs text-muted-foreground underline hover:text-foreground inline-flex items-center gap-1"
            >
              {def.keysLabel} <ExternalLink className="size-2.5" />
            </a>
            <Button size="sm" className="h-7 text-xs" disabled={!allFilled} onClick={handleConnect}>
              Connect {def.name}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{def.setupHint}</p>
        </div>
      )}
    </div>
  );
}
