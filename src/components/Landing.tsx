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
 * The warm dark palette matches the brand mark and social card, independent
 * of the app's light/dark theme.
 */
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
    <div className="min-h-dvh overflow-y-auto bg-[#261e18] text-[#FAFAF9]" style={{ fontFamily: "'Inter Variable', system-ui, sans-serif" }}>
      <div className="max-w-2xl mx-auto px-6 py-16 sm:py-24 space-y-16">

        {/* Hero */}
        <header className="space-y-6 text-center">
          <RBMark className="size-14 mx-auto" />
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
              Relational Builder
            </h1>
            <p className="text-lg sm:text-xl text-[#D6D3D1] leading-relaxed">
              Build tools for your neighborhood,<br className="sm:hidden" /> with your neighborhood.
            </p>
          </div>
          <p className="text-sm text-[#A8A29E] max-w-md mx-auto leading-relaxed">
            An open-source AI app builder for relational technology — describe
            what your community needs in plain language, and shape a working
            tool together.
          </p>
        </header>

        {/* What it is */}
        <section className="space-y-4">
          <h2 className="font-sans text-xs uppercase tracking-[0.2em] text-[#78716C]">What this is</h2>
          <p className="text-[#E7E5E4] leading-relaxed">
            Most app builders start from a blank slate. This one starts from a
            commons. Every conversation draws on the tools, stories, and
            recipes of real community builders — block parties and mutual aid
            pods, tool libraries and neighborhood calendars — carried from
            garden to garden by the{' '}
            <a href="https://relationaltechproject.org" className="underline decoration-[#78716C] underline-offset-2 hover:decoration-[#FAFAF9]">
              Relational Technology Project
            </a>
            . And when your tool is ready, you can offer it back, so the next
            neighborhood starts where you left off.
          </p>
          <div className="grid sm:grid-cols-3 gap-3 pt-2">
            <ValueCard color="#E86F4E" title="Describe it">
              Say what your neighborhood needs. Plan together first, or build right away — no code required.
            </ValueCard>
            <ValueCard color="#3D8B6D" title="Shape it together">
              Invite a neighbor as editor. Watch the live preview. Restore any version. Ask the AI to fix what breaks.
            </ValueCard>
            <ValueCard color="#E8B84E" title="Offer it back">
              Publish to your own domain, and share the tool to the commons — credited to you, ready to remix.
            </ValueCard>
          </div>
        </section>

        {/* The way */}
        <section className="space-y-4">
          <h2 className="font-sans text-xs uppercase tracking-[0.2em] text-[#78716C]">The way we build</h2>
          <p className="text-[#E7E5E4] leading-relaxed">
            Technology is the smaller part of this work. Ninety percent is
            presence — knowing your neighbors, listening well, showing up.
            The tools here exist to serve that ninety percent, never to
            replace it. We build for agency, belonging, and trust, and we
            grow the way trust grows: person to person, at the speed of
            invitation.
          </p>
        </section>

        {/* The front door */}
        <section className="rounded-2xl border border-[#4e443c] bg-[#332a23] p-8 space-y-5 text-center">
          <h2 className="text-xl font-semibold">We're in a community pilot</h2>
          <p className="text-sm text-[#D6D3D1] leading-relaxed max-w-md mx-auto">
            Approved builders get free building — no API keys, no credit card —
            courtesy of the Relational Technology Project. Ask for an account
            and a real person will welcome you in, usually within a day.
          </p>
          <RequestAccountForm />
          <p className="text-xs text-[#A8A29E]">
            Already approved?{' '}
            <button onClick={enter} className="underline decoration-[#78716C] underline-offset-2 hover:decoration-[#FAFAF9]">
              Come on in and sign in
            </button>
          </p>
          <PasscodeFallback onUnlock={onUnlock} />
        </section>

        {/* Footer */}
        <footer className="text-center space-y-2 text-xs text-[#78716C]">
          <p>
            Open source under MIT —{' '}
            <a
              href="https://github.com/The-Relational-Technology-Project/relational-builder"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-[#57534E] underline-offset-2 hover:decoration-[#A8A29E]"
            >
              read the code
            </a>
          </p>
          <p>
            A project of{' '}
            <a href="https://relationaltechproject.org" className="underline decoration-[#57534E] underline-offset-2 hover:decoration-[#A8A29E]">
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
      <p className="text-sm text-[#D6D3D1] leading-relaxed max-w-md mx-auto">
        Request sent — thank you! A real person reviews every request; you'll
        get a welcome email as soon as yours is approved.
      </p>
    );
  }
  if (outcome === 'already-member') {
    return (
      <p className="text-sm text-[#D6D3D1] leading-relaxed max-w-md mx-auto">
        Good news — this email is already approved. Come on in below and sign
        in with it.
      </p>
    );
  }

  const inputClass =
    'w-full rounded-lg border border-[#4e443c] bg-[#261e18] px-3 py-2 text-sm outline-none placeholder:text-[#78716C] focus:border-[#A8A29E]';

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
      {error && <p className="text-xs text-[#E86F4E] text-center">{error}</p>}
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
      <p className="text-xs text-[#78716C]">
        Holding an invite with a passcode?{' '}
        <button onClick={() => setOpen(true)} className="underline decoration-[#57534E] underline-offset-2 hover:decoration-[#A8A29E]">
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
          className={`flex-1 rounded-lg border bg-[#261e18] px-3 py-2 text-center tracking-[0.3em] text-sm outline-none placeholder:text-[#78716C] placeholder:tracking-normal ${
            error ? 'border-[#E86F4E]' : 'border-[#4e443c] focus:border-[#A8A29E]'
          }`}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className="rounded-lg border border-[#4e443c] text-[#FAFAF9] px-4 py-2 text-sm hover:border-[#A8A29E] disabled:opacity-40 transition-colors"
        >
          Enter
        </button>
      </div>
      {error && <p className="text-xs text-[#E86F4E]">That's not it — check your invitation.</p>}
    </div>
  );
}

function ValueCard({ color, title, children }: { color: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#4e443c] p-4 space-y-1.5 text-left">
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs text-[#A8A29E] leading-relaxed">{children}</p>
    </div>
  );
}
