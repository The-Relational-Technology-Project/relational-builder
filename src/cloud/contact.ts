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
  topic?: 'budget-feedback' | 'buildathon' | 'studio';
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

/**
 * An inquiry from one of the public site pages — "Plan one with us" on
 * /buildathon, "Create your studio" on /studios. Same pipe as the contact
 * form; the topic sets the steward's subject line.
 */
export async function sendPageInquiry(input: {
  topic: 'buildathon' | 'studio';
  name?: string;
  email?: string;
  place?: string;
  message: string;
}): Promise<void> {
  const { place, ...rest } = input;
  return sendContactMessage({ ...rest, neighborhood: place });
}
