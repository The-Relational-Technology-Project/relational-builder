import { CLAUDE_MODELS } from '@/providers/claude';
import { shortModelName } from '@/providers/model-label';

/**
 * The lighter-model nudge.
 *
 * Nobody needs Opus to rename a title — but nobody remembers to switch the
 * model before a two-word change either, and the model menu is the last
 * thing on a person's mind mid-thought. So the composer notices when a draft
 * looks like a small change on a heavy model and offers the lighter one, for
 * that one message, right where they're about to press send.
 *
 * It is a nudge, not a switch. The person's model stays theirs — pinned or
 * default — and nothing moves unless they tap. A miss in either direction is
 * cheap: a false "small" is a chip they ignore, a false "big" is no chip at
 * all. That is what lets the judgment below stay simple and conservative.
 */

/** The lighter model offered for a small change, per heavy model. Sonnet 5 is
 *  the one-tier step for everything heavier — Haiku's shorter output cap and
 *  the SEARCH/REPLACE edit format make it a worse bet for real edits. */
export function lighterModelFor(activeModelId: string): string | null {
  if (/opus|fable|mythos/i.test(activeModelId)) return 'claude-sonnet-5';
  return null;
}

/**
 * Output price per million tokens, first-party rates. Price is the proxy the
 * whole app already uses for footprint (the Steward view prices per model at
 * these same rates), and a model's size moves cost and energy the same
 * direction. Kept here, not fetched — this only ever feeds a rough fraction.
 */
const OUTPUT_USD_PER_MTOK: Record<string, number> = {
  'claude-fable-5-1': 50,
  'claude-opus-5': 25,
  'claude-opus-4-8': 25,
  'claude-sonnet-5': 10,
  'claude-haiku-4-5': 5,
};

/** "about two-fifths of the cost" — a fraction a person can hold, never a
 *  percentage with false precision. Null when either price is unknown. */
export function relativeCostLabel(fromModelId: string, toModelId: string): string | null {
  const from = OUTPUT_USD_PER_MTOK[fromModelId];
  const to = OUTPUT_USD_PER_MTOK[toModelId];
  if (!from || !to || to >= from) return null;
  const ratio = to / from;
  const fraction =
    ratio <= 0.22 ? 'a fifth' :
    ratio <= 0.28 ? 'a quarter' :
    ratio <= 0.36 ? 'a third' :
    ratio <= 0.45 ? 'two-fifths' :
    'half';
  return `about ${fraction} of the cost`;
}

/** Named the way the model menu names them — "Sonnet 5", not "Claude Sonnet 5" */
export function modelDisplayName(id: string): string {
  return shortModelName(CLAUDE_MODELS.find(m => m.id === id)?.name ?? id);
}

// The preview's point-at-it messages: a quoted string and its replacement, a
// photo swap. Mechanical by construction — the surest "small" there is.
const MACHINE_SMALL_RE =
  /^(Copy change — this text in the preview:|Swap this photo in the preview|About this element in the preview:)/;

// Words that describe a tweak to something that already exists
const TWEAK_RE =
  /\b(rename|retitle|title|heading|headline|subtitle|tagline|text|copy|wording|word|typo|spell|caption|label|placeholder|say|says|read|reads|color|colour|font|bold|italic|bigger|smaller|larger|tiny|huge|padding|spacing|margin|gap|align|center|centre|left|right|darker|lighter|rounded|border|shadow|icon|swap|replace|move|hide|show|remove|delete|tweak|adjust|nudge|shorten|capitali[sz]e|lowercase|uppercase|date|time|name|link|url|button text|change)\b/i;

// Words that mean the ask has shape beyond a tweak: new surface, new
// capability, new data, or "all of it"
const SCOPE_RE =
  /\b(page|screen|tab|view|feature|section|form|flow|wizard|onboarding|login|log in|sign ?in|sign ?up|account|profile|user|admin|database|backend|server|api|integrat\w*|connect\w*|payment|checkout|email|notif\w*|calendar|map|chart|graph|search|filter|sort|pagination|upload|export|import|sync|deploy|publish|redesign|rework|rewrite|refactor|restructure|rebuild|overhaul|everything|all of|whole|entire|each|every|multiple|several|another|also|as well|and then|plus|dark mode|responsive|mobile|accessib\w*|animation|component|table|list of|dashboard)\b/i;

const SMALL_MAX_CHARS = 160;

/**
 * Does this draft read like a small change — the kind of ask that doesn't
 * need the heaviest model in the room? Deliberately conservative: it says
 * "small" only for the preview's mechanical messages and for short, single
 * asks that talk like a tweak and never mention anything with shape.
 */
export function looksLikeSmallChange(draft: string): boolean {
  const text = draft.trim();
  if (!text) return false;
  if (MACHINE_SMALL_RE.test(text)) return true;
  if (text.length > SMALL_MAX_CHARS) return false;
  // Two or more sentences is usually two or more asks
  if ((text.match(/[.!?](\s|$)/g) ?? []).length > 1) return false;
  if (text.includes('\n')) return false;
  if (SCOPE_RE.test(text)) return false;
  return TWEAK_RE.test(text);
}

// "Keep Opus 5" means keep it — for the rest of this sitting, not just this
// draft. In memory on purpose: a reload is a fresh sitting, and a preference
// that quietly persisted forever would be the nudge you can never get back.
let hushed = false;

export function hushLighterModelNudge(): void {
  hushed = true;
}

export function lighterModelNudgeHushed(): boolean {
  return hushed;
}

/** Test seam — a session-level flag has to be resettable between scenarios */
export function resetLighterModelNudge(): void {
  hushed = false;
}
