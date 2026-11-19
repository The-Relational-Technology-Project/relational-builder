import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LiveSiteLink } from './LiveSiteLink';
import { cn } from '@/lib/utils';
import { AlertTriangle, Check, CircleDashed, Copy, ExternalLink, Loader2, Mail } from 'lucide-react';
import {
  addSiteDomain, getSiteDomain, lookupDomain, removeSiteDomain, type SiteDomain,
} from '@/project/site-domains';
import {
  ENDINGS, detectProvider, diagnose, nameIdeas, namecheapSearchUrl, providerSteps, readLookup,
  type DnsRecord, type Lookup,
} from '@/project/domain-dns';

/** How often to look again while a builder is over at their registrar */
const POLL_MS = 20_000;

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-mono break-all text-left hover:text-foreground"
      title="Copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocked: the value is selectable text right there
        }
      }}
    >
      {value}
      {copied ? <Check className="size-3 shrink-0 text-green-600" /> : <Copy className="size-3 shrink-0 opacity-60" />}
    </button>
  );
}

const RECORD_FOR: Record<DnsRecord['purpose'], (r: DnsRecord) => string> = {
  address: r => `Sends ${r.name} to your site`,
  twin: r => `So ${r.name} works too`,
  proof: () => 'Proves the domain is yours',
};

/**
 * "Use your own address": point a domain the community owns at a
 * community-hosted site. One field to start; the Builder looks the name up,
 * says what it found, and from then on reads the domain's DNS itself so the
 * builder is told the one row that's wrong instead of "check again".
 *
 * The domain and its DNS stay with the community, wherever they bought it.
 * See docs/CUSTOM-DOMAINS.md.
 */
