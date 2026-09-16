import { useState, type ReactNode } from 'react';
import { MailCheck } from 'lucide-react';
import { LANDING_COLORS as C } from '@/components/Landing';
import { sendPageInquiry } from '@/cloud/contact';

/**
 * The simple form at the bottom of the public site pages — "Plan one with
 * us" on /buildathon, "Create your studio" on /studios. Four fields, no
 * account, lands in the steward's inbox (josh@relationaltechproject.org)
 * through the contact function. The same shape on both pages so anyone who
 * has filled in one knows the other.
 */
export function InquiryForm({
  id,
  topic,
  title,
  intro,
  placePlaceholder,
  messagePlaceholder,
  submitLabel,
  sentNote,
  aside,
}: {
  id: string;
  topic: 'buildathon' | 'studio';
  title: string;
  intro: ReactNode;
  placePlaceholder: string;
  messagePlaceholder: string;
  submitLabel: string;
  sentNote: string;
  /** Secondary link(s) shown under the form, e.g. "Get a builder account" */
  aside?: ReactNode;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [place, setPlace] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = message.trim().length > 0 && email.trim().length > 0;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await sendPageInquiry({ topic, name, email, place, message });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your message');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border px-3 py-2 text-sm outline-none placeholder:text-[#8A7D71] border-[#E5DCD0] bg-[#FFFFFF] focus:border-[#D2764B]';

  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-2xl border p-6 sm:p-8 space-y-5"
      style={{ borderColor: C.border, background: C.card }}
    >
      <div className="text-center space-y-2">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mx-auto max-w-lg text-sm leading-relaxed" style={{ color: C.body }}>
          {intro}
        </p>
      </div>

      {sent ? (
        <div
          className="rounded-xl border p-6 space-y-2 text-center"
          style={{ borderColor: C.border, background: C.bg }}
        >
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <MailCheck className="size-4" style={{ color: C.green }} />
            Sent
          </div>
          <p className="text-sm leading-relaxed" style={{ color: C.body }}>
            {sentNote}
          </p>
        </div>
      ) : (
        <form
          className="mx-auto max-w-xl space-y-2.5"
          onSubmit={e => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className={inputClass}
            />
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email (so we can reply)"
              autoComplete="email"
              className={inputClass}
            />
          </div>
          <input
            value={place}
            onChange={e => setPlace(e.target.value)}
            placeholder={placePlaceholder}
            className={inputClass}
          />
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={messagePlaceholder}
            rows={5}
            required
            className={`${inputClass} resize-none`}
          />
          {error && (
            <p className="text-xs text-center" style={{ color: C.orangeDeep }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !ready}
            className="w-full rounded-full bg-[#C4693F] text-[#FFF6EE] px-4 py-2.5 text-sm font-semibold hover:bg-[#B55E36] disabled:opacity-40 transition-colors"
          >
            {busy ? 'Sending…' : submitLabel}
          </button>
          <p className="text-center text-xs" style={{ color: C.muted }}>
            Goes straight to Josh at the Relational Tech Project. A real person replies.
          </p>
        </form>
      )}

      {aside && <div className="flex flex-wrap items-center justify-center gap-3 pt-1">{aside}</div>}
    </section>
  );
}
