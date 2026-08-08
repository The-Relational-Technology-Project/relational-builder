import { useState, type ReactNode } from 'react';
import { RBMark } from '@/components/RBMark';
import { LANDING_COLORS as C } from '@/components/Landing';
import {
  Ticket,
  Printer,
  HeartHandshake,
  Presentation,
  LayoutGrid,
  Sparkles,
  Users,
  MessagesSquare,
  Layers,
  Library,
  ShieldCheck,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/**
 * /buildathon — the public page for event partners: how a build-a-thon runs
 * on Relational Builder, from the room key at the door to the demo wall at
 * closing. A companion to the landing (same palette, its own address),
 * reachable signed in or out — Landing routes here before the app gate.
 */

const JOIN_HREF = '/#join';

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-[11px] font-bold uppercase tracking-[0.18em]"
      style={{ color: C.orangeDeep }}
    >
      {children}
    </p>
  );
}

function Shot({ src, alt, caption, className }: { src: string; alt: string; caption?: string; className?: string }) {
  return (
    <figure className={className}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full rounded-xl border shadow-sm"
        style={{ borderColor: C.border, boxShadow: '0 10px 34px rgba(42,31,24,.09)' }}
      />
      {caption && (
        <figcaption className="mt-2 text-xs leading-relaxed" style={{ color: C.muted }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function WhyCard({ icon: Icon, title, children }: { icon: typeof Users; title: string; children: ReactNode }) {
  return (
    <div
      className="rounded-xl border p-4 text-left"
      style={{ borderColor: C.border, background: C.card }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="size-4 shrink-0" style={{ color: C.orangeDeep }} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-[13px] leading-relaxed" style={{ color: C.body }}>
        {children}
      </p>
    </div>
  );
}

/** The three Share Live slides, clickable the way the real deck is */
function DeckPreview() {
  const [i, setI] = useState(0);
  const slides = [
    { src: '/media/deck-1.webp', alt: 'Deck slide: project title and one-liner' },
    { src: '/media/deck-2.webp', alt: 'Deck slide: screenshot and main features' },
    { src: '/media/deck-3.webp', alt: 'Deck slide: QR code the audience scans' },
  ];
  return (
    <div>
      <button
        onClick={() => setI(v => (v + 1) % slides.length)}
        className="block w-full cursor-pointer rounded-xl border overflow-hidden transition-transform hover:scale-[1.005] focus-visible:outline-none focus-visible:ring-2"
        style={{ borderColor: C.border, boxShadow: '0 10px 34px rgba(42,31,24,.09)' }}
        aria-label="Advance to the next slide"
      >
        <img src={slides[i].src} alt={slides[i].alt} className="w-full block" />
      </button>
      <div className="mt-2.5 flex items-center justify-center gap-3">
        <button
          onClick={() => setI(v => (v + slides.length - 1) % slides.length)}
          aria-label="Previous slide"
          className="rounded-full border p-1"
          style={{ borderColor: C.border, color: C.muted }}
        >
          <ChevronLeft className="size-3.5" />
        </button>
        {slides.map((_, k) => (
          <button
            key={k}
            onClick={() => setI(k)}
            aria-label={`Slide ${k + 1}`}
            className="size-2 rounded-full transition-colors"
            style={{ background: k === i ? C.orangeDeep : C.border }}
          />
        ))}
        <button
          onClick={() => setI(v => (v + 1) % slides.length)}
          aria-label="Next slide"
          className="rounded-full border p-1"
          style={{ borderColor: C.border, color: C.muted }}
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
      <p className="mt-1.5 text-center text-xs" style={{ color: C.muted }}>
        Click through — these are the actual three slides Share Live generates.
      </p>
    </div>
  );
}

function Moment({
  n,
  icon: Icon,
  title,
  children,
}: {
  n: string;
  icon: typeof Ticket;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{ background: C.orangeDeep, color: '#FFF6EE' }}
        >
          {n}
        </span>
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Icon className="size-4.5" style={{ color: C.orangeDeep }} />
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export function BuildathonPage() {
  return (
    <div
      className="min-h-dvh overflow-y-auto"
      style={{ background: C.bg, color: C.ink, fontFamily: "'Inter Variable', system-ui, sans-serif" }}
    >
      {/* Slim header: the way home, and the way in */}
      <header
        className="sticky top-0 z-10 border-b backdrop-blur"
        style={{ borderColor: C.border, background: 'rgba(250,247,242,.92)' }}
      >
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-3">
          <a href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <RBMark className="size-5" />
            <span className="text-sm font-semibold tracking-tight">Relational Builder</span>
          </a>
          <nav className="ml-auto flex items-center gap-4 text-sm">
            <a href="/" className="hover:underline underline-offset-4" style={{ color: C.body }}>
              Home
            </a>
            <a
              href={JOIN_HREF}
              className="rounded-full px-4 py-1.5 text-xs font-semibold"
              style={{ background: C.orangeDeep, color: '#FFF6EE' }}
            >
              Get an account
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16 space-y-16">
        {/* Hero */}
        <header className="space-y-4 text-center">
          <Kicker>For build-a-thons &amp; group build days</Kicker>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-tight">
            A room full of neighbors.
            <br />
            An afternoon of working tools.
          </h1>
          <p className="mx-auto max-w-xl text-base sm:text-lg leading-relaxed" style={{ color: C.body }}>
            Relational Builder takes ~100 people — solo builders and small
            groups — from “here's what our block needs” to live, demoable,
            shareable community tools in a single event. Here's the whole arc,
            door to demo.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <a
              href="mailto:josh@relationaltechproject.org?subject=Build-a-thon%20with%20Relational%20Builder"
              className="rounded-full px-5 py-2 text-sm font-semibold"
              style={{ background: C.orangeDeep, color: '#FFF6EE' }}
            >
              Plan one with us
            </a>
            <a
              href={JOIN_HREF}
              className="rounded-full border px-5 py-2 text-sm font-semibold"
              style={{ borderColor: C.border, color: C.body, background: C.card }}
            >
              Get a builder account
            </a>
          </div>
        </header>

        <Shot
          src="/media/workspace.webp"
          alt="The Relational Builder workspace: a conversation on the left building a block party app shown live on the right"
          caption="The whole toolchain is a conversation: describe the change on the left, watch the app become real on the right. The dashed card is Relational Builder noticing that someone three tables over is building something adjacent — more on that below."
        />

        {/* Why it runs well */}
        <section className="space-y-5">
          <div className="text-center space-y-2">
            <Kicker>Why it runs well in a room</Kicker>
            <h2 className="text-2xl font-semibold tracking-tight">Built for exactly this</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <WhyCard icon={Sparkles} title="Free to build, host, and run">
              Community-hosted AI — no API keys, no credit cards. Live sites and
              real app backends (data, sign-ups, email) are included, so nothing
              built at the event dies at the door.
            </WhyCard>
            <WhyCard icon={Users} title="Low barrier to entry">
              The whole tool is a browser tab; sign-in is a magic link. First-time
              builders and experienced tinkerers work side by side.
            </WhyCard>
            <WhyCard icon={MessagesSquare} title="Natural language, all the way">
              “Neighbors should claim a dish or a setup shift” is a valid build
              instruction. The live preview updates as you talk.
            </WhyCard>
            <WhyCard icon={Layers} title="Many kinds of output">
              Working apps, simple tools, printable flyers, program plans, project
              stories — whatever the idea needs, often all from one conversation.
            </WhyCard>
            <WhyCard icon={Library} title="Starts from the commons">
              Builds begin from tools, prompts, and recipes shared by other
              neighborhoods — not a blank page — and finished work can be offered
              back for the next room.
            </WhyCard>
            <WhyCard icon={ShieldCheck} title="Stewarded and consent-first">
              Event codes switch off in one click. Connections are opt-in with
              double-opt-in introductions. A real person tends the door.
            </WhyCard>
          </div>
        </section>

        {/* The day, hour by hour */}
        <div className="space-y-14">
          <div className="text-center space-y-2">
            <Kicker>The day, hour by hour</Kicker>
            <h2 className="text-2xl font-semibold tracking-tight">Door to demo</h2>
          </div>

          <Moment n="1" icon={Printer} title="Welcome — the room lets itself in">
            <div className="grid items-center gap-6 sm:grid-cols-2">
              <div className="space-y-3 text-[15px] leading-relaxed" style={{ color: C.body }}>
                <p>
                  Every event gets its own <strong style={{ color: C.ink }}>event code</strong> — a
                  room key. Put its printable page on the projector or the door:
                  people scan the QR, request an account with the code already
                  filled in, and are approved <em>on the spot</em>. No waiting, no
                  walk-in bottleneck, no pre-registration spreadsheet.
                </p>
                <p>
                  Everyone who joins is tagged as a participant, so the day's
                  numbers take care of themselves — organizers watch the live
                  head-count per code, and the code switches off the moment the
                  event wraps.
                </p>
              </div>
              <Shot
                src="/media/room-key.webp"
                alt="Printable room key: event name, large QR code, and the code OAKBUILD in large letters"
                caption="The room key — one click to print, from the event's dashboard."
              />
            </div>
          </Moment>

          <Moment n="2" icon={HeartHandshake} title="Building — the room finds itself">
            <div className="space-y-3 text-[15px] leading-relaxed" style={{ color: C.body }}>
              <p>
                Groups need nothing special: one person starts, invites teammates
                by email, and invited collaborators walk straight in — the
                invitation is the vouch. And while people build, Relational
                Builder quietly does the most build-a-thon thing it can do:
                <strong style={{ color: C.ink }}> it points people at each other</strong>. When
                someone at your event is building something adjacent to yours, a
                card appears right in the chat — <em>“Marisol is at your event —
                go find them”</em> — while you can still walk over. Opt-in only,
                dismissible forever, introductions double-opt-in.
              </p>
            </div>
          </Moment>

          <Moment n="3" icon={Presentation} title="Demo hour — every project gets its moment">
            <div className="space-y-4">
              <p className="text-[15px] leading-relaxed" style={{ color: C.body }}>
                One click on <strong style={{ color: C.ink }}>Share Live</strong> turns any build
                into a three-slide projector deck: the title and one-liner
                (drafted by the AI from the build itself, editable), a screenshot
                with what it does, and a QR code the whole audience scans to open
                the <em>working app</em> on their phones — no install, no signup.
                Ninety seconds per project, and the room isn't watching a demo,
                it's using one.
              </p>
              <DeckPreview />
            </div>
          </Moment>

          <Moment n="4" icon={LayoutGrid} title="Closing — what the room built">
            <div className="space-y-4">
              <p className="text-[15px] leading-relaxed" style={{ color: C.body }}>
                Each deck can be pinned to the event's{' '}
                <strong style={{ color: C.ink }}>demo wall</strong> — a public gallery section
                with every project's screenshot, one-liner, slides, and live
                link. It's the closing-circle projector view, and the “here's
                what happened” link you share afterward. Apps worth keeping
                publish permanently, free; stories and tools flow back to the
                commons for the next neighborhood.
              </p>
              <Shot
                src="/media/demo-wall.webp"
                alt="The event demo wall: project cards with screenshots, one-liners, and links to slides and live apps"
                caption="The demo wall in the Commons Gallery. It tidies itself — entries fade as the event's links lapse."
              />
            </div>
          </Moment>
        </div>

        {/* CTA */}
        <section
          className="rounded-2xl border p-8 text-center space-y-4"
          style={{ borderColor: C.border, background: C.card }}
        >
          <h2 className="text-xl font-semibold tracking-tight">Planning a build-a-thon?</h2>
          <p className="mx-auto max-w-lg text-sm leading-relaxed" style={{ color: C.body }}>
            We'll mint your event code together, walk through the room key and
            demo flow, and shape the day around your community — whether it's
            twelve neighbors in a library or a hundred people in a hall.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="mailto:josh@relationaltechproject.org?subject=Build-a-thon%20with%20Relational%20Builder"
              className="rounded-full px-5 py-2 text-sm font-semibold"
              style={{ background: C.orangeDeep, color: '#FFF6EE' }}
            >
              Plan one with us
            </a>
            <a
              href={JOIN_HREF}
              className="inline-flex items-center gap-1.5 rounded-full border px-5 py-2 text-sm font-semibold"
              style={{ borderColor: C.border, color: C.body }}
            >
              Get a builder account <ArrowRight className="size-3.5" />
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="pb-4 text-center text-xs space-y-2" style={{ color: C.muted }}>
          <p>
            The tools here serve presence — knowing your neighbors, listening
            well, showing up — never replace it.
          </p>
          <p>
            <a href="/" className="underline underline-offset-2">Home</a>
            {' '}·{' '}
            <a href="/#privacy" className="underline underline-offset-2">Privacy &amp; Terms</a>
            {' '}·{' '}
            <a href="/#contact" className="underline underline-offset-2">Contact</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
