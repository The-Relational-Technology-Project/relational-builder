/**
 * A project's place: where the software lives and the area it serves.
 *
 * Place is a thing a builder adds, like a photo — never read off an IP
 * address, never set by default. It lives on the project's lineage, so it
 * persists everywhere lineage does. From there it reaches four places:
 *
 *   1. The prompt (formatPlaceForPrompt) — the model knows the neighborhood,
 *      the catchment in words, and that local civic data may be in reach.
 *   2. The repo — a `place:` block in .reltech.yml, when the builder opted
 *      into the public map.
 *   3. The published app — `/place.json` beside index.html, same opt-in, so
 *      a crawler can draw a map of public place-based software from the
 *      sites themselves (docs/PLACE-AS-PLATFORM.md).
 *   4. The commons — a contribution carries the location and catchment, so
 *      the gallery's "Serves here" filter finds it the day it is shelved.
 *
 * `public` is the one switch for 2 and 3. Off, the place stays in the
 * Builder (and the prompt) only. A solo builder's place is often their home,
 * so the dialog rounds typed places to the geocoder's resolution and says so.
 */

import type { FileEntry } from './virtual-fs';
import { describeCatchment, type GeoLocation } from '@/knowledge/geo';

export interface ProjectPlace extends GeoLocation {
  /** List this project on the public map: write place.json and the manifest block */
  public: boolean;
}

/** The current place.json spec version — bump when the shape changes */
export const PLACE_FILE_VERSION = 1;
export const PLACE_FILE_PATH = '/place.json';

/**
 * The file a published app serves at /place.json when the builder opted in.
 * Everything a map needs and nothing else: no builder identity, no
 * contact, no exact point beyond what the builder typed.
 */
export function placeFileContent(place: ProjectPlace, projectName: string): string {
  const body = {
    version: PLACE_FILE_VERSION,
    generator: 'relational-builder',
    name: projectName,
    lat: place.lat,
    lng: place.lng,
    label: place.label,
    precision: place.precision,
    ...(place.also && place.also.length > 0 ? { also: place.also } : {}),
    ...(place.catchment ? { catchment: place.catchment } : {}),
  };
  return JSON.stringify(body, null, 2) + '\n';
}

