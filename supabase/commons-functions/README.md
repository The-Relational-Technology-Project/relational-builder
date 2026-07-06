# Commons edge functions (RTP Website project)

Functions in this directory deploy to the **RT Commons** Supabase project
(`odowkowcinyoxejyzhwl` — the RTP Website / commons backend), NOT the
Relational Builder project like everything under `supabase/functions/`.

They live in this repo because the Builder is their main consumer and there
is no other versioned home for them (the commons project is otherwise
Lovable-managed).

- `steward-bridge/` — authenticated bridge the Builder's `admin-requests`
  function calls to list the contribution review queue and forward
  approve/reject decisions to the commons' own `review-contribution`
  function. Auth: `x-bridge-key` must match the `STEWARD_BRIDGE_KEY` secret
  on the commons project.
- `submit-contribution/` — the commons' existing write path (originally
  deployed from Lovable), extended so submissions can carry a
  `studio_slug`/`studio_label`: contributions land with that studio as
  `source_studio_slug` instead of everything pooling under
  `open-contributions`. Fully backwards compatible — omitted slug behaves
  exactly as before.

Deploy (Management API, from a session with `SUPABASE_ACCESS_TOKEN`):

```sh
curl -X POST "https://api.supabase.com/v1/projects/odowkowcinyoxejyzhwl/functions/deploy?slug=<name>" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -F 'metadata={"name":"<name>","entrypoint_path":"index.ts","verify_jwt":false};type=application/json' \
  -F 'file=@<name>/index.ts;filename=index.ts'
```
