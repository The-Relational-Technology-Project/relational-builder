import { builderClient } from '@/cloud/builder-client';

/**
 * Client for the connect edge function — the Builder's relational layer.
 * Directory of opted-in builders (never exposes emails) + double-opt-in
 * connection requests.
 */

export interface DirectoryBuilder {
  id: string;
  name: string;
  neighborhood: string | null;
  note: string | null;
  cal_link: string | null;
  allow_requests: boolean;
}

async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!builderClient) throw new Error('Cloud backend not configured');
  const { data } = await builderClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first');
  const url = import.meta.env.VITE_BUILDER_SUPABASE_URL;
  const res = await fetch(`${url}/functions/v1/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((result as { error?: string }).error ?? `Request failed (${res.status})`);
  return result as Record<string, unknown>;
}

export async function fetchDirectory(): Promise<DirectoryBuilder[]> {
  const result = await call({ action: 'directory' });
  return (result.builders as DirectoryBuilder[]) ?? [];
}

export async function requestConnection(toId: string, message: string): Promise<void> {
  await call({ action: 'request', to_id: toId, message });
}
