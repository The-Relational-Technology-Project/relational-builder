-- Where a request came from, when it came from a person.
--
-- Being invited to a project doesn't open the door on its own — every new
-- builder still goes past a steward. But "Leslie invited them to a project
-- she owns" is the single most useful thing a steward can know when deciding,
-- and until now the request form threw it away: someone invited to collaborate
-- hit the same generic "this email doesn't have an account yet" wall as a
-- stranger, and arrived in the queue looking like one.
--
-- Nullable and purely informational. Nothing reads these to grant anything.

alter table public.account_requests
  add column if not exists invited_by_email text,
  add column if not exists invited_project_name text;

comment on column public.account_requests.invited_by_email is
  'Email of the existing builder whose project invitation brought this person to the door (informational only — approval is still a steward decision)';
comment on column public.account_requests.invited_project_name is
  'Name of the project they were invited to collaborate on';
