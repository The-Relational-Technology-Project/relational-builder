import { useState, type ReactNode } from 'react';
import { RBMark } from './RBMark';
import { requestAccount, type RequestOutcome } from '@/cloud/account-requests';

const ACCESS_CODE = import.meta.env.VITE_ACCESS_CODE ?? '';
const STORAGE_KEY = 'rb-access-granted';
const ENTERED_KEY = 'rb-entered';

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
  const [granted, setGranted] = useState(
    () =>
      !ACCESS_CODE ||
      localStorage.getItem(ENTERED_KEY) === '1' ||
      localStorage.getItem(STORAGE_KEY) === ACCESS_CODE,
  );

  if (granted) return <>{children}</>;

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
          <p className="text-xs" style={{ color: C.muted }}>
            Already approved?{' '}
            <button onClick={enter} className="underline underline-offset-2 hover:opacity-80" style={{ color: C.body }}>
              Come on in and sign in
            </button>
          </p>
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
 * Invitation passcodes still circulate on printed invites; they keep working
 * here quietly. Entering one stores it for enroll-community self-enrollment.
 */
function PasscodeFallback({ onUnlock }: { onUnlock: () => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  function handleSubmit() {
    if (input.trim() === ACCESS_CODE) {
      localStorage.setItem(STORAGE_KEY, ACCESS_CODE);
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
          inputMode="numeric"
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
