import { adminCall } from '@/cloud/account-requests';

/**
 * Event codes — the steward's side. An event code is a ?ref=CODE that works
 * like a builder's referral code at the door (auto-joins on the spot) but
 * belongs to an event: everyone who joins through it gets the code stamped
 * on their profile, so the room can be counted and its people can find each
 * other. All writes go through admin-requests (steward-only, service role).
 */

export interface EventCode {
  code: string;
  name: string;
  active: boolean;
  /** The day of the event — context for the room, and what the expiry is
   *  derived from. Null for an evergreen invite code. */
  event_date: string | null;
  /** Derived: 60 days past event_date; null when there's no date */
  expires_at: string | null;
  /** Set when a steward archives a finished event; archived codes are off */
  archived_at: string | null;
  /** The studio the event lives in — joiners are seated in it outright,
   *  gated or not, and the invite link opens that studio's doorway */
  studio_slug: string | null;
  studio_label: string | null;
  created_by: string;
  created_at: string;
  /** Profiles carrying this code — people who joined AND signed in */
  joined: number;
}

/** A builder whose invites have brought people in — typed codes and project
 *  invitations both land on referred_by_code, so one count covers both. */
export interface ReferralStat {
  code: string;
  name: string | null;
  email: string;
  joined: number;
}

/**
 * The link to put on a slide or a QR code — same ?ref= door as personal
 * codes. A studio on the code adds its ?studio= doorway too, so the landing
 * shows the studio they're joining and the frame is active before sign-in;
 * the server seats them in it regardless (the code alone vouches).
 */
export function eventInviteLink(code: string | EventCode): string {
  const base =
    (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ||
    window.location.origin;
  const ref = typeof code === 'string' ? code : code.code;
  const studio = typeof code === 'string' ? null : code.studio_slug;
  return (
    `${base}/?ref=${encodeURIComponent(ref)}` +
    (studio ? `&studio=${encodeURIComponent(studio)}` : '')
  );
}

export async function adminListEventCodes(): Promise<EventCode[]> {
  const result = await adminCall({ action: 'event_code_list' });
  return (result.event_codes as EventCode[]) ?? [];
}

export async function adminCreateEventCode(input: {
  name: string;
  /** Optional hand-picked code (3–12 letters/digits); omit to auto-generate */
  code?: string;
  /** Optional event day (YYYY-MM-DD) — the code stays open 60 days past it */
  eventDate?: string;
  /** Optional studio the event lives in — every joiner becomes a member */
  studioSlug?: string;
  studioLabel?: string;
}): Promise<EventCode> {
  const result = await adminCall({
    action: 'event_code_create',
    name: input.name,
    ...(input.code?.trim() ? { code: input.code.trim() } : {}),
    ...(input.eventDate ? { event_date: input.eventDate } : {}),
    ...(input.studioSlug
      ? { studio_slug: input.studioSlug, studio_label: input.studioLabel ?? input.studioSlug }
      : {}),
  });
  return result.event_code as EventCode;
}

export async function adminSetEventCodeActive(code: string, active: boolean): Promise<void> {
  await adminCall({ action: 'event_code_set', code, active });
}

/** Archive a finished event (turns the code off too), or bring it back */
export async function adminSetEventCodeArchived(code: string, archived: boolean): Promise<void> {
  await adminCall({ action: 'event_code_set', code, archived });
}

/** Change or clear the event's day; the expiry follows (60 days past it) */
export async function adminSetEventCodeDate(code: string, eventDate: string | null): Promise<void> {
  await adminCall({ action: 'event_code_set', code, event_date: eventDate });
}

export async function adminReferralStats(): Promise<ReferralStat[]> {
  const result = await adminCall({ action: 'referral_stats' });
  return (result.stats as ReferralStat[]) ?? [];
}
