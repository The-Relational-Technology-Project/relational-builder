import { useState } from 'react';
import { useChatStore } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  sharePrompt,
  unsharePrompt,
  deletePrompt,
  promptShareUrl,
  type BuildPrompt,
} from '@/cloud/prompts';
import { ScrollText, Copy, Check, Link2, Trash2, Hammer } from 'lucide-react';

/**
 * The builder's seed library: prompts distilled from things they've built.
 * Each one can be read in full (click the card), copied anywhere, shared as
 * a link, or planted right here to grow a fresh version.
 */
export function YourPrompts({
  prompts,
  onChanged,
  onBuildFrom,
}: {
  prompts: BuildPrompt[];
  onChanged: () => void;
  /** Called after a prompt is planted in the composer (e.g. to close a dialog) */
  onBuildFrom?: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [reading, setReading] = useState<BuildPrompt | null>(null);

  if (prompts.length === 0) return null;

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  }

  function buildFromPrompt(p: BuildPrompt) {
    useProjectStore.getState().setLineage({
      source: 'prompt',
      promptSlug: p.share_slug ?? undefined,
      promptTitle: p.title,
      importedAt: new Date().toISOString(),
    });
    useChatStore.getState().setDraftMessage(p.body);
    setReading(null);
    onBuildFrom?.();
  }

  async function toggleShare(p: BuildPrompt) {
    if (p.is_shared) await unsharePrompt(p.id);
    else await sharePrompt(p);
    onChanged();
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Your prompts
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {prompts.slice(0, 6).map(p => (
          <div key={p.id} className="border rounded-xl p-4 space-y-2">
            {/* The card's body is the door to the full prompt */}
            <button
              onClick={() => setReading(p)}
              className="block w-full text-left space-y-2 cursor-pointer group"
              title="Read the full prompt"
            >
              <div className="flex items-center gap-2">
                <ScrollText className="size-4 text-muted-foreground shrink-0" />
                <span className="text-[15px] font-medium truncate group-hover:underline decoration-dotted underline-offset-2">
                  {p.title}
                </span>
                {p.is_shared && (
                  <span className="ml-auto shrink-0 text-xs rounded-full border border-green-600/40 text-green-700 dark:text-green-400 px-1.5 py-0.5">
                    shared
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {p.body}
              </p>
            </button>
            <div className="flex items-center gap-2 pt-0.5 text-muted-foreground">
              <button
                onClick={() => buildFromPrompt(p)}
                className="inline-flex items-center gap-1 text-xs hover:text-foreground"
                title="Plant it in the composer — grow a fresh version"
              >
                <Hammer className="size-3" />
                Build from it
              </button>
              <button
                onClick={() => copy(`p-${p.id}`, p.body)}
                className="inline-flex items-center gap-1 text-xs hover:text-foreground"
                title="Copy the prompt"
              >
                {copied === `p-${p.id}` ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
                Copy
              </button>
              <button
                onClick={() =>
                  p.is_shared && p.share_slug
                    ? copy(`l-${p.id}`, promptShareUrl(p.share_slug))
                    : toggleShare(p)
                }
                className="inline-flex items-center gap-1 text-xs hover:text-foreground"
                title={p.is_shared ? 'Copy the share link' : 'Share as a link'}
              >
                {copied === `l-${p.id}` ? <Check className="size-3 text-green-600" /> : <Link2 className="size-3" />}
                {p.is_shared ? 'Copy link' : 'Share'}
              </button>
              <button
                onClick={async () => {
                  if (confirm(`Delete the prompt "${p.title}"?`)) {
                    await deletePrompt(p.id);
                    onChanged();
                  }
                }}
                className="ml-auto hover:text-destructive"
                title="Delete this prompt"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Full read view — the whole prompt, with the same actions in reach */}
      <Dialog open={!!reading} onOpenChange={v => !v && setReading(null)}>
        <DialogContent className="sm:max-w-lg">
          {reading && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-6">
                  <ScrollText className="size-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{reading.title}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="max-h-[55vh] overflow-y-auto rounded-lg border bg-muted/30 px-3 py-2.5">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{reading.body}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => buildFromPrompt(reading)}>
                  <Hammer className="size-3" />
                  Build from it
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => copy(`r-${reading.id}`, reading.body)}
                >
                  {copied === `r-${reading.id}` ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
                  Copy prompt
                </Button>
                <span className="ml-auto text-xs text-muted-foreground">
                  Saved{' '}
                  {new Date(reading.updated_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
