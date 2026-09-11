import { useState } from 'react';
import { RBMark } from './RBMark';
import { LANDING_COLORS as C } from './Landing';
import { useAuthStore } from '@/store/auth-store';

/**
 * Where the sign-in email's link lands: relationalbuilder.org/auth/confirm.
 *
 * The link used to be Supabase's own verify URL, which signs you in the
 * moment anything opens it. Work and government inboxes scan every link in
 * an incoming email at delivery, so the one-time token was often spent
 * before the person ever saw the message — and because the 6-digit code is
 * the same token, it failed too. Now the link carries only a token *hash*
 * to this page, and nothing is verified until a person presses the button.
 * A scanner loading the page consumes nothing; the code in the email keeps
 * working; the link works for whoever actually clicks it.
 */

export function ConfirmSignInPage({ tokenHash, onDone }: { tokenHash: string | null; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    tokenHash ? null : 'This sign-in link is missing its token. Open the email again and try the 6-digit code instead.',
  );

  async function confirm() {
    if (!tokenHash || busy) return;
    setBusy(true);
    const { error: err } = await useAuthStore.getState().verifyLink(tokenHash);
    setBusy(false);
    if (err) {
      setError(
        /expired|invalid|not found/i.test(err)
          ? 'That sign-in link has expired or was already used. Request a fresh email from the home page, then type the 6-digit code from it.'
          : `Sign-in didn't go through: ${err}. Request a fresh email and try the 6-digit code.`,
      );
      return;
    }
    // Session landed via onAuthStateChange — hand back to the app at its root
    onDone();
  }

  return (
    <div
      className="min-h-dvh overflow-y-auto"
      style={{ background: C.bg, color: C.ink, fontFamily: "'Inter Variable', system-ui, sans-serif" }}
    >
      <div className="max-w-md mx-auto px-6 py-16 sm:py-24 space-y-6 text-center">
        <RBMark className="size-10 mx-auto" />
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Sign in to Relational Builder</h1>
        {error ? (
          <>
            <p
              className="rounded-lg border px-3 py-2 text-sm leading-relaxed text-left"
              style={{ color: C.orangeDeep, borderColor: '#E8C4AE', background: '#FBF1EA' }}
            >
              {error}
            </p>
            <a
              href="/"
              className="inline-block rounded-lg border px-4 py-2 text-sm font-medium hover:opacity-80"
              style={{ borderColor: C.border, color: C.body }}
            >
              Back to the home page
            </a>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed" style={{ color: C.body }}>
              One more tap and you're in. This step is here so the link can only
              be used by a person, not by an inbox that scans links automatically.
            </p>
            <button
              onClick={confirm}
              disabled={busy}
              className="rounded-lg bg-[#D2764B] text-[#FAFAF9] px-5 py-2.5 text-sm font-medium hover:bg-[#C4693F] disabled:opacity-40 transition-colors"
            >
              {busy ? 'Signing you in…' : 'Continue to Relational Builder'}
            </button>
            <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
              Opened this on a different device than the one you were signing in
              on? Type the 6-digit code from the same email there instead.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