export function SiteAddressCard({
  slug,
  siteName,
  placeName,
  onChange,
  className,
}: {
  slug: string;
  siteName: string;
  /** The project's place, when it has one: better name ideas */
  placeName?: string | null;
  /** The site's address changed (connected, went live, disconnected) */
  onChange?: (domain: { domain: string; status: 'pending' | 'live' } | null) => void;
  className?: string;
}) {
  const [state, setState] = useState<SiteDomain | null | undefined>(undefined);
  const [input, setInput] = useState('');
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [busy, setBusy] = useState<'lookup' | 'add' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEndings, setShowEndings] = useState(false);

  const adopt = useCallback((next: SiteDomain | null) => {
    setState(next);
    onChange?.(next ? { domain: next.domain, status: next.status } : null);
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    getSiteDomain(slug)
      .then(d => { if (!cancelled) setState(d); })
      .catch((e: Error) => { if (!cancelled) { setState(null); setError(e.message); } });
    return () => { cancelled = true; };
  }, [slug]);

  // While the builder is adding records elsewhere, keep looking on our own
  const pending = state?.status === 'pending';
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      getSiteDomain(slug).then(d => { if (d) adopt(d); }).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [pending, slug, adopt]);

  const ideas = useMemo(() => nameIdeas(siteName, placeName), [siteName, placeName]);

  async function check(domain: string) {
    if (!domain.trim()) return;
    setBusy('lookup');
    setError(null);
    setLookup(null);
    try {
      const found = await lookupDomain(domain);
      setLookup(found);
      setInput(found.domain);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not look that up');
    } finally {
      setBusy(null);
    }
  }

  async function connect(domain: string) {
    setBusy('add');
    setError(null);
    try {
      adopt(await addSiteDomain(slug, domain));
      setLookup(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect that address');
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!state) return;
    if (!window.confirm(`Disconnect ${state.domain}? The site stays live at its relationalbuilder.org link, and the domain stays yours.`)) return;
    setBusy('remove');
    setError(null);
    try {
      await removeSiteDomain(slug);
      adopt(null);
      setInput('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disconnect');
    } finally {
      setBusy(null);
    }
  }

  if (state === undefined) {
    return (
      <p className={cn('text-xs text-muted-foreground flex items-center gap-1.5', className)}>
        <Loader2 className="size-3 animate-spin" /> Looking up this site's address…
      </p>
    );
  }

  // ── Live ──
  if (state?.status === 'live') {
    return (
      <div className={cn('space-y-1.5', className)}>
        <p className="text-xs font-medium flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-green-600" aria-hidden />
          Live at its own address
        </p>
        <LiveSiteLink url={`https://${state.domain}/`} />
        <p className="text-xs text-muted-foreground">
          The relationalbuilder.org link still works too. The domain is yours: keep an eye on its
          renewal date wherever you bought it.
        </p>
        <button className="text-xs text-muted-foreground underline decoration-dotted hover:text-foreground" onClick={disconnect} disabled={busy !== null}>
          {busy === 'remove' ? 'Disconnecting…' : 'Disconnect this address'}
        </button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  // ── Connected, waiting on DNS ──
  if (state) {
    const provider = detectProvider(state.facts.nameservers);
    const steps = providerSteps(provider, state.registrable);
    const todo = state.records.filter(r => !r.ok);
    return (
      <div className={cn('space-y-2.5', className)}>
        <p className="text-xs font-medium flex items-center gap-1.5">
          <CircleDashed className="size-3.5 text-amber-600" />
          {todo.length === 0
            ? `${state.domain}: the records look right. Setting up the secure connection…`
            : `${state.domain}: ${todo.length === 1 ? 'one row' : `${todo.length} rows`} to add${provider.name ? ` at ${provider.name}` : ''}`}
        </p>

        <ol className="list-decimal list-inside space-y-0.5 text-xs text-muted-foreground">
          {steps.steps.map(s => <li key={s}>{s}</li>)}
        </ol>
        {steps.watchFor.map(w => (
          <p key={w} className="text-xs text-amber-800 dark:text-amber-400 flex gap-1.5">
            <AlertTriangle className="size-3 shrink-0 mt-0.5" />
            <span>{w}</span>
          </p>
        ))}
        {steps.openUrl && (
          <a
            href={steps.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 gap-1 text-xs')}
          >
            <ExternalLink className="size-3" />
            {steps.openLabel}
          </a>
        )}

        <div className="space-y-1.5">
          {state.records.map(r => {
            const problem = diagnose(r, state.facts, provider);
            return (
              <div key={`${r.type}-${r.name}`} className="rounded-md border bg-background p-2 space-y-1 text-xs">
                <div className="grid grid-cols-[3.5rem_1fr] gap-x-2 gap-y-0.5 text-muted-foreground">
                  <span>Type</span><span className="font-mono text-foreground">{r.type === 'A' ? 'A Record' : r.type === 'CNAME' ? 'CNAME Record' : 'TXT Record'}</span>
                  <span>Host</span><span className="text-foreground"><CopyValue value={r.host} /></span>
                  <span>Value</span><span className="text-foreground"><CopyValue value={r.value} /></span>
                </div>
                <p className={cn('flex gap-1.5', r.ok ? 'text-green-700 dark:text-green-500' : 'text-muted-foreground')}>
                  {r.ok
                    ? <><Check className="size-3 shrink-0 mt-0.5" /><span>Found. {RECORD_FOR[r.purpose](r)}.</span></>
                    : <><CircleDashed className="size-3 shrink-0 mt-0.5" /><span>{RECORD_FOR[r.purpose](r)}. {problem}</span></>}
                </p>
              </div>
            );
          })}
        </div>

        {state.facts.mx.length > 0 && (
          <p className="text-xs text-muted-foreground flex gap-1.5">
            <Mail className="size-3 shrink-0 mt-0.5" />
            <span>Email at {state.registrable} keeps working. These rows don't touch it.</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          This tells the internet your domain lives here. We keep checking on our own, so you can
          leave this open or come back later.{' '}
          <button className="underline decoration-dotted hover:text-foreground" onClick={disconnect} disabled={busy !== null}>
            {busy === 'remove' ? 'Disconnecting…' : 'Use a different address'}
          </button>
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  // ── No address yet: one field ──
  const reading = lookup ? readLookup(lookup) : null;
  // When the main address is busy, a corner of it is the gentle way in
  const corner = lookup && reading?.situation === 'in_use' && reading.isMain
    ? `${nameIdeas(siteName)[0]?.split('.')[0]?.slice(0, 20) || 'tools'}.${lookup.registrable}`
    : null;

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium">Use your own address</p>
      <p className="text-xs text-muted-foreground">
        A domain your community owns, like elmstreet.place. One you already have, or a new one.
      </p>
      <form
        className="flex gap-1.5"
        onSubmit={e => { e.preventDefault(); void check(input); }}
      >
        <Input
          value={input}
          onChange={e => { setInput(e.target.value); setLookup(null); }}
          placeholder="yourname.place"
          className="h-7 text-xs"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Your domain"
        />
        <Button type="submit" variant="outline" size="sm" className="h-7 text-xs shrink-0" disabled={busy !== null || !input.trim()}>
          {busy === 'lookup' ? <Loader2 className="size-3 animate-spin" /> : 'Look it up'}
        </Button>
      </form>

      {lookup && reading?.situation === 'available' && (
        <div className="rounded-md border bg-background p-2 space-y-1.5 text-xs">
          <p><span className="font-medium">{lookup.registrable}</span> looks available.</p>
          <p className="text-muted-foreground">
            Buy it in your community's name (Namecheap is a good, plain place to do it), then come
            back here. Look at the renewal price, not only the first year.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href={namecheapSearchUrl(lookup.registrable)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 gap-1 text-xs')}
            >
              <ExternalLink className="size-3" />
              Get it at Namecheap
            </a>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => check(lookup.domain)} disabled={busy !== null}>
              I bought it, look again
            </Button>
          </div>
        </div>
      )}

      {lookup && reading?.situation === 'taken' && (
        <p className="text-xs text-destructive">
          {lookup.domain} is already live on another builder's site. If it's yours, reply to your
          invite email and a human will sort it out.
        </p>
      )}

      {lookup && (reading?.situation === 'fresh' || reading?.situation === 'in_use') && (
        <div className="rounded-md border bg-background p-2 space-y-1.5 text-xs">
          {reading.situation === 'fresh' ? (
            <p>
              <span className="font-medium">{lookup.domain}</span> is registered
              {reading.provider.name ? ` at ${reading.provider.name}` : ''} and nothing is using it yet. Ready to connect.
            </p>
          ) : (
            <p className="flex gap-1.5">
              <AlertTriangle className="size-3 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Something already answers at <span className="font-medium">{lookup.domain}</span>.
                Connecting it here replaces that, once you change its records.
              </span>
            </p>
          )}
          {reading.hasEmail && (
            <p className="text-muted-foreground flex gap-1.5">
              <Mail className="size-3 shrink-0 mt-0.5" />
              <span>Email at {lookup.registrable} keeps working either way.</span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {corner && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => check(corner)} disabled={busy !== null}>
                Use {corner} instead
              </Button>
            )}
            <Button
              variant={corner ? 'ghost' : 'default'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => connect(lookup.domain)}
              disabled={busy !== null}
            >
              {busy === 'add' ? <Loader2 className="size-3 animate-spin" /> : `Connect ${lookup.domain}`}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!lookup && (
        <div className="space-y-1 text-xs text-muted-foreground">
          {ideas.length > 0 && (
            <p>
              Need a name? Local words work well: your street, your park, what neighbors call the
              block. Try{' '}
              {ideas.map((idea, i) => (
                <span key={idea}>
                  <button className="underline decoration-dotted hover:text-foreground" onClick={() => check(idea)} disabled={busy !== null}>
                    {idea}
                  </button>
                  {i < ideas.length - 1 ? ', ' : '.'}
                </span>
              ))}
            </p>
          )}
          <button className="underline decoration-dotted hover:text-foreground" onClick={() => setShowEndings(v => !v)}>
            {showEndings ? 'Hide the endings' : 'Which ending? (.place, .xyz, .org…)'}
          </button>
          {showEndings && (
            <ul className="space-y-0.5 pt-0.5">
              {ENDINGS.map(e => (
                <li key={e.tld}><span className="font-mono text-foreground">.{e.tld}</span> {e.hint}</li>
              ))}
              <li>
                The first year is often a couple of dollars. The price that matters is the renewal,
                and it differs between registrars.
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
