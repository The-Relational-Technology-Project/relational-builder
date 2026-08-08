import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { builderClient } from '@/cloud/builder-client';
import { Button } from '@/components/ui/button';
import { Check, Link2, Ticket, Users } from 'lucide-react';

/**
 * A builder's personal invite code: the code itself, a one-tap copy of the
 * shareable link, and how many builders have joined through it. Anyone who
 * signs up with the code gets in without waiting for steward approval —
 * the code is the vouch. Shown at the top of the Builder Profile and as
 * the closing beat of onboarding.
 */

/** Same resolution as the magic-link redirect: canonical domain when
 *  configured, current origin in local dev */
function siteUrl(): string {
  const configured = import.meta.env.VITE_SITE_URL as string | undefined;
  return configured?.replace(/\/$/, '') || window.location.origin;
}

export function referralLink(code: string): string {
  return `${siteUrl()}/?ref=${encodeURIComponent(code)}`;
}

export function ReferralCard() {
  const code = useAuthStore(s => s.profile?.referral_code ?? null);
  const [joined, setJoined] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    if (!builderClient || !code) return;
    // Own-row RLS keeps other profiles invisible, so the count comes from a
    // definer RPC that answers only for the signed-in builder
    builderClient
      .rpc('my_referral_stats')
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row != null) setJoined(Number((row as { joined_count?: number }).joined_count ?? 0));
      });
  }, [code]);

  if (!code) return null;

  async function copyLink() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(referralLink(code));
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <section className="rounded-lg border bg-muted/30 p-4 space-y-3 text-left">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground uppercase tracking-wide">
        <Ticket className="size-3.5" />
        Your invite code
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xl font-semibold tracking-[0.2em] text-primary">
          {code}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={copyLink}
        >
          {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
          {copied ? 'Link copied' : 'Copy invite link'}
        </Button>
      </div>
      {copyError && (
        <p className="text-xs text-muted-foreground break-all">
          Copying was blocked — the link is {referralLink(code)}
        </p>
      )}
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Users className="size-3.5 shrink-0 mt-px" />
        <span>
          {joined != null && joined > 0 ? (
            <>
              <strong className="font-medium text-foreground">
                {joined} builder{joined === 1 ? '' : 's'}
              </strong>{' '}
              {joined === 1 ? 'has' : 'have'} joined through your invites.{' '}
            </>
          ) : null}
          Anyone who signs up with it gets in right away — no waiting for
          approval. Share it with friends and neighbors you'd vouch for.
          Inviting a collaborator to a project opens the door the same way,
          and counts here too.
        </span>
      </p>
    </section>
  );
}
