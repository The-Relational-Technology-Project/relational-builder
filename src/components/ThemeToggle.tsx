import { useState } from 'react';
import { getThemeMode, setThemeMode, type ThemeMode } from '@/theme';
import { Sun, Moon } from 'lucide-react';

/** A plain light/dark switch — tap to flip. */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode);

  function toggle() {
    const next = mode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    setMode(next);
  }

  return (
    <button
      onClick={toggle}
      title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      {mode === 'dark' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
    </button>
  );
}
