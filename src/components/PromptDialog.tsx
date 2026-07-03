import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCloudStore } from '@/store/cloud-store';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { distillBuildPrompt, promptLineage } from '@/knowledge/prompt-distiller';
import {
  getPromptForProject,
  savePrompt,
  sharePrompt,
  unsharePrompt,
  promptShareUrl,
  type BuildPrompt,
} from '@/cloud/prompts';
import { ScrollText, Sparkles, Loader2, Copy, Check, Link2, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * "Prompt to Build This" — the project's most remixable artifact, treated
 * as first-class. Distill the conversation into one self-contained prompt,
 * keep it with the project, and share it as a link that grows new versions
 * in other gardens.
 */
export function PromptDialog() {
  const [open, setOpen] = useState(false);
  const currentProjectId = useCloudStore(s => s.currentProjectId);
  const user = useAuthStore(s => s.user);

  const [existing, setExisting] = useState<BuildPrompt | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [distilling, setDistilling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'prompt' | 'link' | null>(null);

  const canSave = cloudEnabled && !!user;
  const dirty = existing ? (title !== existing.title || body !== existing.body) : !!body;

  // Load the project's prompt when the dialog opens
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!canSave || !currentProjectId) return;
    getPromptForProject(currentProjectId)
      .then(p => {
        setExisting(p);
        if (p) {
          setTitle(p.title);
          setBody(p.body);
          setShareUrl(p.is_shared && p.share_slug ? promptShareUrl(p.share_slug) : null);
        }
      })
      .catch(() => {});
  }, [open, canSave, currentProjectId]);

  async function handleDistill() {
    setDistilling(true);
    setError(null);
    try {
      const result = await distillBuildPrompt();
      setTitle(result.title);
      setBody(result.body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the prompt');
    } finally {
      setDistilling(false);
    }
  }

  async function handleSave() {
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await savePrompt({
        id: existing?.id,
        project_id: currentProjectId,
        title: title.trim() || 'Build prompt',
        body: body.trim(),
        lineage: existing?.lineage ?? promptLineage(),
      });
      setExisting(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function handleShareToggle() {
    if (!existing) return;
    setError(null);
    try {
      if (shareUrl) {
        await unsharePrompt(existing.id);
        setShareUrl(null);
        setExisting({ ...existing, is_shared: false });
      } else {
        const { slug, url } = await sharePrompt(existing);
        setShareUrl(url);
        setExisting({ ...existing, is_shared: true, share_slug: slug });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update sharing');
    }
  }

  function copy(what: 'prompt' | 'link', text: string) {
    navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1200);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-7 gap-1 text-xs')}
        title="The prompt that would build this — create it, keep it, share it"
      >
        <ScrollText className="size-3" />
        Prompt
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Prompt to build this</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            The prompt is what travels. Anyone can take it to grow their own
            version — new models, their neighborhood, their aesthetics.
          </p>

          {!body && (
            <Button onClick={handleDistill} disabled={distilling} className="w-full gap-2">
              {distilling ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Reading the whole build…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Create the prompt from this build
                </>
              )}
            </Button>
          )}

          {body && (
            <>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Name this prompt"
                className="h-8 text-sm font-medium"
              />
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={10}
                className="w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => copy('prompt', body)}
                >
                  {copied === 'prompt' ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
                  Copy prompt
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={handleDistill}
                  disabled={distilling}
                >
                  {distilling ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                  Redo
                </Button>
                <div className="ml-auto flex items-center gap-1.5">
                  {canSave && currentProjectId && (
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleSave}
                      disabled={saving || !dirty}
                    >
                      {saving ? <Loader2 className="size-3 animate-spin" /> : existing ? (dirty ? 'Save changes' : 'Saved') : 'Save with project'}
                    </Button>
                  )}
                </div>
              </div>

              {canSave && !currentProjectId && (
                <p className="text-[11px] text-muted-foreground">
                  Save this project to the cloud to keep and share its prompt.
                </p>
              )}

              {existing && (
                <div className="rounded-lg border border-dashed p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium inline-flex items-center gap-1.5">
                      <Globe className="size-3.5 text-muted-foreground" />
                      {shareUrl ? 'Shared — anyone with the link can build from it' : 'Share this prompt'}
                    </p>
                    <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={handleShareToggle}>
                      {shareUrl ? 'Stop sharing' : 'Share'}
                    </Button>
                  </div>
                  {shareUrl && (
                    <button
                      onClick={() => copy('link', shareUrl)}
                      className="w-full flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground truncate"
                      title="Copy the remix link"
                    >
                      <Link2 className="size-3 shrink-0" />
                      <span className="truncate">{shareUrl}</span>
                      {copied === 'link'
                        ? <Check className="size-3 text-green-600 ml-auto shrink-0" />
                        : <Copy className="size-3 ml-auto shrink-0" />}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
