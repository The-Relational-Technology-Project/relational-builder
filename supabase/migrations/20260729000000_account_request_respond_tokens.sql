-- One-click steward response links: the account-request alert email carries
-- tokenized approve/decline links (steward-respond function). Only a SHA-256
-- hash of the token is stored — the token itself exists nowhere but the
-- steward's inbox, so a database read can't mint a working approval link.

alter table public.account_requests
  add column if not exists respond_token_hash text,
  add column if not exists respond_token_expires_at timestamptz;

create unique index if not exists account_requests_respond_token_hash_idx
  on public.account_requests (respond_token_hash)
  where respond_token_hash is not null;
