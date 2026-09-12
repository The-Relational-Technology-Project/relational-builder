/**
 * Turning token counts into watt-hours, and watt-hours into something a
 * person can picture.
 *
 * Two things this module is careful about, because the numbers invite
 * overclaiming in both directions:
 *
 * 1. **The token counts are exact; the conversion is not.** No lab publishes
 *    per-token energy for a specific served model, so the coefficient is
 *    inferred two ways that disagree by roughly twentyfold — from hardware
 *    (~2 FLOPs per active parameter per token at realistic sustained
 *    throughput, plus datacenter overhead) it lands near 0.04–0.15 mWh per
 *    output token; from the per-prompt figures labs have published (Google's
 *    measured Gemini Apps median, the widely-quoted ChatGPT figure) it lands
 *    nearer 0.8–1.1 mWh, because those include idle capacity and the whole
 *    serving stack. So every figure here travels as a BAND. Anything that
 *    renders a single confident number is inventing precision we don't have.
 *
 * 2. **Comparisons have to sit at the right order of magnitude.** Vehicle
 *    equivalents were the first instinct and they don't work: a whole
 *    project comes out around 376 feet of driving, which reads as "this is
 *    nothing" — and inflating it to avoid that would be a lie. Household
 *    appliances land in the same range as the real number, so the comparison
 *    informs instead of either alarming or dismissing.
 */

/**
 * The band, as multipliers on the central estimate the server computes.
 * Central is 0.2 mWh per output-equivalent token; the ends are 0.05 and 1.0.
 * Kept as multipliers so only one number crosses the wire and the band can
 * never drift out of step with it.
 */
export const ENERGY_BAND = { low: 0.25, high: 5 } as const;

export function energyBand(wh: number): { low: number; high: number } {
  return { low: wh * ENERGY_BAND.low, high: wh * ENERGY_BAND.high };
}

/** "840 Wh" · "2.4 kWh" · "18 kWh" — watt-hours at a glance */
export function formatWh(wh: number): string {
  if (wh >= 10_000) return `${Math.round(wh / 1000)} kWh`;
  if (wh >= 1_000) return `${(wh / 1000).toFixed(1)} kWh`;
  if (wh >= 100) return `${Math.round(wh)} Wh`;
  if (wh >= 1) return `${wh.toFixed(1)} Wh`;
  return wh > 0 ? '<1 Wh' : '0 Wh';
}

/**
 * Household anchors, smallest first. Conventional figures: a phone battery
 * is ~12.7 Wh, boiling a litre takes ~100 Wh, a washing machine cycle ~500
 * Wh, a fridge ~1.2 kWh a day.
 *
 * Deliberately all domestic and all electrical — the point is a reader
 * recognising the scale from their own kitchen, not a precise conversion.
 */
const ANCHORS: readonly { wh: number; one: string; many: string }[] = [
  { wh: 12.7, one: 'phone charge', many: 'phone charges' },
  { wh: 100, one: 'kettle boiled', many: 'kettles boiled' },
  { wh: 500, one: 'load of laundry', many: 'loads of laundry' },
  { wh: 1_200, one: 'day of running a fridge', many: 'days of running a fridge' },
  { wh: 36_000, one: 'month of running a fridge', many: 'months of running a fridge' },
];

/**
 * The most legible household comparison for an amount of energy — e.g.
 * "about 3 kettles boiled". Picks the largest anchor the amount roughly
 * reaches, so counts stay in the range a person can hold in their head
 * instead of reading "1,700 phone charges".
 */
export function kitchenEquivalent(wh: number): string | null {
  if (!(wh > 0)) return null;

  // The largest anchor this amount essentially reaches. 0.75 rather than 1
  // so ~96 Wh reads as "about 1 kettle" instead of "7.6 phone charges" —
  // nearer the truth of what it feels like.
  let anchor = ANCHORS[0];
  for (const candidate of ANCHORS) {
    if (wh >= candidate.wh * 0.75) anchor = candidate;
  }

  const count = wh / anchor.wh;
  // Only the smallest anchor can come out under its own threshold, and
  // "about 0 phone charges" is worse than saying so plainly
  if (count < 0.75) return `less than a ${anchor.one}`;

  const rounded =
    count >= 10 ? Math.round(count) : Number(count.toFixed(1));
  // "1.0 kettles boiled" reads worse than "1 kettle boiled"
  const label = Math.abs(rounded - 1) < 0.05 ? anchor.one : anchor.many;
  const shown = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `about ${shown} ${label}`;
}
