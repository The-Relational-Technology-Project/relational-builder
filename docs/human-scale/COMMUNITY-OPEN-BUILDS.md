# Community builds on an open model: the switch

The free community plan plans with Claude and builds with Claude today.
The Builder is wired so that builds and edits on the community plan can
move to an open model (Gemma 4 26B by default) with one setting. It is
**off**. Planning stays on Claude either way.

## What is already on, for everyone

- **Gemma in the BYOK menu.** With their own OpenRouter key, anyone can
  pick Gemma 4 26B or Gemma 4 31B (listed after Claude). Requests to
  these models carry host routing that keeps them off the one host that
  served Gemma broken on the bench (and, for 26B, on full-precision hosts).
- **The open-model build path follows the model.** When an open builder
  model is the one building, the Builder applies what the bench showed
  open models need: the import and scaffold repairs, the make-it-obvious
  design guidance, up to three reference screens (in words for text-only
  models), the static checks and second fix pass, and the runaway guard.
  Claude builds are untouched. Code: `src/human-scale/open-build.ts`.

## Switching community builds to an open model

1. Deploy `supabase/functions/llm-proxy` (its `openrouter-community`
   route) and `supabase/functions/app-capabilities`.
2. Set the `OPENROUTER_COMMUNITY_KEY` secret on the Supabase project.
3. Set `VITE_COMMUNITY_OPEN_BUILDS=1` in the deploy's environment, and
   optionally `VITE_COMMUNITY_OPEN_BUILD_MODEL` to another model from
   `OPEN_BUILDER_MODELS` (for example `google/gemma-4-31b-it`).
4. Redeploy. Builds and edits on the community plan now run on the open
   model through the keyless route; the chat says so when it switches.

To switch back, unset `VITE_COMMUNITY_OPEN_BUILDS` and redeploy.

## Two plans to choose from: the second switch

`VITE_COMMUNITY_PLAN_CHOICE=1` replaces the single default with a choice
each person makes at the top of the model menu. It is **off**. The plans,
and which model does which job on each, are one table in
`src/cloud/community-plans.ts`:

- **Open-Weight Models**. Gemma 4 31B plans, builds and edits: one model
  for every job. Nothing on this plan runs on a closed model.
- **Frontier Models** (the default until a person switches). Claude today:
  Fable 5.2 plans, Opus 5.5 builds and edits. Changing what this plan runs on (Pareto is the candidate) is an
  edit to that plan's `stages`, plus a keyless community route for the
  new provider in `llm-proxy`.

A choice is saved to the person's profile (`profiles.community_plan`,
migration `20261116090000`) and in the browser. Someone who has not chosen
is on the default. Picking a single model in the menu still pins it for
the project, on either plan. The steward's Plan usage tab shows all-time
spend by kind of model.

Before turning it on:

1. Steps 1 and 2 above (the keyless route and its key).
2. `google/gemma-4-31b-it` must be on the proxy's covered list. It is in
   the default in `llm-proxy`; if the `COMMUNITY_OPEN_MODELS` secret is
   set, it has to be there too. Without it, every turn on the open-weight
   plan is refused.
3. Apply migration `20261116090000_community_plan.sql`. Until it is
   applied the choice still holds in the browser.
4. Set `VITE_COMMUNITY_PLAN_CHOICE=1` and redeploy.

The evidence behind the model choice is in `LOG.md` and `BENCH-BOARD.md`;
a separate technical plan covers using several open models across the
community plan's jobs.
