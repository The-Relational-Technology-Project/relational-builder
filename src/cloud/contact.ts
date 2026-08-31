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
  topic?: 'budget-feedback';
}): Promise<void> {
  const res = await fetch(`${FUNCTIONS_URL}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not send your message');
}

/**
 * A note to the team from someone who hit the daily building budget. Their
 * email rides along only when they opted in — budget sizing feedback is
 * welcome anonymously too.
 */
export async function sendBudgetFeedback(input: {
  message: string;
  email?: string;
}): Promise<void> {
  return sendContactMessage({ ...input, topic: 'budget-feedback' });
}
