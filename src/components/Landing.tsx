import { useEffect, useState, type ReactNode } from 'react';
import { RBMark } from './RBMark';
import { requestAccount, type RequestResult } from '@/cloud/account-requests';
import { getPendingInvite } from '@/cloud/invite-link';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useStudioStore } from '@/store/studio-store';
import { DEFAULT_STUDIO_SLUG } from '@/knowledge/studio-context';
import { MailCheck, Plus, Minus } from 'lucide-react';
import { PrivacyPage, ContactPage } from './LandingPages';

const ENTERED_KEY = 'rb-entered';

/**
 * Public landing page. Invitation passcodes are fully retired: the front
 * door is "request an account" (a steward approves each one; sign-in is a
 * magic link), and signed-in members walk straight in. A stale ?code= link
 * from an old invite or event QR is scrubbed from the address bar and lands
 * here like everyone else.
 * Warm light palette drawn from the brand mark, independent of the app's
 * light/dark theme. Copy stays short — the door matters more than the tour.
 */

/** Old invite links carried ?code=X — drop the spent param quietly */
function scrubCodeParam(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('code') === null) return;
  params.delete('code');
  const qs = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
}

const REF_KEY = 'rb-referral-code';

/**
 * A builder's invite link carries ?ref=CODE. Stash the code (sessionStorage —
 * it should survive the sign-in round-trip in this tab, not follow the
 * browser forever) and clean the address bar; the request form below picks
 * it up. The server re-validates, so this is a convenience, not a grant.
 */
function captureRefParam(): void {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref === null) return;
  if (ref.trim()) sessionStorage.setItem(REF_KEY, ref.trim());
  params.delete('ref');
  const qs = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
}

// Brand palette on warm paper — shared with the landing's companion pages
// (Privacy & Terms, Contact) in LandingPages.tsx
export const LANDING_COLORS = {
  bg: '#FAF7F2',
  ink: '#261e18',
  body: '#4A4038',
  muted: '#8A7D71',
  border: '#E5DCD0',
  card: '#FFFFFF',
  orange: '#D2764B',
  orangeDeep: '#C4693F',
  green: '#3D8B6D',
  yellow: '#E8B84E',
};
const C = LANDING_COLORS;

/** #privacy / #contact are shareable page links; anything else (e.g. a magic
 *  link's #access_token) passes through untouched */