/** Append /place.json to a file list when the place is public and nothing else wrote one */
export function withPlaceFile(files: FileEntry[], place: ProjectPlace | undefined, projectName: string): FileEntry[] {
  if (!place?.public) return files;
  if (files.some(f => f.path.replace(/^\//, '') === 'place.json')) return files;
  const now = Date.now();
  return [...files, { path: PLACE_FILE_PATH, content: placeFileContent(place, projectName), language: 'json', createdAt: now, updatedAt: now }];
}

const yamlEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * The `place:` block for .reltech.yml — only when public. A polygon's
 * rings do not belong in YAML; the manifest points at place.json for them.
 */
export function placeManifestLines(place: ProjectPlace | undefined): string[] {
  if (!place?.public) return [];
  const c = place.catchment;
  const lines = [
    'place:',
    `  label: "${yamlEscape(place.label)}"`,
    `  lat: ${place.lat}`,
    `  lng: ${place.lng}`,
    `  precision: ${place.precision}`,
  ];
  if (c) {
    lines.push('  catchment:');
    lines.push(`    kind: ${c.kind}`);
    lines.push(`    source: ${c.source}`);
    lines.push(`    label: "${yamlEscape(c.label)}"`);
    if (c.kind === 'radius' && typeof c.miles === 'number') lines.push(`    miles: ${c.miles}`);
    if (c.kind === 'polygon') lines.push('    rings: see place.json');
    if (c.ref) lines.push(`    ref: "${yamlEscape(c.ref)}"`);
    if (c.edges) lines.push(`    edges: ${c.edges}`);
  }
  lines.push('  public: true', '');
  return lines;
}

/** One line for a card or a menu: "Palmer Square, Chicago · serves 1.5 miles around it" */
export function placeSummary(place: ProjectPlace): string {
  const serves = describeCatchment(place);
  const edges = place.catchment?.edges ? ` · ${place.catchment.edges} boundary` : '';
  // A block's label already is the area: "46th Ave, Moraga to Noriega, Outer Sunset"
  if (place.catchment?.source === 'block') return `${place.label}${edges}`;
  return serves ? `${place.label} · serves ${serves}${edges}` : place.label;
}

/**
 * The system-prompt block. Stable across a session (place changes rarely),
 * so it sits in the cacheable half of the prompt beside the region block.
 */
export function formatPlaceForPrompt(place: ProjectPlace | undefined): string | null {
  if (!place) return null;
  const serves = describeCatchment(place);
  const c = place.catchment;
  const kind =
    c?.source === 'watershed' ? 'a watershed, so its neighbors are everyone upstream and downstream of it'
    : c?.source === 'bioregion' ? 'a bioregion, a boundary drawn by the land rather than by an administration'
    : c?.source === 'block' ? 'one block: both sides of the street between its two corners'
    : c?.source === 'zip' ? 'a ZIP code'
    : c?.source === 'drawn' || c?.source === 'geojson' ? 'a boundary the builder drew or chose'
    : c?.kind === 'polygon' ? 'a named boundary'
    : c?.kind === 'radius' ? 'a radius around the place'
    : null;
  return [
    '## This Project\'s Place',
    '',
    `This software is for **${place.label}**${serves ? `, and serves ${serves}` : ''}${kind ? ` (${kind})` : ''}. The builder set this themselves; treat it as a fact about the tool, not a guess.`,
    '',
    '- **Draw from the place.** Names, examples, default map centres, time zone, units, and the plan\'s Look & feel can all come from this place rather than from nowhere. Prefer a real street, park, or landmark there over a generic one when an example needs one.',
    `- **Maps.** When the tool shows a map, centre it on the place (lat ${place.lat}, lng ${place.lng})${c?.source === 'block' ? ' and zoom to the block (about zoom 17)' : c?.kind === 'radius' ? ` and fit roughly ${c.miles} miles` : c?.kind === 'polygon' ? ' and draw the catchment boundary from /place.json when it ships' : ''}. Leaflet + OpenStreetMap, never Google Maps.`,
    c?.edges === 'strict'
      ? `- **Strict boundary.** The builder said this tool is for ${serves ?? place.label} and nowhere else. Say so on the page in plain words ("For 46th Avenue between Moraga and Noriega"). Keep what it shows and collects inside the area: local data filtered to it, no "nearby" feed from outside it, and when someone signs up or adds something, ask in words whether they live or work here (a cross street or a yes is enough, never an address) and take their word. A person from outside gets a kind line about who it is for and, where one exists, a pointer to the wider place's tools. Never gate by IP address or GPS: that excludes the people who belong and stops nobody else.`
      : `- **${c?.edges === 'rough' ? 'Rough boundary. ' : ''}Who it is for.** ${c?.edges === 'rough' ? `The builder said the area is who this is mostly for, not a line: someone a street over is welcome. ` : ''}If the brief says the tool is for people in this place, say so on the page in plain words ("For the blocks around Palmer Square") and welcome visitors rather than blocking them. Never gate by IP address or GPS: that excludes the people who belong and stops nobody else.`,
    ...(c?.source === 'block' ? [`- **One block.** Everything can be this specific: the street's real name, its two cross streets, what is true of this block alone. If the place's commons is listed in this prompt, its notes on this block (history pinned to it, old photographs, the city's schedule for it) are the first material to design from${c.ref ? `; the block's id there is \`${c.ref}\`` : ''}.`] : []),
    '- **Local data.** If live civic data for this city is listed in this prompt, reach for it before asking people to type what the city already publishes.',
    place.public
      ? '- **Public map.** The builder has chosen to list this project on the public map of place-based software: the published site serves `/place.json` describing the place and catchment. Do not write that file yourself; the Builder adds it at publish time.'
      : '- The place is private to the Builder for now: do not write it into files or copy the coordinates into the app beyond what the tool itself needs.',
  ].join('\n');
}
