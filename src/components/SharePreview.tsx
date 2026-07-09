import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/project-store';
import { useEnvStore } from '@/store/env-store';
import { createPreviewLink } from '@/project/share-preview';
import { needsBuild, buildStaticSite } from '@/project/build-for-publish';
import {
  Share2,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Eye,
  Code2,
} from 'lucide-react';

export function SharePreview({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Preview</DialogTitle>
        </DialogHeader>
        <ShareContent />
      </DialogContent>
    </Dialog>
  );
}

function ShareContent() {
  const getAllFiles = useProjectStore(s => s.getAllFiles);
  const getPublicEnvVars = useEnvStore(s => s.getPublic);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    previewUrl: string;
    editorUrl: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<'preview' | 'editor' | null>(null);

  const handleCreate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const files = getAllFiles();
      const publicVars = getPublicEnvVars();
      // Framework projects share the BUILT site (a static page runs anywhere;
      // the share host doesn't need to understand the RB stack)
      const shareFiles = needsBuild(files)
        ? await buildStaticSite(files, publicVars.map(v => ({ key: v.key, value: v.value })))
        : files;
      const res = await createPreviewLink(shareFiles, publicVars);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create preview');
    } finally {
      setLoading(false);
    }
  }, [getAllFiles]);

  const copyToClipboard = useCallback(async (url: string, field: 'preview' | 'editor') => {
    await navigator.clipboard.writeText(url);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  if (!result) {
    return (
      <div className="space-y-4 pt-2">
        <p className="text-sm text-muted-foreground">
          Create a shareable preview link that anyone can open — no signup or
          install needed. Perfect for sharing with neighbors.
        </p>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <Button onClick={handleCreate} disabled={loading} className="w-full gap-2">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creating preview...
            </>
          ) : (
            <>
              <Share2 className="size-4" />
              Create Preview Link
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Hosted on CodeSandbox — free, no account required
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Preview URL — the main one for neighbors */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Eye className="size-3.5 text-muted-foreground" />
          <label className="text-xs font-medium">Preview link</label>
          <span className="text-xs text-muted-foreground ml-auto">
            Share this with neighbors
          </span>
        </div>
        <div className="flex gap-1.5">
          <div className="flex-1 bg-muted rounded-md px-3 py-2 text-xs font-mono truncate">
            {result.previewUrl}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 shrink-0"
            onClick={() => copyToClipboard(result.previewUrl, 'preview')}
          >
            {copiedField === 'preview' ? (
              <Check className="size-3.5 text-green-600" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
          <a href={result.previewUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 shrink-0">
              <ExternalLink className="size-3.5" />
            </Button>
          </a>
        </div>
      </div>

      {/* Editor URL — for developers */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Code2 className="size-3.5 text-muted-foreground" />
          <label className="text-xs font-medium">Editor link</label>
          <span className="text-xs text-muted-foreground ml-auto">
            View &amp; edit the code
          </span>
        </div>
        <div className="flex gap-1.5">
          <div className="flex-1 bg-muted rounded-md px-3 py-2 text-xs font-mono truncate">
            {result.editorUrl}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 shrink-0"
            onClick={() => copyToClipboard(result.editorUrl, 'editor')}
          >
            {copiedField === 'editor' ? (
              <Check className="size-3.5 text-green-600" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
          <a href={result.editorUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 shrink-0">
              <ExternalLink className="size-3.5" />
            </Button>
          </a>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Preview links stay live on CodeSandbox. Anyone with the link can view the app.
      </p>
    </div>
  );
}
