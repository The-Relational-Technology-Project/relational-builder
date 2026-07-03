import { useState, useCallback } from 'react';
import { useEnvStore, type EnvVar } from '@/store/env-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function EnvPanel() {
  const vars = useEnvStore((s) => s.vars);
  const setVar = useEnvStore((s) => s.setVar);
  const removeVar = useEnvStore((s) => s.removeVar);

  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Environment Variables</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Add API keys and config. Public vars are injected into the preview.
          Secret vars are only sent at deploy time.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {showAdd && (
          <AddVarForm
            onSave={(key, value, isSecret) => {
              setVar(key, value, isSecret);
              setShowAdd(false);
            }}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {vars.length === 0 && !showAdd && (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-muted-foreground">No variables yet</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs gap-1"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="size-3" />
              Add variable
            </Button>
          </div>
        )}

        <div className="divide-y">
          {vars.map((v) => (
            <EnvVarRow
              key={v.key}
              envVar={v}
              onUpdate={(value, isSecret) => setVar(v.key, value, isSecret)}
              onDelete={() => removeVar(v.key)}
            />
          ))}
        </div>
      </div>

      {vars.some((v) => v.isSecret) && (
        <div className="px-3 py-2 border-t bg-muted/30">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="size-3 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Secret vars are stored locally and sent only to deploy platforms
              (Netlify/Vercel). They are never included in shared previews.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Variable Form ────────────────────────────────────────────────

function AddVarForm({
  onSave,
  onCancel,
}: {
  onSave: (key: string, value: string, isSecret: boolean) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [isSecret, setIsSecret] = useState(false);

  const handleSave = useCallback(() => {
    const trimmedKey = key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!trimmedKey || !value.trim()) return;
    onSave(trimmedKey, value.trim(), isSecret);
  }, [key, value, isSecret, onSave]);

  return (
    <div className="px-3 py-2 border-b bg-muted/20 space-y-2">
      <Input
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="VARIABLE_NAME"
        className="h-7 text-xs font-mono"
        autoFocus
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
      />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="value"
        type={isSecret ? 'password' : 'text'}
        className="h-7 text-xs font-mono"
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
      />
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsSecret(!isSecret)}
          className={cn(
            'inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 transition-colors',
            isSecret
              ? 'bg-amber-500/10 text-amber-600'
              : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          {isSecret ? (
            <>
              <Lock className="size-2.5" /> Secret
            </>
          ) : (
            <>
              <Unlock className="size-2.5" /> Public
            </>
          )}
        </button>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-6 text-xs"
            onClick={handleSave}
            disabled={!key.trim() || !value.trim()}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Variable Row ─────────────────────────────────────────────────────

function EnvVarRow({
  envVar,
  onUpdate,
  onDelete,
}: {
  envVar: EnvVar;
  onUpdate: (value: string, isSecret: boolean) => void;
  onDelete: () => void;
}) {
  const [showValue, setShowValue] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(envVar.value);

  const handleSave = useCallback(() => {
    if (editValue.trim()) {
      onUpdate(editValue.trim(), envVar.isSecret);
    }
    setEditing(false);
  }, [editValue, envVar.isSecret, onUpdate]);

  return (
    <div className="px-3 py-2 space-y-1 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {envVar.isSecret ? (
            <Lock className="size-2.5 text-amber-500" />
          ) : (
            <Unlock className="size-2.5 text-muted-foreground" />
          )}
          <span className="text-xs font-mono font-medium">{envVar.key}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setShowValue(!showValue)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            {showValue ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          </button>
          <button
            onClick={() => {
              setEditValue(envVar.value);
              setEditing(true);
            }}
            className="p-1 rounded hover:bg-muted text-xs text-muted-foreground hover:text-foreground"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="flex gap-1">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            type={envVar.isSecret ? 'password' : 'text'}
            className="h-6 text-xs font-mono flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
          <Button size="sm" className="h-6 text-xs px-2" onClick={handleSave}>
            Save
          </Button>
        </div>
      ) : (
        <p className="text-xs font-mono text-muted-foreground truncate">
          {showValue ? envVar.value : '•'.repeat(Math.min(envVar.value.length, 24))}
        </p>
      )}
    </div>
  );
}
