#!/usr/bin/env node
/**
 * Did a build for a place use what the place's commons said?
 *
 *   node scripts/human-scale/place-grounding.mjs <built-app-dir | files.json> [brief.md]
 *
 * For the hs-block-sweep task (bench/tasks.ts): the prompt carries a design
 * brief from the Outer Sunset's commons. This reads the built files and
 * checks, without a model, the things a reviewer would look for first:
 *
 *   reads_live       the app fetches the block from the commons, not a copy
 *   real_schedule    both sides' real days appear (or come from the live read)
 *   signs_caveat     "the signs on the block are the last word" survived
 *   credits_sources  at least two of the brief's sources are named or linked
 *   no_location_gate no navigator.geolocation: a tool asks in words
 *   years_from_brief every four-digit year in the app is one the brief gave
 *
 * The last one is a flag for a person, not a verdict: a year the brief never
 * mentioned is where an invented fact usually shows. Prints one JSON line.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (!target) { console.error('Usage: place-grounding.mjs <built-app-dir | files.json> [brief.md]'); process.exit(1); }
const here = dirname(fileURLToPath(import.meta.url));
const brief = readFileSync(process.argv[3] ?? join(here, '../../bench/fixtures/place-brief-46-moraga.md'), 'utf8');

function read(path) {
  if (statSync(path).isDirectory()) {
    return readdirSync(path).filter(n => n !== 'node_modules' && !n.startsWith('.')).map(n => read(join(path, n))).join('\n');
  }
  if (path.endsWith('.json')) {
    try {
      const j = JSON.parse(readFileSync(path, 'utf8'));
      if (Array.isArray(j) && j[0]?.content !== undefined) return j.map(f => f.content).join('\n');
    } catch { /* fall through to raw text */ }
  }
  return /\.(html?|[jt]sx?|css|md|json|txt)$/.test(path) ? readFileSync(path, 'utf8') : '';
}

const app = read(target);
const low = app.toLowerCase();
const hosts = [...new Set([...brief.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(m => m[1].replace(/^www\./, '')))];
const credited = hosts.filter(h => low.includes(h));
const years = s => new Set([...s.matchAll(/\b(1[89]\d\d|20\d\d)\b/g)].map(m => m[1]));
const briefYears = years(brief);
// Years in code that are not claims about the place: this year and the next two (dates the app computes)
const now = new Date().getFullYear();
const strange = [...years(app)].filter(y => !briefYears.has(y) && !(Number(y) >= now - 1 && Number(y) <= now + 2)).sort();

const checks = {
  reads_live: /block\.json\?where=/.test(app),
  real_schedule: (/\bmon(day)?\b/i.test(app) && /\bthu(rsday)?\b/i.test(app)) || /street_cleaning/.test(app),
  signs_caveat: /\bsigns?\b[^.]{0,80}\b(last word|read them)\b/i.test(app),
  credits_sources: credited.length >= 2,
  no_location_gate: !/navigator\.geolocation/.test(app),
  years_from_brief: strange.length === 0,
};
const passed = Object.values(checks).filter(Boolean).length;
console.log(JSON.stringify({ target, passed, of: Object.keys(checks).length, checks, credited, years_not_in_brief: strange, chars: app.length }));
process.exit(passed === Object.keys(checks).length ? 0 : 2);
