import { useState } from 'react';
import { getThemeMode, setThemeMode, type ThemeMode } from '@/theme';
import { Sun, Moon, Monitor } from 'lucide-react';

const NEXT: Record<ThemeMode, ThemeMode> = { system: 'dark', dark: 'light', light: 'system' };
const LABEL: Record<ThemeMode, string> = {
  system: 'Theme: match device',
  dark: 'Theme: dark',
  light: 'Theme: light',
};

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode);

  function cycle() {
    const next = NEXT[mode];
    setThemeMode(next);
    setMode(next);
  }

  const Icon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor;

  return (
    <button
      onClick={cycle}
      title={`${LABEL[mode]} — click to change`}
      className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      <Icon className="size-3.5" />
    </button>
  );
}
