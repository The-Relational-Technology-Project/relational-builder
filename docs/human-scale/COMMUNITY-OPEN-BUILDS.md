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

The evidence behind the model choice is in `LOG.md` and `BENCH-BOARD.md`;
a separate technical plan covers using several open models across the
community plan's jobs.
