import { useState } from 'react';
import { useEnvStore } from '@/store/env-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Cpu, Home, KeyRound, Users } from 'lucide-react';
import {
  ALL_RUNTIME_ENV_KEYS,
  COMMUNITY_DEFAULT,
  LOCAL_DEFAULTS,
  describeRuntime,
  effectiveRuntime,
  readRuntime,
  runtimeEnvVars,
  type ProjectRuntime,
  type RuntimeKind,
} from './runtime';

/**
 * "Where this app's AI runs": the project's runtime setting, behind the
 * human-scale flag at the top of the Services tab. Writes the setting as
 * public env vars through the env store (see runtime.ts for why), so the
 * preview, exports and deploys all carry it without further wiring.
 */
export function RuntimeSettings() {
  const vars = useEnvStore(s => s.vars);
  const setVar = useEnvStore(s => s.setVar);
  const removeVar = useEnvStore(s => s.removeVar);
  const explicit = readRuntime(vars);
  const runtime = effectiveRuntime(vars) ?? COMMUNITY_DEFAULT;
  const [endpoint, setEndpoint] = useState(runtime.endpoint ?? LOCAL_DEFAULTS.endpoint);
  const [model, setModel] = useState(runtime.model ?? LOCAL_DEFAULTS.model);

  const write = (next: ProjectRuntime) => {
    const keep = new Set(runtimeEnvVars(next).map(v => v.key));
    for (const key of ALL_RUNTIME_ENV_KEYS) if (!keep.has(key)) removeVar(key);
    for (const v of runtimeEnvVars(next)) setVar(v.key, v.value, false);
  };

  const choose = (kind: RuntimeKind) => {
    if (kind === 'local') write({ kind, endpoint, model, fallback: runtime.fallback });
    else write({ kind, fallback: 'none' });
  };

  const options: Array<{ kind: RuntimeKind; label: string; icon: typeof Users; blurb: string }> = [
    { kind: 'community', label: 'Community', icon: Users, blurb: 'An open model the community can host. No key. The default.' },
    { kind: 'local', label: 'Local', icon: Home, blurb: 'A model on this device or a computer in the room. Nothing leaves.' },
    { kind: 'byok', label: 'Your key', icon: KeyRound, blurb: 'The AI service you connected below, by your explicit choice.' },
  ];

  return (
    <section className="rounded-lg border border-border bg-card p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <Cpu className="size-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight">Where this app's AI runs</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
            The model that helps you build is one thing; the model your finished app
            calls is another. This sets the second one, and it travels with the app.
            {explicit ? '' : ' Not set yet, so the default applies.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Where this app's AI runs">
        {options.map(o => {
          const active = runtime.kind === o.kind;
          const Icon = o.icon;
          return (
            <button
              key={o.kind}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(o.kind)}
              className={`rounded-md border p-2 text-left transition-colors ${
                active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Icon className="size-3.5" /> {o.label}
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug mt-1">{o.blurb}</p>
            </button>
          );
        })}
      </div>

      {runtime.kind === 'local' && (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="hs-rt-endpoint" className="text-xs">Endpoint</Label>
              <Input
                id="hs-rt-endpoint"
                value={endpoint}
                onChange={e => setEndpoint(e.target.value)}
                onBlur={() => write({ ...runtime, kind: 'local', endpoint: endpoint.trim() || LOCAL_DEFAULTS.endpoint, model })}
                placeholder={LOCAL_DEFAULTS.endpoint}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hs-rt-model" className="text-xs">Model</Label>
              <Input
                id="hs-rt-model"
                value={model}
                onChange={e => setModel(e.target.value)}
                onBlur={() => write({ ...runtime, kind: 'local', endpoint, model: model.trim() || LOCAL_DEFAULTS.model })}
                placeholder={LOCAL_DEFAULTS.model}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={runtime.fallback === 'community'}
              onChange={e => write({ ...runtime, kind: 'local', endpoint, model, fallback: e.target.checked ? 'community' : 'none' })}
            />
            <span>
              If the local model is not reachable, let Community AI answer instead
              (the app says so when it happens). Off means the app waits and nothing is sent anywhere else.
            </span>
          </label>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Ollama serves this at <code>http://localhost:11434/v1</code> once you run{' '}
            <code>OLLAMA_ORIGINS=* ollama serve</code>. A published (https) app can reach a model
            on the visitor's own device, but not a computer at a private address in the room;
            for that, open the app from that computer or serve it on the same network.
          </p>
        </div>
      )}

      <p className="text-xs leading-relaxed border-t border-border pt-2">
        {describeRuntime(runtime)}
      </p>

      {explicit && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => { for (const key of ALL_RUNTIME_ENV_KEYS) removeVar(key); }}
          >
            Clear setting
          </Button>
        </div>
      )}
    </section>
  );
}
