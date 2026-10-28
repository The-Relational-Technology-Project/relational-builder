/**
 * The human-scale experiment flag. See docs/human-scale/README.md.
 *
 * Off everywhere by default, including on the human-scale branch. On when
 * the build sets VITE_HUMAN_SCALE=1, or when a person opens the Builder
 * with ?humanScale=1 once (the choice sticks in localStorage for that
 * browser; ?humanScale=0 clears it). This is the only module that reads
 * either source; everything else asks isHumanScale().
 */

const STORAGE_KEY = 'rb.humanScale';

function readOverride(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const param = new URLSearchParams(window.location.search).get('humanScale');
    if (param === '1') {
      window.localStorage.setItem(STORAGE_KEY, '1');
      return true;
    }
    if (param === '0') {
      window.localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return window.localStorage.getItem(STORAGE_KEY) === '1' ? true : null;
  } catch {
    return null;
  }
}

export function isHumanScale(): boolean {
  const override = readOverride();
  if (override !== null) return override;
  return import.meta.env.VITE_HUMAN_SCALE === '1';
}
