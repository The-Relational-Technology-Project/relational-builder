import { useEffect, useState, type ReactNode } from 'react';
import { RBMark } from './RBMark';
import { requestAccount, type RequestOutcome } from '@/cloud/account-requests';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { MailCheck } from 'lucide-react';

// One or more invitation passcodes, comma-separated — extra codes can be
// minted for a workshop or event and retired afterwards without touching
// the standing invite code.
const ACCESS_CODES = (import.meta.env.VITE_ACCESS_CODE ?? '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);
const STORAGE_KEY = 'rb-access-granted';
const ENTERED_KEY = 'rb-entered';

/** The canonical stored form of a valid passcode, or null if it doesn't match */
function matchAccessCode(input: string): string | null {
  const entered = input.trim().toLowerCase();
  return ACCESS_CODES.find((c: string) => c.toLowerCase() === entered) ?? null;
}

/**
 * An event link or QR code can carry the passcode — relationalbuilder.org/?code=X
 * walks the whole room through the door with zero typing. The spent param is
 * scrubbed from the address bar either way.
 */
function consumeCodeParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('code');
  if (raw === null) return null;
  params.delete('code');
  const qs = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
  const matched = matchAccessCode(raw);
  if (matched) localStorage.setItem(STORAGE_KEY, matched);
  return matched;
}

/**
 * Public landing page. The passcode wall is retired: the front door is
 * "request an account" (a steward approves each one; sign-in is a magic
 * link), and members walk straight in. Invitation passcodes still work as
 * a quiet fallback while invites carrying them circulate — entering one
 * also feeds the enroll-community self-enrollment flow.
 * Warm light palette drawn from the brand mark, independent of the app's
 * light/dark theme. Copy stays short — the door matters more than the tour.
 */

// Brand palette on warm paper
const C = {
  bg: '#FAF7F2',
  ink: '#261e18',
  body: '#4A4038',
  muted: '#8A7D71',
  border: '#E5DCD0',
  card: '#FFFFFF',
  orange: '#D2764B',
  orangeDeep: '#C4693F',
  green: '#3D8B6D',
  yellow: '#E8B84E',
};
export function Landing({ children }: { children: ReactNode }) {
  const user = useAuthStore(s => s.user);
  const [granted, setGranted] = useState(
    () =>
      consumeCodeParam() !== null ||
      ACCESS_CODES.length === 0 ||
      localStorage.getItem(ENTERED_KEY) === '1' ||
      matchAccessCode(localStorage.getItem(STORAGE_KEY) ?? '') !== null,
  );

  // App (which normally inits auth) is gated below, so init here too — that
  // way a magic-link redirect landing on this page still gets its session
  // detected. init() guards against running twice, so App's call is a no-op.
  useEffect(() => {
    useAuthStore.getState().init();
  }, []);

  // A signed-in builder is always through the door: after signing in from the
  // panel below, the magic-link redirect returns here and walks them straight in.
  if (granted || user) return <>{children}</>;

  return <LandingPage onUnlock={() => setGranted(true)} />;
}

