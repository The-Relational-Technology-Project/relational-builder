/** Light/dark/system theme, applied via the `.dark` class on <html>. */

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'rb-theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemeMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export function setThemeMode(mode: ThemeMode) {
  if (mode === 'system') localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, mode);
  apply();
}

function apply() {
  const mode = getThemeMode();
  const dark = mode === 'dark' || (mode === 'system' && media.matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function initTheme() {
  apply();
  media.addEventListener('change', apply);
}
