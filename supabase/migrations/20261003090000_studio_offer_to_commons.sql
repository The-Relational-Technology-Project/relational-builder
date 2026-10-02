-- A contributor can say whether their offer should go further (Oct 3 2026).
--
-- Until now a member's offer landed studio-private, and whether it was ever
-- carried to the broader RT Commons was a decision only a Studio Admin
-- made, with no way for the person who made the thing to say what they
-- wanted. That is the wrong way round: the contributor is the one who knows
-- whether their work is ready to travel, and consent to the studio is not
-- consent to the whole commons.
--
-- `offer_to_commons` records the contributor's intent and nothing more. It
-- NEVER publishes anything on its own: visibility stays 'studio' on the way
-- in (the insert policy below still enforces that), and only an admin
-- running shareStudioItemToCommons flips visibility and files the commons
-- submission. The flag just means the admin sees "they asked for this to go
-- further" instead of guessing.
--
-- Defaults to false, deliberately. An offer is to the studio unless its
-- author said otherwise — including every row already on every shelf.

alter table public.studio_library_items
  add column if not exists offer_to_commons boolean not null default false;

comment on column public.studio_library_items.offer_to_commons is
  'Contributor asked for this to be offered to the broader RT Commons. '
  'Intent only — an admin still has to share it. Default false.';

-- The insert policy is unchanged in substance and restated here so the
-- guarantee is readable in one place: a member may file a pending,
-- studio-private offer in their own name, and may set this flag on it. They
-- still cannot set visibility, cannot approve, and cannot publish.
drop policy if exists "add items" on public.studio_library_items;
create policy "add items" on public.studio_library_items
  for insert with check (
    public.is_studio_admin(studio_slug)
    or (
      public.is_approved_studio_member(studio_slug)
      and status = 'pending'
      and visibility = 'studio'
      and created_by = auth.uid()
    )
  );