function getHashPage(): 'privacy' | 'contact' | null {
  const hash = window.location.hash.replace(/^#/, '');
  return hash === 'privacy' || hash === 'contact' ? hash : null;
}

export function Landing({ children }: { children: ReactNode }) {
  const user = useAuthStore(s => s.user);
  const [granted, setGranted] = useState(() => {
    scrubCodeParam();
    captureRefParam();
    // Someone arriving on an invite link was sent here by a person, not by
    // the marketing page — walk them through to the app shell, where the
    // invite banner and a prefilled sign-in are waiting.
    if (getPendingInvite()) return true;
    return localStorage.getItem(ENTERED_KEY) === '1';
  });
  const [hashPage, setHashPage] = useState(getHashPage);

  // App (which normally inits auth) is gated below, so init here too — that
  // way a magic-link redirect landing on this page still gets its session
  // detected. init() guards against running twice, so App's call is a no-op.
  useEffect(() => {
    useAuthStore.getState().init();
    const onHash = () => setHashPage(getHashPage());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Privacy & Terms and Contact are public pages, linkable whether or not
  // you're signed in — they win over both the landing and the app
  if (hashPage === 'privacy') return <PrivacyPage />;
  if (hashPage === 'contact') return <ContactPage />;

  // A signed-in builder is always through the door: after signing in from the
  // panel below, the magic-link redirect returns here and walks them straight in.
  if (granted || user) return <>{children}</>;

  return <LandingPage onUnlock={() => setGranted(true)} />;
}

function LandingPage({ onUnlock }: { onUnlock: () => void }) {
  function enter() {
    localStorage.setItem(ENTERED_KEY, '1');
    onUnlock();
  }

  return (
    <div
      className="min-h-dvh overflow-y-auto"
      style={{ background: C.bg, color: C.ink, fontFamily: "'Inter Variable', system-ui, sans-serif" }}
    >
      <div className="max-w-2xl mx-auto px-6 py-14 sm:py-20 space-y-12">

        {/* Hero */}
        <header className="space-y-5 text-center">
          <RBMark className="size-14 mx-auto" />
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
              Relational Builder
            </h1>
            <p className="text-lg sm:text-xl leading-relaxed" style={{ color: C.body }}>
              Build tools for your neighborhood,<br className="sm:hidden" /> with your neighborhood.
            </p>
          </div>
          <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: C.muted }}>
            Describe what your community needs in plain language and shape it
            together — a working tool, a program plan, printable flyers, or all
            three — starting from the commons of the{' '}
            <a href="https://relationaltechproject.org" className="underline underline-offset-2" style={{ textDecorationColor: C.border, color: C.body }}>
              Relational Technology Project
            </a>
            , not a blank slate.
          </p>
        </header>

        <div className="grid sm:grid-cols-3 gap-3">
          <ValueCard color={C.orange} title="Describe it">
            Say what your neighborhood needs — no code required.
          </ValueCard>
          <ValueCard color={C.green} title="Shape it together">
            Invite a neighbor in, watch the live preview, restore any version.
          </ValueCard>
          <ValueCard color={C.yellow} title="Offer it back">
            Publish it, then share it to the commons for the next neighborhood.
          </ValueCard>
        </div>

        {/* The front door */}
        <section
          className="rounded-2xl border p-8 space-y-5 text-center"
          style={{ borderColor: C.border, background: C.card }}
        >
          <h2 className="text-xl font-semibold">We're in a community pilot</h2>
          <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: C.body }}>
            Approved builders build free — no API keys, no credit card. Ask for
            an account and a real person will welcome you in, usually within a day.
          </p>
          <RequestAccountForm />
          <SignInPanel onEnter={enter} />
        </section>

        <SocialProof />

        <FAQ />

        {/* Footer */}
        <footer className="text-center space-y-2 text-xs" style={{ color: C.muted }}>
          <p>
            The tools here serve presence — knowing your neighbors, listening
            well, showing up — never replace it.
          </p>
          <p>
            Open source under MIT —{' '}
            <a
              href="https://github.com/The-Relational-Technology-Project/relational-builder"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:opacity-80"
            >
              read the code
            </a>
            {' '}· a project of{' '}
            <a href="https://relationaltechproject.org" className="underline underline-offset-2 hover:opacity-80">
              The Relational Technology Project
            </a>
          </p>
          <p>
            Made with care for neighbors everywhere ·{' '}
            <a href="#privacy" className="underline underline-offset-2 hover:opacity-80">
              Privacy &amp; Terms
            </a>
            {' '}·{' '}
            <a href="#contact" className="underline underline-offset-2 hover:opacity-80">
              Contact
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

/**
 * You're not building alone — the network behind the Builder, in the
 * Studio landing's voice: real builders, real places, a shared library.
 */
function SocialProof() {
  const places = [
    'Oakland, CA', 'Akron, OH', 'Palouse, WA', 'London, UK',
    'Lexington, KY', 'San Francisco, CA', 'Baltimore, MD', 'Detroit, MI',
  ];
  return (
    <section className="space-y-5 text-center">
      <h2 className="text-xl font-semibold">You're not building alone.</h2>
      <div className="grid sm:grid-cols-2 gap-3 max-w-lg mx-auto">
        <div className="rounded-xl border p-5 space-y-1" style={{ borderColor: C.border, background: C.card }}>
          <div className="text-3xl font-semibold" style={{ color: C.orangeDeep }}>300+</div>
          <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
            Builders in diverse neighborhoods around the world.
          </p>
        </div>
        <div className="rounded-xl border p-5 space-y-1" style={{ borderColor: C.border, background: C.card }}>
          <div className="text-3xl font-semibold" style={{ color: C.green }}>100s</div>
          <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
            Of tools, practices, and stories about relational tech.
          </p>
        </div>
      </div>
      <p className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>
        {places.join(' · ')}
      </p>
      <p className="text-xs max-w-md mx-auto leading-relaxed" style={{ color: C.muted }}>
        A locality-to-locality builder network. The Builder is free to use and
        stewarded by the Relational Tech Project, a nonprofit project. It's
        open source, with a roadmap toward community ownership of the tools
        and the infrastructure we use to build them.
      </p>
    </section>
  );
}

/** FAQs in the Studio landing's voice, tailored to the Builder */
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'What is relational tech?',
    a: 'Technology that helps us connect with and care for each other. Small software built by people for a place. Tools we can reuse and remix across our neighborhoods.',
  },
  {
    q: 'Do I need to know how to code?',
    a: "No. You describe what your place needs in plain language, and the Builder shapes it into a working tool with you — plan it in conversation, watch the live preview, publish when it's ready. You can also remix something a neighbor in another place already made. The skills that matter most here aren't technical. It's knowing your neighbors and paying attention to what your place is asking for.",
  },
  {
    q: 'What can I build?',
    a: 'Whatever your block actually needs — and not only software. The Commons Gallery holds three shelves to start from: relational tech tools built across the network, civic media recipes and real-project field examples from News Futures and the Civic Media Cookbook, and Neighboring Recipes for gathering, care, and connection. A build might be a working tool (a neighborhood digest, a lending library, a block-level hub), a program (a commons-informed plan for your newsletter, care web, or story circle), printable flyers to put up at the corner store — or all of these together. Everything is intentionally small and specific, so you and your neighbors spend more of your time meeting face-to-face.',
  },
  {
    q: 'Is it really free? How is this sustained?',
    a: "Yes — approved builders build free: no API keys, no credit card. The Builder is stewarded by the Relational Tech Project, a nonprofit project supported by contributors (including funders) who believe neighbors should be able to build what they need. There are no ads, and we don't sell your data. Free building runs on a shared community budget, and you can always bring your own model key too.",
  },
  {
    q: 'Who owns what I build?',
    a: "You own what you build. Every project can be exported as code, synced to your own repository — GitHub, GitLab, or a community-run forge — published to your own hosting, or distilled into a prompt you can take anywhere. The Builder itself is open-source under MIT (find the repo on GitHub). We also have a roadmap toward community stewardship of the Builder and other tools we're building.",
  },
  {
    q: 'Is it a good idea to use AI to advance human flourishing?',
    a: 'We think the best use case for AI is helping surface and implement community visions. AI helps handle what’s tedious about building, so we can spend more time out in the world with people. Vision, relationship-building, and being present in your community stay fully human. AI never defines what your neighborhood needs or speaks for you.',
  },
  {
    q: "What if I'm nervous about talking to my neighbors?",
    a: "You are not alone! Part of building relational tech with us is getting the chance to meet others who are also facing the messiness of building tech to meet the needs of where we live. It can feel scary, vulnerable, and high-risk/low-reward, and we find it's helpful to navigate these dynamics with others.",
  },
];