function LandingPage({ onUnlock }: { onUnlock: () => void }) {
  function enter() {
    localStorage.setItem(ENTERED_KEY, '1');
    onUnlock();
  }

  return (
    <div
      className="min-h-dvh overflow-y-auto"
      style={{ background: C.bg, color: C.ink, fontFamily: "'Inter Variable', system-ui, sans-serif" }}
    >
      <div className="max-w-2xl mx-auto px-6 py-14 sm:py-20 space-y-12">

        {/* Hero */}
        <header className="space-y-5 text-center">
          <RBMark className="size-14 mx-auto" />
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
              Relational Builder
            </h1>
            <p className="text-lg sm:text-xl leading-relaxed" style={{ color: C.body }}>
              Build tools for your neighborhood,<br className="sm:hidden" /> with your neighborhood.
            </p>
          </div>
          <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: C.muted }}>
            Describe what your community needs in plain language and shape a
            working tool together — starting from the commons of the{' '}
            <a href="https://relationaltechproject.org" className="underline underline-offset-2" style={{ textDecorationColor: C.border, color: C.body }}>
              Relational Technology Project
            </a>
            , not a blank slate.
          </p>
        </header>

        <div className="grid sm:grid-cols-3 gap-3">
          <ValueCard color={C.orange} title="Describe it">
            Say what your neighborhood needs — no code required.
          </ValueCard>
          <ValueCard color={C.green} title="Shape it together">
            Invite a neighbor in, watch the live preview, restore any version.
          </ValueCard>
          <ValueCard color={C.yellow} title="Offer it back">
            Publish it, then share it to the commons for the next neighborhood.
          </ValueCard>
        </div>

        {/* The front door */}
        <section
          className="rounded-2xl border p-8 space-y-5 text-center"
          style={{ borderColor: C.border, background: C.card }}
        >
          <h2 className="text-xl font-semibold">We're in a community pilot</h2>
          <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: C.body }}>
            Approved builders build free — no API keys, no credit card. Ask for
            an account and a real person will welcome you in, usually within a day.
          </p>
          <RequestAccountForm />
          <SignInPanel onEnter={enter} />
          <PasscodeFallback onUnlock={onUnlock} />
        </section>

        {/* Footer */}
        <footer className="text-center space-y-2 text-xs" style={{ color: C.muted }}>
          <p>
            The tools here serve presence — knowing your neighbors, listening
            well, showing up — never replace it.
          </p>
          <p>
            Open source under MIT —{' '}
            <a
              href="https://github.com/The-Relational-Technology-Project/relational-builder"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:opacity-80"
            >
              read the code
            </a>
            {' '}· a project of{' '}
            <a href="https://relationaltechproject.org" className="underline underline-offset-2 hover:opacity-80">
              The Relational Technology Project
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

/** The open front door: ask, and a steward approves — then sign-in is just a magic link */
function RequestAccountForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<RequestOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      setOutcome(await requestAccount({ email, name, reason }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your request');
    } finally {
      setBusy(false);
    }
  }

  if (outcome === 'pending') {
    return (
      <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: C.body }}>
        Request sent — thank you! A real person reviews every request; you'll
        get a welcome email as soon as yours is approved.
      </p>
    );
  }
  if (outcome === 'already-member') {
    return (
      <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: C.body }}>
        Good news — this email is already approved. Come on in below and sign
        in with it.
      </p>
    );
  }

  const inputClass =
    'w-full rounded-lg border px-3 py-2 text-sm outline-none placeholder:text-[#8A7D71] border-[#E5DCD0] bg-[#FAF7F2] focus:border-[#D2764B]';

  return (
    <div className="max-w-sm mx-auto space-y-2 text-left">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="you@example.org"
        className={inputClass}
      />
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Your name"
        className={inputClass}
      />
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="What are you hoping to build, and for which neighborhood or community?"
        rows={3}
        className={`${inputClass} resize-none`}
      />
      {error && <p className="text-xs text-center" style={{ color: C.orangeDeep }}>{error}</p>}
      <button
        onClick={submit}
        disabled={busy || !email.includes('@')}
        className="w-full rounded-lg bg-[#D2764B] text-[#FAFAF9] px-4 py-2 text-sm font-medium hover:bg-[#C4693F] disabled:opacity-40 transition-colors"
      >
        {busy ? 'Sending…' : 'Request an account'}
      </button>
    </div>
  );
}

/**
 * Existing builders sign in right here — a clear CTA, not a buried link. The
 * magic-link email form is the very next thing after "Sign in": send it and a
 * one-tap link arrives; the redirect lands the builder straight in the app
 * (Landing waves signed-in builders through). When cloud auth isn't configured
 * we fall back to the old "come on in" walk-through.
 */
