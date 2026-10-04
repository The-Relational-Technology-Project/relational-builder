-- Radically Rural: offer part of the seeded shelf to the whole Gallery
-- (Oct 4 2026).
--
-- The three seed passes landed studio-private, leaving any wider sharing to
-- a Studio Admin. This is that act, taken by the studio's admin (Deborah)
-- for the summit. 44 rows become `shared`, so they appear in the Commons
-- gallery for every signed-in builder, credited and badged with the studio:
-- - the 42 models from Radically Rural's own library
-- - Dorn Cox's two: Tuckaway Food Commons and Farm Hack
--
-- Everything else stays studio-private for now: the 19 New Ruralism case
-- studies and the 14 Becky McCray recipes and linked resources. They aren't
-- Radically Rural's to publish, so they wait on their owners' blessing.
--
-- Also narrow:
-- - Seeded rows only (created_by is null). Members' own contributions keep
--   whatever visibility they were given.
-- - Not principles. The gallery never renders them as cards, and they stay
--   the studio's own frame.
-- - Gallery only. Nothing is submitted to the Civic Commons review queue;
--   that stays a per-item choice in Studio Admin.
--
-- Must run after the three seeds (20261002093000, 20261002100000,
-- 20261002110000). Re-running a seed recreates its rows as studio-private,
-- so re-run this afterwards. To undo, set visibility back to 'studio' with
-- the same filter, or per item with the lock icon in Studio Admin.

update public.studio_library_items
  set visibility = 'shared'
  where studio_slug = 'radically-rural'
    and created_by is null
    and kind <> 'principle'
    and (attribution like '% · Radically Rural models library'
         or title in ('Tuckaway Food Commons', 'Farm Hack'));
