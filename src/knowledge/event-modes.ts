/**
 * Per-event adjustments to how the AI works with data.
 *
 * Relational Builder's default is strict: real records come from the person
 * or a live source, never from memory. A buildathon room is a different
 * setting — one afternoon, a demo at the end, and civic data that should
 * come from the city's own endpoints where it can and from the open web
 * where it can't. For those events (and only those) the prompt swaps the
 * strict rule for a demo-context one that still names approximation plainly.
 *
 * Keyed on the event code stored on the builder's profile (they joined the
 * event with it), so the mode follows the person, not the project. Scoped
 * to one event by agreement: it is not a setting every buildathon gets.
 */

/** Event codes for the Responsive Cities Network buildathon (both rounds
 *  share a name and a room). Uppercase; compared case-insensitively. */
const DEMO_DATA_EVENT_CODES = new Set(['CITIES', 'CITIES26']);

export function isDemoDataEvent(eventCode: string | null | undefined): boolean {
  return !!eventCode && DEMO_DATA_EVENT_CODES.has(eventCode.trim().toUpperCase());
}

/**
 * The block that replaces the strict data rule for the room above. It leads
 * with the real-data paths the strict rule also prefers, adds the web as a
 * fallback, and asks for plain acknowledgement whenever the data is
 * approximate — the honesty the strict rule enforces by refusing, this one
 * enforces by saying so.
 */
export const DEMO_DATA_EVENT_BLOCK = [
  '## Buildathon Data Mode (this event only)',
  '',
  'This builder is in a buildathon room today: a few hours, a demo at the end, and a tool that should stand on real civic data where it can. For THIS event the "real records come from the person, never from memory" rule relaxes into the order below. Nothing else about how you work changes.',
  '',
  '1. **Live data first.** When a city data endpoint is available to you (the civic-data section, queried through its MCP tools), read the real schema and pull real rows — that is always the best demo. Prefer "the app reads it live from the city endpoint" over pasting a snapshot into a file.',
  '2. **Open public data second.** If no endpoint fits or a pull fails, search the web for an open public dataset (a city open-data portal, a state or federal source, a published CSV/GeoJSON) and load it from its public URL or, when it is small, as a `/data/` file. Say where it came from, in one line, in the app and in your reply.',
  '3. **Approximate data last, and say so.** When neither works, it is fine to build on approximate or illustrative records so the room can see the tool working — but say so plainly, once in your reply ("the numbers here are illustrative — swap in the city\'s export when you have it") and once in the app, as a small note near the data, never hidden. Keep approximate records obviously approximate: round numbers, a handful of rows, no invented people\'s names presented as real residents.',
  '',
  'Frame anything unusual as the demo context it is: "for today\'s build I\'m using…" is the right register. Never present approximate data as verified, never invent a dataset citation, and when the person adds a real data file later, its rows replace the approximation without a redesign.',
].join('\n');