function SignInPanel({ onEnter }: { onEnter: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!cloudEnabled) {
    return (
      <p className="text-sm" style={{ color: C.body }}>
        Already a builder?{' '}
        <button onClick={onEnter} className="font-medium underline underline-offset-2 hover:opacity-80" style={{ color: C.orangeDeep }}>
          Come on in
        </button>
      </p>
    );
  }

  async function submit() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    const { error: err } = await useAuthStore.getState().signIn(trimmed);
    setSending(false);
    if (err) setError(err);
    else setSent(true);
  }

  const inputClass =
    'flex-1 rounded-lg border px-3 py-2 text-sm outline-none placeholder:text-[#8A7D71] border-[#E5DCD0] bg-[#FAF7F2] focus:border-[#D2764B]';

  return (
    <div className="pt-5 border-t space-y-3" style={{ borderColor: C.border }}>
      {sent ? (
        <div className="max-w-sm mx-auto space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <MailCheck className="size-4" style={{ color: C.green }} />
            Check your email
          </div>
          <p className="text-xs leading-relaxed" style={{ color: C.body }}>
            We sent a sign-in link to <strong>{email}</strong> — tap it, or type
            the 6-digit code from that email here. No password needed.
          </p>
          <CodeEntry email={email} />
        </div>
      ) : open ? (
        <div className="max-w-sm mx-auto space-y-2">
          <p className="text-sm" style={{ color: C.body }}>
            Welcome back — we'll email you a one-tap sign-in link.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="you@example.org"
              autoFocus
              className={inputClass}
            />
            <button
              onClick={submit}
              disabled={sending || !email.includes('@')}
              className="rounded-lg bg-[#D2764B] text-[#FAFAF9] px-4 py-2 text-sm font-medium hover:bg-[#C4693F] disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {sending ? 'Sending…' : 'Send link'}
            </button>
          </div>
          {error && <p className="text-xs text-center" style={{ color: C.orangeDeep }}>{error}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 text-sm">
          <span style={{ color: C.body }}>Already a builder?</span>
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg border px-4 py-1.5 font-medium hover:border-[#D2764B] transition-colors"
            style={{ borderColor: C.border, color: C.ink }}
          >
            Sign in
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The 6-digit code path: on phones the magic link often opens in the mail
 * app's own browser, stranding the session away from this tab. Typing the
 * code from the same email signs in right here, whatever browser this is.
 */
function CodeEntry({ email }: { email: string }) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    const trimmed = code.trim();
    if (trimmed.length < 6) return;
    setVerifying(true);
    setError(null);
    const { error: err } = await useAuthStore.getState().verifyCode(email, trimmed);
    setVerifying(false);
    // Success needs no handling — the session lands via onAuthStateChange and
    // Landing waves signed-in builders through
    if (err) setError(err);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={e => { setCode(e.target.value); setError(null); }}
          onKeyDown={e => e.key === 'Enter' && verify()}
          placeholder="6-digit code"
          className="flex-1 rounded-lg border px-3 py-2 text-center tracking-[0.3em] text-sm outline-none placeholder:text-[#8A7D71] placeholder:tracking-normal border-[#E5DCD0] bg-[#FAF7F2] focus:border-[#D2764B]"
        />
        <button
          onClick={verify}
          disabled={verifying || code.trim().length < 6}
          className="rounded-lg bg-[#D2764B] text-[#FAFAF9] px-4 py-2 text-sm font-medium hover:bg-[#C4693F] disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {verifying ? 'Checking…' : 'Sign in'}
        </button>
      </div>
      {error && <p className="text-xs text-center" style={{ color: C.orangeDeep }}>{error}</p>}
    </div>
  );
}

/**
 * Invitation passcodes still circulate on printed invites; they keep working
 * here quietly. Entering one stores it for enroll-community self-enrollment.
 */
function PasscodeFallback({ onUnlock }: { onUnlock: () => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  function handleSubmit() {
    const matched = matchAccessCode(input);
    if (matched) {
      localStorage.setItem(STORAGE_KEY, matched);
      onUnlock();
    } else {
      setError(true);
      setInput('');
    }
  }

  if (!open) {
    return (
      <p className="text-xs" style={{ color: C.muted }}>
        Holding an invite with a passcode?{' '}
        <button onClick={() => setOpen(true)} className="underline underline-offset-2 hover:opacity-80">
          Enter it here
        </button>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 max-w-xs mx-auto">
        <input
          type="password"
          value={input}
          onChange={e => { setInput(e.target.value); setError(false); }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Passcode"
          autoFocus
          className={`flex-1 rounded-lg border bg-[#FAF7F2] px-3 py-2 text-center tracking-[0.3em] text-sm outline-none placeholder:text-[#8A7D71] placeholder:tracking-normal ${
            error ? 'border-[#D2764B]' : 'border-[#E5DCD0] focus:border-[#D2764B]'
          }`}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40 transition-colors hover:border-[#D2764B]"
          style={{ borderColor: C.border, color: C.ink }}
        >
          Enter
        </button>
      </div>
      {error && <p className="text-xs" style={{ color: C.orangeDeep }}>That's not it — check your invitation.</p>}
    </div>
  );
}

function ValueCard({ color, title, children }: { color: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border p-4 space-y-1.5 text-left" style={{ borderColor: C.border, background: C.card }}>
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: C.muted }}>{children}</p>
    </div>
  );
}
