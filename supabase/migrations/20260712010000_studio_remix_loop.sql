-- The studio remix loop: approved members can offer their builds BACK to
-- the studio's gallery. A submission lands as `pending`, a Studio Admin
-- approves it onto the shelf, and the next member remixes it from there —
-- lineage intact via remix_of. Admin-curated items stay `approved` from
-- birth, so nothing already on the shelf changes.

alter table public.studio_library_items
  add column if not exists status text not null default 'approved'
    check (status in ('pending', 'approved')),
  add column if not exists remix_of uuid
    references public.studio_library_items(id) on delete set null;

-- Members see the approved shelf plus their own pending offers; admins see
-- the whole queue; anything shared beyond the studio must also be approved.
drop policy if exists "studio items readable" on public.studio_library_items;
create policy "studio items readable" on public.studio_library_items
  for select using (
    public.is_studio_admin(studio_slug)
    or (
      public.is_approved_studio_member(studio_slug)
      and (status = 'approved' or created_by = auth.uid())
    )
    or (auth.uid() is not null and visibility = 'shared' and status = 'approved')
  );

-- Admins curate directly; members file pending, studio-private offers in
-- their own name. Nobody self-approves and nobody shares beyond the studio
-- on the way in.
drop policy if exists "admins add items" on public.studio_library_items;
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

-- Approving (status flip), editing, and sharing stay admin work.
-- (The existing "admins edit items" update policy already covers this.)

-- A member can withdraw their own offer while it's still waiting.
drop policy if exists "admins remove items" on public.studio_library_items;
create policy "remove items" on public.studio_library_items
  for delete using (
    public.is_studio_admin(studio_slug)
    or (created_by = auth.uid() and status = 'pending')
  );

create index if not exists studio_library_items_status_idx
  on public.studio_library_items (studio_slug, status);
