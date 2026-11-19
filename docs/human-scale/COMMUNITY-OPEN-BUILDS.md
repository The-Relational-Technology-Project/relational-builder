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
each person makes in Settings, where Community Access shows two plans:
Frontier Models Community Plan and Open-Weight Models Community Plan. It
is **on** in production since Nov 17. The plans,
and which model does which job on each, are one table in
`src/cloud/community-plans.ts`:

- **Open-Weight Models**. Gemma 4 31B plans, builds and edits: one model
  for every job. Nothing on this plan runs on a closed model, including
  the AI features inside the apps a person builds (from Nov 18; below).
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

## AI features in built apps follow the plan

When a builder turns on Community AI for an app (Services tab, "Use my
Community Plan"), every `ai_chat` call that app makes runs on the model of
the **owner's** plan, decided on the server in
`supabase/functions/app-capabilities`:

| Owner's plan | In-app AI runs on | Key |
|---|---|---|
| Open-Weight | Gemma 4 31B through OpenRouter, skipping the host the Builder skips | `OPENROUTER_COMMUNITY_KEY` (else the older `OPENROUTER_API_KEY`) |
| Frontier, or not chosen | Claude Opus 5.5, as before; an app can still ask for the open model with `runtime_model: "open"` | `ANTHROPIC_COMMUNITY_KEY` |

- The plan is read from `profiles.community_plan` on each call, so apps
  built before the plan existed (they call `ai_chat` with no
  `runtime_model`) move with their builder, with no rebuild.
- On the Open-Weight plan an app asking for Claude still gets the open
  model: the plan's promise is that nothing runs on a closed model.
- A builder's own vaulted key still wins over both, as before (their
  spend, their model choice).
- If the profile lookup fails, the call takes today's default (Frontier)
  rather than erroring, so nobody is moved onto a model they did not pick.
- Usage is metered as `app:<model>` against the owner's weekly budget; the
  steward's spend view now counts `app:google/gemma-4-31b-it` as
  open-weight spend.
- The models live in one place each: `appAI` on each plan in
  `src/cloud/community-plans.ts`, and `COMMUNITY_OPEN_MODEL` /
  `COMMUNITY_APP_MODEL` in the function. A test fails if they drift.

To turn it on: deploy `app-capabilities`. It needs `OPENROUTER_COMMUNITY_KEY`
on the Supabase project, which the open-weight builder route already uses.

The evidence behind the model choice is in `LOG.md` and `BENCH-BOARD.md`;
a separate technical plan covers using several open models across the
community plan's jobs.
