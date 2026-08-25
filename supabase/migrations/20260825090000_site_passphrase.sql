-- Private sites on Community Hosting: an optional per-site passphrase.
-- Small groups keep asking for "a page just for us" (group agreements,
-- contact lists, meeting notes); until now the only real gate lived on
-- external hosts with serverless functions. The hash is set by the
-- publish-site function (PBKDF2), checked by the site function, and never
-- leaves the server — so the passphrase genuinely isn't in page source.
-- A closed door, not a vault: content is still plain files once unlocked.

alter table public.community_sites
  add column if not exists passphrase_hash text;
