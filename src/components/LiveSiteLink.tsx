import { useCallback, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Check, Copy, ExternalLink, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A live site's address, ready to hand to a neighbor: the link itself, one
 * tap to copy, one to open. Shared by the Share menu and the publish dialog
 * so "where's my link?" has the same answer everywhere.
 */
export function LiveSiteLink({
  url,
  hasPassphrase,
  className,
}: {
  url: string;
  hasPassphrase?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context, permissions) — the link is
      // still selectable text right there
    }
  }, [url]);
  const shortUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <div className={cn('space-y-1.5', className)}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-xs font-medium underline-offset-2 hover:underline break-all"
      >
        {shortUrl}
      </a>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={copy}>
          {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-7 gap-1 text-xs')}
        >
          <ExternalLink className="size-3" />
          Open
        </a>
      </div>
      {hasPassphrase && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Lock className="size-3 shrink-0" />
          Private — share the passphrase alongside the link.
        </p>
      )}
    </div>
  );
}
