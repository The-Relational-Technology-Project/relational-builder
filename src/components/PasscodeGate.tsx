import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requestAccount, type RequestOutcome } from '@/cloud/account-requests';
import { Loader2 } from 'lucide-react';

/**
 * Simple passcode gate for the pilot period. This is a soft, client-side
 * gate to keep casual visitors out while the community pilot runs — not a
 * security boundary (real protection lives in RLS and the proxy gates).
 * Remembered per browser.
 */

const ACCESS_CODE = import.meta.env.VITE_ACCESS_CODE ?? '';
const STORAGE_KEY = 'rb-access-granted';

export function PasscodeGate({ children }: { children: ReactNode }) {
  const [granted, setGranted] = useState(
    () => !ACCESS_CODE || localStorage.getItem(STORAGE_KEY) === ACCESS_CODE,
  );
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const [requesting, setRequesting] = useState(false);

  if (granted) return <>{children}</>;

  if (requesting) {
    return <RequestAccountScreen onBack={() => setRequesting(false)} />;
  }

  function handleSubmit() {
    if (input.trim() === ACCESS_CODE) {
      localStorage.setItem(STORAGE_KEY, ACCESS_CODE);
      setGranted(true);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setInput('');
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className={`w-full max-w-xs text-center space-y-4 ${shake ? 'animate-pulse' : ''}`}>
        <RBMark className="size-10 mx-auto" />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Relational Builder</h1>
          <p className="text-xs text-muted-foreground mt-1">
            We're in a community pilot. Enter the passcode from your invite.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            type="password"
            inputMode="numeric"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Passcode"
            className="text-center tracking-[0.3em]"
            autoFocus
          />
          <Button onClick={handleSubmit} disabled={!input.trim()}>
            Enter
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          No invite yet?{' '}
          <button
            onClick={() => setRequesting(true)}
            className="underline hover:text-foreground"
          >
            Request an account
          </button>
        </p>
        <p className="text-xs text-muted-foreground">
          Curious about the project?{' '}
          <a
            href="https://github.com/The-Relational-Technology-Project/relational-builder"
            className="underline hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            It's open source.
          </a>
        </p>
      </div>
    </div>
  );
}

/**
 * The open front door: anyone can ask for an account. The steward gets an
 * email, approves in the super admin dashboard, and the requester gets a
 * welcome email — after which sign-in is just a magic link.
 */
function RequestAccountScreen({ onBack }: { onBack: () => void }) {
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

  return (
    <div className="h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <RBMark className="size-10 mx-auto" />
        {outcome === 'pending' ? (
          <>
            <h1 className="text-lg font-semibold tracking-tight">Request sent</h1>
            <p className="text-sm text-muted-foreground">
              Thanks! A real person reviews every request — you'll get a welcome
              email as soon as yours is approved, usually within a day.
            </p>
          </>
        ) : outcome === 'already-member' ? (
          <>
            <h1 className="text-lg font-semibold tracking-tight">You already have access</h1>
            <p className="text-sm text-muted-foreground">
              This email is already approved — ask the person who invited you for
              the current passcode, or reply to your welcome email.
            </p>
            <Button variant="outline" size="sm" onClick={onBack}>Back</Button>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Request an account</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Tell us a little about you — a real person approves each request.
              </p>
            </div>
            <div className="space-y-2 text-left">
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.org"
                autoFocus
              />
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
              />
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="What are you hoping to build, and for which neighborhood or community?"
                rows={3}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={onBack} disabled={busy}>Back</Button>
              <Button onClick={submit} disabled={busy || !email.includes('@')}>
                {busy && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                Send request
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Small relational mark: three connected nodes — people in relationship */
export function RBMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <path d="M14 32 L24 14 L34 32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
      <path d="M14 32 L34 32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
      <circle cx="24" cy="13" r="5.5" fill="#E86F4E" />
      <circle cx="13" cy="33" r="5.5" fill="#3D8B6D" />
      <circle cx="35" cy="33" r="5.5" fill="#E8B84E" />
    </svg>
  );
}
