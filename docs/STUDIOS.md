# Studios: gated membership + private libraries

Studios can now be **gated** — membership needs approval from a **Studio
Admin** — and can keep a **private library** of principles, examples,
prompts, and materials that only approved members see:

- in the **gallery**, behind a library selector (Commons | Thread Studio | …)
- in the **AI's context** while an approved member chats and builds — the
  studio's principles ride in full, examples and materials as compact entries
- items stay studio-private until a Studio Admin **explicitly shares** one —
  either within Relational Builder (all signed-in builders see it in the
  gallery) or onward to the RT Commons review queue

Built for the Thread.org Relational Tech Service Year fellows in Baltimore:
Thread's principles and examples live behind the Thread Studio door until
some of them are offered to the broader commons.

## Roles

| Role | Granted by | Can |
|---|---|---|
| Steward (super admin) | `SUPER_ADMIN_EMAILS` | gate/ungate studios, grant/revoke Studio Admins (Steward → Studio access tab) |
| Studio Admin | Steward | approve/decline join requests, remove members, create/edit/delete/share library items (Studio admin page, in the account menu) |
| Member (approved) | Studio Admin | see the studio library in the gallery + AI context |
| Requester (pending) | — | nothing yet; their request waits at the door |

RLS on the Builder backend is the real boundary for all of it; the only
service-role paths are the two steward actions in the `admin-requests` edge
function (`studio_access_set`, `studio_admin_set`).

## Data model (Builder backend)

- `studio_settings` — `studio_slug`, `access: open | gated` (seeded: `thread` is gated)
- `studio_memberships` — gains `role: member | admin` and `status: pending | approved`.
  Joining an open studio inserts `approved`; joining a gated one inserts `pending`
  (RLS enforces the right status either way, and pins client inserts to `role = member`)
- `studio_library_items` — the shelf: `kind (principle | example | story | prompt | tool | recipe)`,
  `title`, `summary`, `body` (markdown), `url`, `attribution`, `tags`,
  `visibility (studio | shared)`, `commons_submitted_at`, `sort_order`

Studio identity (label, color) stays in the KB project's `studios` table, as before.

## Rollout

1. Apply the migration: `supabase db push` (or run
   `supabase/migrations/20260712000000_studio_access_control.sql` in the SQL editor).
2. Redeploy the edge function: `supabase functions deploy admin-requests`.
3. In the app as steward: **Steward → Studio access** — confirm Thread shows
   `gated`, then grant the first Studio Admin by email (they need a Builder
   account first).
4. Seed Thread's library, either
   - in the UI: the admin's **Studio admin → Library → Add item**, or
   - in bulk: copy `scripts/seed/thread-studio-library.example.json`, fill in
     the real principles/examples, then
     `BUILDER_SUPABASE_URL=… BUILDER_SERVICE_ROLE_KEY=… node scripts/seed-studio-library.mjs <file>`.
5. Point fellows at `https://<app>/?studio=thread` — the deep link activates
   the Thread frame; the gallery banner offers **Ask to join**, and approval
   unlocks the library.

## The remix loop

The loop a gated studio runs, end to end:

1. An approved member finds a studio app example in the gallery (their
   studio's shelf) and hits **Build with this** — the item opens in Plan
   mode and its id is stamped into the project's lineage.
2. They build their remix in the chat (with the studio's principles and
   library in the AI's context throughout).
3. From **Share → Put it out there**, they publish and then **Share it to
   the studio's gallery** — the offer lands as `pending`, with `remix_of`
   pointing at the shelf item it grew from, and shows up in the studio's
   Network Updates.
4. A Studio Admin reviews it (Studio admin → Library → "Offered by
   members") and approves it onto the shelf.
5. The next member finds the remix in the gallery — badged `remix`, lineage
   in its details — and remixes that. And it continues.
6. Later, the admin shares chosen items beyond the studio (per item:
   visible to all RB builders, and optionally into the RT Commons queue).

Pending offers are never injected into anyone's AI context and never leave
the studio; members see their own pending offers badged "awaiting approval."

## Sharing to the commons

A Studio Admin shares per-item (Studio admin → Library → share icon):

- **Share it** — visibility flips to `shared`; the item appears in the main
  Commons Gallery for every signed-in builder, labeled with the studio.
  Reversible (make it studio-private again).
- **Also submit to RT Commons** — additionally files the item into the
  commons contribution queue (steward reviews as usual), with a
  `studio:<slug>` tag and the studio's attribution.