function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-center">FAQs</h2>
      <div className="rounded-2xl border divide-y" style={{ borderColor: C.border, background: C.card }}>
        {FAQ_ITEMS.map((item, i) => (
          <div key={item.q} style={{ borderColor: C.border }}>
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left text-sm font-medium hover:opacity-80 transition-opacity"
              aria-expanded={openIdx === i}
            >
              {item.q}
              {openIdx === i ? (
                <Minus className="size-4 shrink-0" style={{ color: C.muted }} />
              ) : (
                <Plus className="size-4 shrink-0" style={{ color: C.muted }} />
              )}
            </button>
            {openIdx === i && (
              <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: C.body }}>
                {item.a}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-center" style={{ color: C.muted }}>
        Have another question or idea?{' '}
        <a href="#contact" className="underline underline-offset-2 hover:opacity-80">
          Please reach out.
        </a>
      </p>
    </section>
  );
}

/** The open front door: ask, and a steward approves — then sign-in is just a magic link */
function RequestAccountForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  // An invite link's code arrives pre-filled but stays editable — a typo'd
  // or borrowed code is the person's to fix
  const [referralCode, setReferralCode] = useState(
    () => sessionStorage.getItem(REF_KEY)?.toUpperCase() ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<RequestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Arriving through a studio link (?studio=thread) makes this that studio's
  // doorway: the studio rides the request, and at first sign-in the request
  // to join it is filed automatically for the Studio Admins.
  const activeStudio = useStudioStore(s => s.activeStudio);
  const doorwayStudio =
    activeStudio && activeStudio.slug !== DEFAULT_STUDIO_SLUG ? activeStudio : null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await requestAccount({
        email,
        name,
        reason,
        referralCode,
        ...(doorwayStudio
          ? { studioSlug: doorwayStudio.slug, studioLabel: doorwayStudio.label }
          : {}),
      });
      // A referred builder is in already — send the sign-in link in the same
      // motion, so the email that arrives is both confirmation and the door
      if (result.status === 'approved') {
        sessionStorage.removeItem(REF_KEY);
        await useAuthStore.getState().signIn(email.trim());
      }
      setOutcome(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your request');
    } finally {
      setBusy(false);
    }
  }

  if (outcome?.status === 'approved') {
    return (
      <div className="max-w-sm mx-auto space-y-2">
        <div className="flex items-center justify-center gap-2 text-sm font-medium">
          <MailCheck className="size-4" style={{ color: C.green }} />
          You're in — welcome!
        </div>
        <p className="text-xs leading-relaxed" style={{ color: C.body }}>
          Your invite code checked out, so there's no waiting for approval. We
          sent a sign-in link to <strong>{email}</strong> — tap it, or type the
          6-digit code from that email here.
        </p>
        <CodeEntry email={email} />
      </div>
    );
  }
  if (outcome?.status === 'pending') {
    return (
      <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: C.body }}>
        {outcome.referral === 'unknown' &&
          'That invite code didn’t match a builder, so your request went to the steward the usual way. '}
        Request sent — thank you! A real person reviews every request; you'll
        get a welcome email as soon as yours is approved.
        {doorwayStudio &&
          ` Your request to join ${doorwayStudio.label} will be waiting for its stewards the first time you sign in.`}
      </p>
    );
  }
  if (outcome?.status === 'already-member') {
    return (
      <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: C.body }}>
        Good news — this email is already approved. Come on in below and sign
        in with it.
      </p>
    );
  }

  // text-base on mobile: iOS Safari zooms the whole page when focusing an
  // input under 16px, and it stays zoomed — cutting off the layout
  const inputClass =
    'w-full rounded-lg border px-3 py-2 text-base sm:text-sm outline-none placeholder:text-[#8A7D71] border-[#E5DCD0] bg-[#FAF7F2] focus:border-[#D2764B]';

  return (
    <div className="max-w-sm mx-auto space-y-2 text-left">
      {doorwayStudio && (
        <p
          className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs"
          style={{ color: C.body, borderColor: '#E5DCD0' }}
        >
          <span
            className="size-2 rounded-full shrink-0"
            style={{ background: doorwayStudio.color ?? C.muted }}
          />
          You're joining through {doorwayStudio.label} — once you're in, its
          stewards will wave you into the studio too.
        </p>
      )}
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="you@example.org"
        className={inputClass}
      />
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Your name"
        className={inputClass}
      />
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="What are you hoping to build, and for which neighborhood or community?"
        rows={3}
        className={`${inputClass} resize-none`}
      />
      <input
        value={referralCode}
        onChange={e => setReferralCode(e.target.value.toUpperCase())}
        placeholder="Invite code (optional)"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className={inputClass}
      />
      <p className="text-xs" style={{ color: C.muted }}>
        {referralCode.trim()
          ? 'A builder’s invite code lets you skip the wait — your account opens the moment you ask.'
          : 'Got an invite code from a builder? It opens your account right away.'}
      </p>
      {error && <p className="text-xs text-center" style={{ color: C.orangeDeep }}>{error}</p>}
      <button
        onClick={submit}
        disabled={busy || !email.includes('@')}
        className="w-full rounded-lg bg-[#D2764B] text-[#FAFAF9] px-4 py-2 text-sm font-medium hover:bg-[#C4693F] disabled:opacity-40 transition-colors"
      >
        {busy ? 'Sending…' : 'Request an account'}
      </button>
    </div>
  );
}

