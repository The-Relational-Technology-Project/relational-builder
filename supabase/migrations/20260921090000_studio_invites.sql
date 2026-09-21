-- Studio Admins can add members by email (Sep 21 2026). Until now a gated
-- studio's door only opened from the inside when someone knocked: a builder
-- asked to join, an admin approved. Admins now also reach out — type an
-- email, and that person belongs to the studio the moment they're signed
-- in, whether they already have a Builder account or make one later.
--
-- Mechanics: an invite row per (studio, email). A trigger on the invite
-- seats the person right away when a profile with that email already
-- exists; otherwise the existing first-sign-in trigger on profiles claims
-- any invites waiting for that email. Either way the membership arrives
-- already approved — the admin's invite IS the approval — and as a plain
-- member: the admin role still only comes from the steward.

create table if not exists public.studio_invites (
  id uuid primary key default gen_random_uuid(),
  studio_slug text not null,
  studio_label text not null,
  email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  invited_by_name text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null
);

create unique index if not exists studio_invites_slug_email_idx
  on public.studio_invites (studio_slug, lower(email));

alter table public.studio_invites enable row level security;

-- The invite list is the studio admins' — nobody else needs to see who has
-- been asked in, and the invitee learns by finding themselves inside.
drop policy if exists "admins see invites" on public.studio_invites;
create policy "admins see invites" on public.studio_invites
  for select using (public.is_studio_admin(studio_slug));

drop policy if exists "admins add invites" on public.studio_invites;
create policy "admins add invites" on public.studio_invites
  for insert with check (
    public.is_studio_admin(studio_slug)
    and invited_by = auth.uid()
  );

drop policy if exists "admins withdraw invites" on public.studio_invites;
create policy "admins withdraw invites" on public.studio_invites
  for delete using (public.is_studio_admin(studio_slug));

-- ── Seating: invite + account → approved membership ─────────────────

-- Shared by both triggers. An existing pending request for the same studio
-- is approved in place (the invite outranks the knock); an existing
-- approved row, admin or member, is left exactly as it is.
create or replace function public.seat_studio_invite(
  p_user uuid,
  p_display_name text,
  p_invite public.studio_invites
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.studio_memberships
    (user_id, studio_slug, studio_label, display_name, role, status)
  values (
    p_user,
    p_invite.studio_slug,
    p_invite.studio_label,
    p_display_name,
    'member',
    'approved'
  )
  on conflict (user_id, studio_slug) do update
    set status = 'approved'
    where public.studio_memberships.status <> 'approved';

  update public.studio_invites
    set claimed_at = now(), claimed_by = p_user
    where id = p_invite.id and claimed_at is null;
end;
$$;

-- On invite: if the person is already a builder, they're in right now.
create or replace function public.claim_studio_invite_now()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prof record;
begin
  new.email := lower(trim(new.email));
  select id, display_name into prof
  from public.profiles
  where lower(email) = new.email
  limit 1;
  if prof.id is not null then
    -- The invite row doesn't exist yet inside a BEFORE trigger, so mark it
    -- claimed here and seat the member directly.
    new.claimed_at := now();
    new.claimed_by := prof.id;
    insert into public.studio_memberships
      (user_id, studio_slug, studio_label, display_name, role, status)
    values (prof.id, new.studio_slug, new.studio_label, prof.display_name, 'member', 'approved')
    on conflict (user_id, studio_slug) do update
      set status = 'approved'
      where public.studio_memberships.status <> 'approved';
  end if;
  return new;
end;
$$;

drop trigger if exists studio_invites_claim_now on public.studio_invites;
create trigger studio_invites_claim_now
  before insert on public.studio_invites
  for each row execute function public.claim_studio_invite_now();

-- At first sign-in: every invite waiting for this email seats the new
-- builder. Runs beside claim_studio_intent (the ?studio= doorway), after
-- the profile row exists.
create or replace function public.claim_studio_invites_on_signin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.studio_invites;
begin
  for inv in
    select * from public.studio_invites
    where lower(email) = lower(coalesce(new.email, ''))
      and claimed_at is null
  loop
    perform public.seat_studio_invite(new.id, new.display_name, inv);
  end loop;
  return new;
end;
$$;

drop trigger if exists profiles_claim_studio_invites on public.profiles;
create trigger profiles_claim_studio_invites
  after insert on public.profiles
  for each row execute function public.claim_studio_invites_on_signin();
