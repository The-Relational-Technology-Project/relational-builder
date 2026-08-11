# The RT Commons, in git

*The shared library of the [Relational Technology Project](https://relationaltechproject.org) — every entry as a markdown file, mirrored nightly from the database. The git history is the commons' public changelog.*

Browse it rendered at **[relationalbuilder.org/commons](https://relationalbuilder.org/commons)** — theme guides, a story wall, a map of how everything connects. This repo is the same commons in its rawest, most portable form.

## What's in here

```
content/
  recipe/        practices with steps, ready to run on your block
  tool/          working neighborhood software, remixable in Relational Builder
  story/         first-hand accounts from real blocks
  prompt/        starting points for building your own version
  framework/     the thinking underneath the practices
  methodology/   how the RTP builds, documented
  reference/     the wider library the commons learns from
commons.json     every entry in one machine-readable file
connections.json the steward-confirmed graph between entries
```

Every file carries YAML frontmatter (title, kind, tags, attribution, license, lineage) and links its connections as relative paths, so the graph works on GitHub and in local tools alike.

**Obsidian:** clone the repo, open the folder as a vault, and the commons opens as a graph — backlinks, tags, search, the lot. `git pull` keeps it current.

## How this stays fresh

The commons lives in a database, stewarded through [RT Studio](https://studio.relationaltechproject.org) and grown through [Relational Builder](https://relationalbuilder.org). **The database is canonical.** A nightly [workflow](.github/workflows/mirror.yml) runs [`scripts/mirror.mjs`](scripts/mirror.mjs) — which anyone can run, no keys needed — and commits only when something actually changed. Read the commit log and you're reading the history of the commons: what was added, what was revised, when the ecosystem grew.

## Suggesting changes

Pull requests are welcome — as **suggestions**. Because the database is canonical, a merged edit here would be overwritten by the next mirror run; so instead, a steward reviews your PR, applies the accepted change upstream, and the next mirror commit makes it real (we'll close your PR with a link to that commit, and credit travels with the change). See [CONTRIBUTING.md](CONTRIBUTING.md).

## Siblings

- **[Neighboring Recipes](https://github.com/The-Relational-Technology-Project/neighboring-recipes)** — the hand-written, forkable cookbook of neighboring practices. About fifty practices live in both places; for those, the database entry here is canonical and the Neighboring Recipes file is listed as a source in its frontmatter. The cookbook keeps its own voice on purpose.
- **[Relational Builder](https://github.com/The-Relational-Technology-Project/relational-builder)** — the open-source app builder the commons feeds.

## License

Entries marked `RCL-1.0` are shared under the [Reciprocal Commons License v1.0](LICENSE.md) — free for neighbors, communities, and place-based organizations; commercial platforms, services, and AI systems need permission. Attribution travels with every entry: keep the credit attached when you reuse or republish. Entries derived from other publishers (the civic-media shelf) name and link their original source, which governs their terms.
