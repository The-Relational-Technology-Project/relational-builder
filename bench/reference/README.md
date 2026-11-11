# Reference screens and UI specs (bench fixtures)

For the reference experiment (Nov 11, 2026): does an open model build closer
to a strong design when it is *shown* one (a screenshot) or *told* one in
detail (a written UI spec)?

Everything here was drawn from Opus 5.5 builds of the same prompts, so a
build that uses these fixtures had Opus's design in hand. The screenshots
are Opus's first screens at 1280 wide (Nov 6 for the two comparison prompts,
Nov 10 for the spread prompts). Each `.md` spec was written by reading that
build's screen and code: screen order, layout, kit parts, palette and type,
and what the seed content has to say.

Arms (`BENCH_REFERENCE`, see `bench/lib/reference.ts`): `same` (this
prompt's screenshot), `spec` (this prompt's spec), `both`, `other` (the
screenshot of a different prompt, to test whether quality carries to a new
subject or only gets copied).
