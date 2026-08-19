-- The default Relational Tech studio is standard, not an affiliation
-- (Aug 19 2026). Every builder already works inside the 'rt' frame out of
-- the box (DEFAULT_STUDIO_SLUG) — its principles ride in every build's
-- context with no membership row involved. This closes the one gap where
-- membership still mattered: the shelf. Anything the stewards put in the
-- 'rt' studio library now reaches every signed-in builder, in the gallery
-- and in the AI's context, with nothing to join. Real studios (Thread,
-- Bloom, Responsive Cities, ...) keep their doors: approved membership
-- still gates their studio-private items.
--
-- (Applied to the community project via management API on 2026-08-19.)

drop policy if exists "studio items readable" on public.studio_library_items;
create policy "studio items readable" on public.studio_library_items
  for select using (
    public.is_studio_admin(studio_slug)
    or (
      public.is_approved_studio_member(studio_slug)
      and (status = 'approved' or created_by = auth.uid())
    )
    or (auth.uid() is not null and visibility = 'shared' and status = 'approved')
    -- The default studio's approved shelf is community-standard
    or (auth.uid() is not null and studio_slug = 'rt' and status = 'approved')
  );
