import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

  if (granted) return <>{children}</>;

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
        <p className="text-[11px] text-muted-foreground">
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
