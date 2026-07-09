import { useState, type ReactNode } from 'react';
import { RBMark } from './RBMark';
import { LANDING_COLORS as C } from './Landing';
import { sendContactMessage } from '@/cloud/contact';
import { MailCheck } from 'lucide-react';

/**
 * The landing's companion pages — Privacy & Terms and Contact — reachable at
 * #privacy and #contact from the landing footer (and shareable as links).
 * Same warm paper palette as the landing; modeled on the Studio's pages so
 * the network speaks with one voice.
 */

function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="min-h-dvh overflow-y-auto"
      style={{ background: C.bg, color: C.ink, fontFamily: "'Inter Variable', system-ui, sans-serif" }}
    >
      <div className="max-w-2xl mx-auto px-6 py-12 sm:py-16 space-y-8">
        <div className="space-y-5">
          <a
            href="#"
            onClick={() => {
              // Clear the hash cleanly so the landing (or app) takes back over
              history.replaceState(null, '', window.location.pathname + window.location.search);
              window.dispatchEvent(new HashChangeEvent('hashchange'));
            }}
            className="inline-flex items-center gap-2 text-sm underline underline-offset-2 hover:opacity-80"
            style={{ color: C.body, textDecorationColor: C.border }}
          >
            <RBMark className="size-4" />
            Back to Relational Builder
          </a>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h1>
        </div>
        {children}
        <footer className="pt-4 text-center text-xs" style={{ color: C.muted }}>
          Made with care for neighbors everywhere
        </footer>
      </div>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{heading}</h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: C.body }}>
        {children}
      </div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <PageShell title="Privacy & Terms">
      <p className="text-sm leading-relaxed" style={{ color: C.body }}>
        Relational Builder is part of the Relational Tech Project, a project of
        Raft Foundation, a NY, USA-based 501(c)(3) nonprofit with a mission to
        bring communities together to support neighbors in need through
        programs focused on collective care, community technology, movement
        infrastructure, and societal transformation.
      </p>

      <Section heading="🛠 What we collect (and why)">
        <p>
          We only collect the information you choose to share with us through
          this site. Specifically:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Account &amp; profile:</strong> your email, name,
            neighborhood, and what you're hoping to build, so we can welcome
            you in and support your building journey.
          </li>
          <li>
            <strong>Projects &amp; build conversations:</strong> the projects
            you save to your account — their files and the chats that shaped
            them — so your work follows you across devices and can sync with
            collaborators you invite.
          </li>
          <li>
            <strong>Library contributions:</strong> prompts, tools, and stories
            you choose to share to the commons, so others can learn and build
            alongside you — credited to you.
          </li>
          <li>
            <strong>Connections:</strong> only if you opt in — the directory
            note and calendar link you choose to show other builders. Intro
            requests are double-opt-in, and your email is never shown.
          </li>
          <li>
            <strong>Messages:</strong> anything you send through the contact
            form, so a real person can reply.
          </li>
        </ul>
        <p>
          When you build, your messages and project files are sent to the AI
          model that generates the code — the community-hosted model, or a
          provider you connect with your own key. That's what makes the
          building work, and nothing more is done with it.
        </p>
        <p>We use this information only for the purposes you'd expect.</p>
        <p>We do not sell or share your data.</p>
        <p>We do not use tracking cookies.</p>
        <p>You can ask us to delete your information at any time.</p>
        <p>This site is intended for people age 14 and older.</p>
      </Section>

      <Section heading="🤝 Your rights">
        <p>
          You can contact us anytime at{' '}
          <a href="mailto:humans@relationaltechproject.org" className="underline underline-offset-2" style={{ color: C.orangeDeep }}>
            humans@relationaltechproject.org
          </a>{' '}
          to:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>See what information we have about you</li>
          <li>Request a copy or deletion of your data</li>
          <li>Share feedback or concerns</li>
          <li>Start a conversation</li>
        </ul>
        <p>We'll listen.</p>
      </Section>

      <Section heading="📜 Terms of use">
        <p>
          Please use this site with care and respect — for yourself, for
          others, and for the shared spaces we're co-creating.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            You're responsible for your own actions when participating through
            this site or at related gatherings — including what you build and
            publish with it.
          </li>
          <li>We don't endorse user content or take responsibility for how people act.</li>
          <li>
            We accept no liability for what happens online or offline in
            spaces related to this site. However, we do offer support for
            repair — please reach out.
          </li>
          <li>While this project operates all across the USA, disputes are subject to NY laws.</li>
        </ul>
        <p>
          You own what you build here. The Builder itself is open source under
          MIT. We may update these terms, but we'll always keep them clear,
          simple, and human.
        </p>
      </Section>

      <Section heading="💛 Community care & repair">
        <p>
          Relational work can get messy. Misunderstandings happen. We believe
          in slowing down, listening, and trying again. If something needs care
          or repair, we're here to help hold that process — with respect for
          all involved.
        </p>
      </Section>
    </PageShell>
  );
}

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendContactMessage({ name, email, neighborhood, message });
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
    <PageShell title="Contact">
      <p className="text-sm leading-relaxed" style={{ color: C.body }}>
        Have a question or an idea? Tell us what's on your mind — a real person
        reads everything here. We reply from{' '}
        <a href="mailto:humans@relationaltechproject.org" className="underline underline-offset-2" style={{ color: C.orangeDeep }}>
          humans@relationaltechproject.org
        </a>
        .
      </p>

      {sent ? (
        <div
          className="rounded-2xl border p-8 space-y-2 text-center"
          style={{ borderColor: C.border, background: C.card }}
        >
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <MailCheck className="size-4" style={{ color: C.green }} />
            Message sent
          </div>
          <p className="text-sm leading-relaxed" style={{ color: C.body }}>
            Thank you for writing. {email.trim() ? 'We’ll reply to you soon.' : 'If you’d like a reply, send another note with your email.'}
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl border p-6 sm:p-8 space-y-2.5"
          style={{ borderColor: C.border, background: C.card }}
        >
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className={inputClass} />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (so we can reply)" className={inputClass} />
          <input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Your neighborhood or place (optional)" className={inputClass} />
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Message"
            rows={5}
            className={`${inputClass} resize-none`}
          />
          {error && <p className="text-xs text-center" style={{ color: C.orangeDeep }}>{error}</p>}
          <button
            onClick={submit}
            disabled={busy || !message.trim()}
            className="w-full rounded-lg bg-[#D2764B] text-[#FAFAF9] px-4 py-2 text-sm font-medium hover:bg-[#C4693F] disabled:opacity-40 transition-colors"
          >
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      )}
    </PageShell>
  );
}
