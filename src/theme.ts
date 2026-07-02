/** Light/dark theme, applied via the `.dark` class on <html>. */

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'rb-theme';

export function getThemeMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  // First visit (or legacy "system" setting): start from the device
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setThemeMode(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode);
  apply();
}

function apply() {
  document.documentElement.classList.toggle('dark', getThemeMode() === 'dark');
}

export function initTheme() {
  apply();
}
