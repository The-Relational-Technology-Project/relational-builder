# Exporting the commons

The whole RT Commons comes out to disk with one command, from a plain clone
of this repo:

```
npm run export:commons
```

No account, no API key, no build step. It reads the same public shelves the
Builder reads on every message — the anon keys are already in the repo
(`src/knowledge/commons-search.ts`) — so anyone who can clone can export.

Options:

```
node scripts/export-commons.mjs --out DIR --format json|vault|both
```

## What comes out

`commons-export/` (gitignored — it's regenerable):

| Path | What it is |
| --- | --- |
| `commons.json` | Every entry with full body, metadata, attribution, lineage, plus a provenance block (source project, table, filter, timestamp, counts). |
| `vault/` | One Markdown note per entry, YAML frontmatter, foldered by kind, wikilinked by lineage. An Obsidian vault as-is. |
| `network-feed.json` | The watcher's recent events — builder repos published with `.reltech.yml` lineage. A stream, not a library, so it stays raw. |
| `README.md` | Counts, provenance, licensing, and how to re-run — written into the export so it travels with the folder. |

As of the last run that's **451 entries**: 208 references, 95 stories,
73 recipes, 29 tools, 18 frameworks, 18 prompts, 10 methodologies — across
the `rtp-canonical`, `civic-media`, and `rt-studio` shelves.

## The vault

Point Obsidian at `commons-export/vault` (Open folder as vault) and the
commons opens as a graph. Every note carries:

- **Frontmatter** — `title`, `slug`, `kind`, `studio`, `license`, `tags`,
  `topics`, author/neighborhood attribution, `source_url`, `created`,
  `updated`, `rtp_id`, `exported`.
- **Tags** — `commons/<kind>` and `studio/<slug>` plus the entry's own
  topic tags, flattened to Obsidian's tag rules (the unmodified list stays
  under `topics`).
- **Lineage** — `parent_slug` becomes a `[[wikilink]]` both ways, so
  backlinks and graph view show what descends from what.
- **A footer** — contributor, source link, license, so credit survives
  a copy-paste out of the vault.

Logseq, and anything else that reads a folder of Markdown with YAML
frontmatter, works too.

## Things the data does that the exporter handles

- **Slugs are not unique.** 31 slugs appear twice — usually a prompt and the
  tool it belongs to. Entry identity is `id`; the exporter dedupes note
  filenames with a `Title (slug)` suffix and resolves `parent_slug` to the
  first entry that isn't the note itself (which is what the 8 self-referential
  rows actually mean).
- **Studio assets are site-relative.** `/images/gallery/…` and one
  `/Builders_Guide_RTP.pdf` are qualified against
  `studio.relationaltechproject.org` so links resolve outside the Studio site.
- **Some bodies already have a `## Lineage` heading**, so the exporter's own
  section is called `## Related in the commons`.

## What is deliberately left out

People's own material: Builder projects, profiles, studio memberships, and
build plans (those carry chat excerpts). The commons is the shared library,
not anyone's workspace. `search_vector`, `created_by` and `updated_by` are
dropped too — a Postgres index and two account ids, neither of them content.

## Licensing

Most entries carry `RCL-1.0`; some have no license field yet. Attribution is
per-entry and travels with the entry in both formats. Keep it attached when
reusing or republishing.
