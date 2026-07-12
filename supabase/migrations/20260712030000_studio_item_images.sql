-- Studio gallery items can carry a screenshot (e.g. the Thread example apps'
-- images, hosted in this project's storage) — same role image_url plays for
-- KB tools in the Commons Gallery.

alter table public.studio_library_items
  add column if not exists image_url text;
