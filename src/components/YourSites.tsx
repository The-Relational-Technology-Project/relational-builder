import { useEffect, useState } from 'react';
import { listCommunitySites, deleteCommunitySite, type CommunitySite } from '@/project/community-sites';
import { Button } from '@/components/ui/button';
import { Globe, Eye, MessageCircle, Trash2, ExternalLink, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * A builder's live community-hosted sites: views (is it alive?), neighbor
 * notes (is it serving?), and take-down. The dashboard's evidence-of-value
 * surface — what a local relational technologist shows their neighborhood.
 */
export function YourSites() {
  const [sites, setSites] = useState<CommunitySite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    listCommunitySites()
      .then(setSites)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function handleDelete(slug: string) {
    setDeleting(slug);
    try {
      await deleteCommunitySite(slug);
      setSites(s => (s ?? []).filter(site => site.slug !== slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not take the site down');
    } finally {
      setDeleting(null);
      setConfirming(null);
    }
  }

  if (error && !sites?.length) return null; // quiet when backend unreachable
  if (!sites || sites.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Your live sites
      </p>
      <div className="space-y-2">
        {sites.map(site => {
          const isExpanded = expanded === site.slug;
          return (
            <div key={site.slug} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="size-3.5 text-muted-foreground shrink-0" />
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium truncate hover:underline inline-flex items-center gap-1"
                >
                  {site.name}
                  <ExternalLink className="size-3 text-muted-foreground" />
                </a>
                <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
                  <span className="inline-flex items-center gap-1" title={`${site.week_views} this week`}>
                    <Eye className="size-3" />
                    {site.total_views}
                    {site.week_views > 0 && <span className="text-green-600 dark:text-green-400">+{site.week_views}/wk</span>}
                  </span>
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-40"
                    onClick={() => setExpanded(isExpanded ? null : site.slug)}
                    disabled={site.feedback.length === 0}
                    title={site.feedback.length ? 'Notes from neighbors' : 'No notes yet'}
                  >
                    <MessageCircle className="size-3" />
                    {site.feedback.length}
                    {site.feedback.length > 0 && (isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
                  </button>
                  {confirming === site.slug ? (
                    <span className="inline-flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-5 px-1.5 text-[10px]"
                        onClick={() => handleDelete(site.slug)}
                        disabled={deleting !== null}
                      >
                        {deleting === site.slug ? <Loader2 className="size-3 animate-spin" /> : 'Take down'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px]"
                        onClick={() => setConfirming(null)}
                        disabled={deleting !== null}
                      >
                        Keep
                      </Button>
                    </span>
                  ) : (
                    <button
                      className="hover:text-destructive"
                      onClick={() => setConfirming(site.slug)}
                      title="Take this site down"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              </div>
              {isExpanded && site.feedback.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t">
                  {site.feedback.map(note => (
                    <div key={note.id} className="text-xs">
                      <span className="text-muted-foreground">
                        {note.name || 'A neighbor'} · {new Date(note.created_at).toLocaleDateString()}:
                      </span>{' '}
                      {note.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Neighbors can leave notes right on your site — they land here.
      </p>
    </div>
  );
}