/**
 * Existing builders sign in right here — a clear CTA, not a buried link. The
 * magic-link email form is the very next thing after "Sign in": send it and a
 * one-tap link arrives; the redirect lands the builder straight in the app
 * (Landing waves signed-in builders through). When cloud auth isn't configured
 * we fall back to the old "come on in" walk-through.
 */
function SignInPanel({ onEnter }: { onEnter: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!cloudEnabled) {
    return (
      <p className="text-sm" style={{ color: C.body }}>
        Already a builder?{' '}
        <button onClick={onEnter} className="font-medium underline underline-offset-2 hover:opacity-80" style={{ color: C.orangeDeep }}>
          Come on in
        </button>
      </p>
    );
  }

  async function submit() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    const { error: err } = await useAuthStore.getState().signIn(trimmed);
    setSending(false);
    if (err) setError(err);
    else setSent(true);
  }

  // min-w-0 lets the input shrink so the row never pushes "Send link" off
  // the screen; text-base on mobile stops iOS Safari's focus zoom
  const inputClass =
    'flex-1 min-w-0 rounded-lg border px-3 py-2 text-base sm:text-sm outline-none placeholder:text-[#8A7D71] border-[#E5DCD0] bg-[#FAF7F2] focus:border-[#D2764B]';

  return (
    <div className="pt-5 border-t space-y-3" style={{ borderColor: C.border }}>
      {sent ? (
        <div className="max-w-sm mx-auto space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <MailCheck className="size-4" style={{ color: C.green }} />
            Check your email
          </div>
          <p className="text-xs leading-relaxed" style={{ color: C.body }}>
            We sent a sign-in link to <strong>{email}</strong> — tap it, or type
            the 6-digit code from that email here. No password needed.
          </p>
          <CodeEntry email={email} />
        </div>
      ) : open ? (
        <div className="max-w-sm mx-auto space-y-2">
          <p className="text-sm" style={{ color: C.body }}>
            Welcome back — we'll email you a one-tap sign-in link.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="you@example.org"
              autoFocus
              className={inputClass}
            />
            <button
              onClick={submit}
              disabled={sending || !email.includes('@')}
              className="rounded-lg bg-[#D2764B] text-[#FAFAF9] px-4 py-2 text-sm font-medium hover:bg-[#C4693F] disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {sending ? 'Sending…' : 'Send link'}
            </button>
          </div>
          {error && <p className="text-xs text-center" style={{ color: C.orangeDeep }}>{error}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 text-sm">
          <span style={{ color: C.body }}>Already a builder?</span>
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg border px-4 py-1.5 font-medium hover:border-[#D2764B] transition-colors"
            style={{ borderColor: C.border, color: C.ink }}
          >
            Sign in
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The 6-digit code path: on phones the magic link often opens in the mail
 * app's own browser, stranding the session away from this tab. Typing the
 * code from the same email signs in right here, whatever browser this is.
 */
function CodeEntry({ email }: { email: string }) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    const trimmed = code.trim();
    if (trimmed.length < 6) return;
    setVerifying(true);
    setError(null);
    const { error: err } = await useAuthStore.getState().verifyCode(email, trimmed);
    setVerifying(false);
    // Success needs no handling — the session lands via onAuthStateChange and
    // Landing waves signed-in builders through
    if (err) setError(err);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={e => { setCode(e.target.value); setError(null); }}
          onKeyDown={e => e.key === 'Enter' && verify()}
          placeholder="6-digit code"
          className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-center tracking-[0.3em] text-base sm:text-sm outline-none placeholder:text-[#8A7D71] placeholder:tracking-normal border-[#E5DCD0] bg-[#FAF7F2] focus:border-[#D2764B]"
        />
        <button
          onClick={verify}
          disabled={verifying || code.trim().length < 6}
          className="rounded-lg bg-[#D2764B] text-[#FAFAF9] px-4 py-2 text-sm font-medium hover:bg-[#C4693F] disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {verifying ? 'Checking…' : 'Sign in'}
        </button>
      </div>
      {error && <p className="text-xs text-center" style={{ color: C.orangeDeep }}>{error}</p>}
    </div>
  );
}

function ValueCard({ color, title, children }: { color: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border p-4 space-y-1.5 text-left" style={{ borderColor: C.border, background: C.card }}>
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: C.muted }}>{children}</p>
    </div>
  );
}
