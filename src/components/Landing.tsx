import { useState, type ReactNode } from 'react';
import { RBMark } from './PasscodeGate';

const ACCESS_CODE = import.meta.env.VITE_ACCESS_CODE ?? '';
const STORAGE_KEY = 'rb-access-granted';

/**
 * Public landing page + pilot gate. No sign-up flow by design — the pilot
 * grows at the speed of trust, through invitations that carry the passcode.
 * The warm dark palette matches the brand mark and social card, independent
 * of the app's light/dark theme.
 */
export function Landing({ children }: { children: ReactNode }) {
  const [granted, setGranted] = useState(
    () => !ACCESS_CODE || localStorage.getItem(STORAGE_KEY) === ACCESS_CODE,
  );

  if (granted) return <>{children}</>;

  return <LandingPage onUnlock={() => setGranted(true)} />;
}

function LandingPage({ onUnlock }: { onUnlock: () => void }) {
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

  return (
    <div className="min-h-dvh overflow-y-auto bg-[#1C1917] text-[#FAFAF9]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
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
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#78716C]">What this is</h2>
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
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#78716C]">The way we build</h2>
          <p className="text-[#E7E5E4] leading-relaxed">
            Technology is the smaller part of this work. Ninety percent is
            presence — knowing your neighbors, listening well, showing up.
            The tools here exist to serve that ninety percent, never to
            replace it. We build for agency, belonging, and trust, and we
            grow the way trust grows: person to person, at the speed of
            invitation.
          </p>
        </section>

        {/* Invitation + gate */}
        <section className="rounded-2xl border border-[#44403C] bg-[#292524] p-8 space-y-5 text-center">
          <h2 className="text-xl font-semibold">We're in a community pilot</h2>
          <p className="text-sm text-[#D6D3D1] leading-relaxed max-w-md mx-auto">
            Invited builders get free building — no API keys, no credit card —
            courtesy of the Relational Technology Project. Invitations come
            with a passcode.
          </p>
          <div className="flex gap-2 max-w-xs mx-auto">
            <input
              type="password"
              inputMode="numeric"
              value={input}
              onChange={e => { setInput(e.target.value); setError(false); }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Passcode"
              className={`flex-1 rounded-lg border bg-[#1C1917] px-3 py-2 text-center tracking-[0.3em] text-sm outline-none placeholder:text-[#78716C] placeholder:tracking-normal ${
                error ? 'border-[#E86F4E]' : 'border-[#44403C] focus:border-[#A8A29E]'
              }`}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="rounded-lg bg-[#FAFAF9] text-[#1C1917] px-4 py-2 text-sm font-medium hover:bg-[#E7E5E4] disabled:opacity-40 transition-colors"
            >
              Enter
            </button>
          </div>
          {error && <p className="text-xs text-[#E86F4E]">That's not it — check your invitation.</p>}
          <p className="text-xs text-[#A8A29E]">
            No invite yet? Write to{' '}
            <a href="mailto:humans@relationaltechproject.org" className="underline decoration-[#78716C] underline-offset-2 hover:decoration-[#FAFAF9]">
              humans@relationaltechproject.org
            </a>{' '}
            and tell us about your neighborhood.
          </p>
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

function ValueCard({ color, title, children }: { color: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#44403C] p-4 space-y-1.5 text-left">
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs text-[#A8A29E] leading-relaxed">{children}</p>
    </div>
  );
}
