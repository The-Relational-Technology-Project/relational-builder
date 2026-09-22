import { builderClient } from '@/cloud/builder-client';

/**
 * The Event Admin's side of a build-a-thon — what a host can do from the
 * room without a steward. Every call is a security-definer function that
 * checks is_event_admin() first; this module is just the typed surface.
 * Stewards name admins by email on the Codes tab (event-codes.ts).
 */

export interface AdminEvent {
  code: string;
  name: string;
  active: boolean;
  event_date: string | null;
  expires_at: string | null;
  archived_at: string | null;
  studio_slug: string | null;
  studio_label: string | null;
  joined: number;
}

export interface EventParticipant {
  id: string;
  email: string;
  display_name: string | null;
  full_name: string | null;
  neighborhood: string | null;
  joined_at: string;
}

function needClient() {
  if (!builderClient) throw new Error('Cloud backend not configured');
  return builderClient;
}

/** The events this signed-in builder administers — empty for most people */
export async function fetchMyAdminEvents(): Promise<AdminEvent[]> {
  if (!builderClient) return [];
  const { data, error } = await builderClient.rpc('my_admin_events');
  if (error) return [];
  return ((data as Array<Record<string, unknown>>) ?? []).map(r => ({
    code: String(r.code),
    name: String(r.name),
    active: r.active === true,
    event_date: r.event_date ? String(r.event_date) : null,
    expires_at: r.expires_at ? String(r.expires_at) : null,
    archived_at: r.archived_at ? String(r.archived_at) : null,
    studio_slug: r.studio_slug ? String(r.studio_slug) : null,
    studio_label: r.studio_label ? String(r.studio_label) : null,
    joined: Number(r.joined ?? 0),
  }));
}

export async function fetchEventParticipants(code: string): Promise<EventParticipant[]> {
  const { data, error } = await needClient().rpc('event_participants', { p_code: code });
  if (error) throw new Error(error.message);
  return (data as EventParticipant[]) ?? [];
}

/** False means no account carries that address yet — send them the room key */
export async function addEventParticipant(code: string, email: string): Promise<boolean> {
  const { data, error } = await needClient().rpc('event_add_participant', { p_code: code, p_email: email });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function removeEventParticipant(code: string, userId: string): Promise<void> {
  const { error } = await needClient().rpc('event_remove_participant', { p_code: code, p_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function setEventActive(code: string, active: boolean): Promise<void> {
  const { error } = await needClient().rpc('event_set_active', { p_code: code, p_active: active });
  if (error) throw new Error(error.message);
}
