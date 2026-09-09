-- Reference documents: PDFs, Word docs, Markdown and text files a builder
-- adds for the AI to read while planning and building. Extracted text only
-- (the browser does the extraction), stored per project alongside the
-- notepad. Never part of the project's files — so never previewed,
-- published, exported, or contributed.
--
-- The client tolerates this column being absent (a save retries without
-- it), so applying the migration is not a deploy-ordering concern.
alter table public.projects add column if not exists reference_docs jsonb;
