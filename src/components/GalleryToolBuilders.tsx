import { useEffect, useState } from 'react';
import { listToolBuilders, type ToolBuilder } from '@/cloud/tool-builders';
import {
  fetchDirectoryCached,
  requestConnection,
  type DirectoryBuilder,
} from '@/knowledge/connections';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  HeartHandshake,
  CalendarClock,
  MailPlus,
  MapPin,
  Loader2,
  Check,
} from 'lucide-react';

/**
 * "The builder behind this tool" — inside a gallery tool's Details dialog.
 * Tools in the commons aren't just code to remix; there's a human who grew
 * them, and questions or kindred sparks deserve a path to that human. The
 * path is consent-first: the name is public credit, but call booking and
 * intro requests appear only when that builder's connection settings are
 * open (the same directory + double-opt-in machinery as Build with others).
 */
export function GalleryToolBuilders({ toolId }: { toolId: string }) {
  const user = useAuthStore(s => s.user);
  const [builders, setBuilders] = useState<ToolBuilder[] | null>(null);
  const [directory, setDirectory] = useState<Map<string, DirectoryBuilder>>(new Map());
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listToolBuilders(toolId).then(setBuilders).catch(() => setBuilders([]));
  }, [toolId]);

  // The directory needs a session; signed out we still show credit, just
  // without contact affordances
  useEffect(() => {
    if (!user) return;
    fetchDirectoryCached()
      .then(list => setDirectory(new Map(list.map(b => [b.id, b]))))
      .catch(() => {});
  }, [user]);

  if (!builders || builders.length === 0) return null;

  async function sendRequest(id: string) {
    setBusy(true);
    setError(null);
    try {
      await requestConnection(id, message);
      setSentIds(prev => new Set(prev).add(id));
      setRequestingId(null);
      setMessage('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the request');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <HeartHandshake className="size-3" />
        The builder{builders.length === 1 ? '' : 's'} behind this tool
      </p>
      {builders.map(tb => {
        const d = directory.get(tb.user_id);
        const name = d?.name ?? tb.builder_name ?? 'A community builder';
        const reachable = !!d && (!!d.cal_link || d.allow_requests);
        return (
          <div key={tb.user_id} className="border rounded-md px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-medium">{name}</span>
              <span className="text-xs text-muted-foreground">· {tb.role}</span>
              {d?.neighborhood && (
                <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                  <MapPin className="size-2.5" />
                  {d.neighborhood}
                </span>
              )}
            </div>
            {d?.note && <p className="text-xs text-muted-foreground">{d.note}</p>}

            {reachable ? (
              <div className="flex gap-3 items-center pt-0.5">
                {d.cal_link && (
                  <a
                    href={d.cal_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <CalendarClock className="size-3" />
                    Book a call
                  </a>
                )}
                {d.allow_requests &&
                  (sentIds.has(tb.user_id) ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Check className="size-3" />
                      Request sent — if they accept, you'll both get an intro email
                    </span>
                  ) : requestingId === tb.user_id ? null : (
                    <button
                      onClick={() => { setRequestingId(tb.user_id); setMessage(''); setError(null); }}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <MailPlus className="size-3" />
                      Request intro
                    </button>
                  ))}
              </div>
            ) : !user ? (
              <p className="text-xs text-muted-foreground">
                Questions, or inspired to build something like it?{' '}
                <button
                  onClick={() => useAuthStore.getState().promptSignIn()}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Sign in
                </button>{' '}
                to reach out.
              </p>
            ) : null}

            {requestingId === tb.user_id && (
              <div className="space-y-1.5 pt-1">
                <Input
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  maxLength={500}
                  placeholder={`A short note for ${name} — what sparked this, why you'd like to connect`}
                  className="h-8 text-xs"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setRequestingId(null)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button size="sm" className="h-6 text-xs" onClick={() => sendRequest(tb.user_id)} disabled={busy || !message.trim()}>
                    {busy ? <Loader2 className="size-3 animate-spin" /> : 'Send request'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  They get your note by email with accept/decline links. Only if
                  they accept do you both receive an intro — declining is silent.
                </p>
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
