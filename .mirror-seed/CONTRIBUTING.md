# Contributing to the RT Commons

The commons grows when people share what they've learned. This repo is one of the doors in.

## The one thing to know first

**The database is canonical; this repo mirrors it.** A pull request merged here would be silently overwritten by the next nightly mirror run. So PRs work as *suggestions*:

1. You open a PR editing any file under `content/` — a typo fix, a better step, a variation that worked on your block, a missing credit.
2. A steward reviews it and applies the accepted change upstream in the database.
3. The next mirror run commits the change for real, and we close your PR pointing at that commit. Your suggestion is now part of the commons, and the entry's attribution keeps your contribution visible where it belongs.

Don't let that flow stop you from opening small PRs — a one-word fix is exactly the right size.

## Other ways in

- **Share a story.** If you've run one of these practices where you live, we want the story — what you did, where, what happened. Awkward-but-honest beats triumphant. Open an issue here, or email commons@relationaltechproject.org.
- **Add a practice or tool.** Build it in [Relational Builder](https://relationalbuilder.org/new) and publish it back to the commons, or open an issue describing the practice and where it came from.
- **Suggest a connection.** If two entries belong together — this story is about that recipe, this tool descends from that one — open an issue naming both. Stewards confirm connections, and confirmed connections show up on the [map](https://relationalbuilder.org/commons/map).
- **Recipes shared with Neighboring Recipes.** About fifty practices also live in the [Neighboring Recipes](https://github.com/The-Relational-Technology-Project/neighboring-recipes) cookbook (they're marked with `neighboring_recipes:` in their frontmatter). The database entry here is canonical for content; the cookbook is its own hand-written publication, so improvements to the cookbook's voice belong in a PR over there.

## Attribution is the point

Every entry names who it came from, and the [Reciprocal Commons License](LICENSE.md) keeps that credit attached wherever the work travels. When you suggest a change, tell us how you'd like to be credited (name and, if you like, neighborhood) — practitioner credit is a relational requirement here, not just a legal one.
