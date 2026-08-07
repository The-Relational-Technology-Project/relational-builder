/**
 * How a model is named in the builder's UI.
 *
 * The person's attention belongs on what they're building, not on whose model
 * is doing the work — so the vendor prefix comes off the chip, the menu, and
 * the in-chat model notes: "Claude Opus 5" reads as "Opus 5". Which model is
 * running stays visible; it just stops being a brand announcement in every
 * corner of the screen.
 *
 * The prefix stays on for multi-vendor providers (OpenRouter lists Claude next
 * to everyone else's models), where the vendor is exactly what tells two
 * entries apart.
 */

/** Providers whose model list comes from a single vendor */
const SINGLE_VENDOR = new Set(['claude', 'rtp-hosted']);

/** "Claude Opus 5" → "Opus 5" */
export function shortModelName(name: string): string {
  return name.replace(/^Claude\s+/, '') || name;
}

export function modelLabel(model: { name: string; provider: string }): string {
  return SINGLE_VENDOR.has(model.provider) ? shortModelName(model.name) : model.name;
}
