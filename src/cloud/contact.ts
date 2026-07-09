/**
 * Contact form client — no account needed (that's the point). The message
 * lands in contact_messages via the contact edge function, with an email
 * copy to the steward.
 */

const FUNCTIONS_URL = `${import.meta.env.VITE_BUILDER_SUPABASE_URL ?? ''}/functions/v1`;

export async function sendContactMessage(input: {
  name?: string;
  email?: string;
  neighborhood?: string;
  message: string;
}): Promise<void> {
  const res = await fetch(`${FUNCTIONS_URL}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not send your message');
}
