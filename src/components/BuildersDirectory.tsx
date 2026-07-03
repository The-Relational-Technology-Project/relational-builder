import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { fetchDirectory, requestConnection, type DirectoryBuilder } from '@/knowledge/connections';
import { ConnectionsDialog } from '@/components/ConnectionsDialog';
import { plantSharedPrompt } from '@/cloud/prompts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HeartHandshake, CalendarClock, MailPlus, Loader2, MapPin, Check, ScrollText } from 'lucide-react';

const STEWARD_CAL = 'https://cal.com/joshnesbit/';

/**
 * The relational layer on the home screen: RTP steward support (advising,
 * gift builds, walkthroughs, partnership) and the directory of builders who
 * opted into connecting. Consent-first throughout — cal links are standing
 * consent to be booked; intros are double-opt-in by email; emails never
 * appear in the UI.
 */
export function BuildersDirectory() {
  const profile = useAuthStore(s => s.profile);
  const [builders, setBuilders] = useState<DirectoryBuilder[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDirectory().then(setBuilders).catch(() => setBuilders([]));
  }, []);

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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Build with others
        </p>
        <button
          onClick={() => setSettingsOpen(true)}
          className="text-[11px] text-muted-foreground hover:text-foreground underline decoration-dotted"
        >
          {profile?.open_to_connecting ? 'Your connection settings' : 'Open yourself to connecting'}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {/* RTP stewards — always available */}
        <div className="border rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <HeartHandshake className="size-3.5 text-primary shrink-0" />
            RTP stewards
          </div>
          <p className="text-[11px] text-muted-foreground">
            Advising, gift builds (we build your first version with you),
            Builder walkthroughs, partnership exploration.
          </p>
          <div className="flex gap-2 pt-0.5">
            <a
              href={STEWARD_CAL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <CalendarClock className="size-3" />
              Book a call
            </a>
            <a
              href="mailto:humans@relationaltechproject.org"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <MailPlus className="size-3" />
              Write to us
            </a>
          </div>
        </div>

        {(builders ?? []).map(b => (
          <div key={b.id} className="border rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span className="truncate">{b.name}</span>
              {b.neighborhood && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-normal shrink-0">
                  <MapPin className="size-2.5" />
                  {b.neighborhood}
                </span>
              )}
            </div>
            {b.note && <p className="text-[11px] text-muted-foreground">{b.note}</p>}
            {(b.prompts?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {b.prompts!.map(p => (
                  <button
                    key={p.slug}
                    onClick={() => plantSharedPrompt(p.slug)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                    title={`Grow your own version of "${p.title}"`}
                  >
                    <ScrollText className="size-2.5" />
                    <span className="truncate max-w-36">{p.title}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-0.5 items-center">
              {b.cal_link && (
                <a
                  href={b.cal_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <CalendarClock className="size-3" />
                  Book a call
                </a>
              )}
              {b.allow_requests && (sentIds.has(b.id) ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Check className="size-3" />
                  Request sent — if they accept, you'll both get an intro email
                </span>
              ) : requestingId === b.id ? null : (
                <button
                  onClick={() => { setRequestingId(b.id); setMessage(''); setError(null); }}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <MailPlus className="size-3" />
                  Request intro
                </button>
              ))}
            </div>
            {requestingId === b.id && (
              <div className="space-y-1.5 pt-1">
                <Input
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  maxLength={500}
                  placeholder={`A short note for ${b.name} — what you're building, why you'd like to connect`}
                  className="h-8 text-xs"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setRequestingId(null)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button size="sm" className="h-6 text-[11px]" onClick={() => sendRequest(b.id)} disabled={busy || !message.trim()}>
                    {busy ? <Loader2 className="size-3 animate-spin" /> : 'Send request'}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  They get your note by email with accept/decline links. Only if they
                  accept do you both receive an intro — declining is silent.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {settingsOpen && <ConnectionsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />}
    </div>
  );
}
