import { useState, type ReactNode } from 'react';
import { RBMark } from '@/components/RBMark';
import { LANDING_COLORS as C } from '@/components/Landing';
import { InquiryForm } from '@/components/InquiryForm';
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
  DoorOpen,
  Hammer,
  Home,
  Map,
  Landmark,
  Building2,
} from 'lucide-react';

/**
 * /buildathon — the public page for event partners: why the build-a-thon is
 * back (anyone can contribute; working tools, built together), how one runs
 * on Relational Builder from the room key at the door to the demo wall at
 * closing, who might convene one, and a form to plan one with us. A
 * companion to the landing (same palette, its own address), reachable
 * signed in or out — Landing routes here before the app gate.
 */

const JOIN_HREF = '/#join';
const PLAN_HREF = '#plan';

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

/** One of the two shifts from the hackathon model */
function Shift({ icon: Icon, from, to, children }: { icon: typeof Users; from: string; to: string; children: ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-5 sm:p-6 space-y-3"
      style={{ borderColor: C.border, background: C.card }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: '#FBEFE6' }}
        >
          <Icon className="size-4.5" style={{ color: C.orangeDeep }} />
        </span>
        <div className="text-sm leading-tight">
          <span className="line-through decoration-1" style={{ color: C.muted }}>{from}</span>
          <br />
          <span className="font-semibold" style={{ color: C.ink }}>{to}</span>
        </div>
      </div>
      <p className="text-[15px] leading-relaxed" style={{ color: C.body }}>
        {children}
      </p>
    </div>
  );
}

/** A picture of who might convene one */
function Scenario({ icon: Icon, who, children }: { icon: typeof Home; who: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 rounded-2xl border p-5" style={{ borderColor: C.border, background: C.card }}>
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full"
        style={{ background: '#FBEFE6' }}
      >
        <Icon className="size-5" style={{ color: C.orangeDeep }} />
      </span>
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold tracking-tight">{who}</h3>
        <p className="text-[14px] leading-relaxed" style={{ color: C.body }}>
          {children}
        </p>
      </div>
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
        <h2 className="flex items-center gap-2 text-lg sm:text-xl font-semibold tracking-tight">
          <Icon className="size-4.5 shrink-0" style={{ color: C.orangeDeep }} />
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
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <RBMark className="size-5" />
            <span className="text-sm font-semibold tracking-tight">Relational Builder</span>
          </a>
          <nav className="ml-auto flex items-center gap-4 text-sm">
            <a href="/" className="hover:underline underline-offset-4" style={{ color: C.body }}>
              Home
            </a>
            <a href="/studios" className="hidden sm:inline hover:underline underline-offset-4" style={{ color: C.body }}>
              Studios
            </a>
            <a href="/commons" className="hidden sm:inline hover:underline underline-offset-4" style={{ color: C.body }}>
              Commons
            </a>
            <a
              href={PLAN_HREF}
              className="rounded-full px-4 py-1.5 text-xs font-semibold"
              style={{ background: C.orangeDeep, color: '#FFF6EE' }}
            >
              Plan one with us
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16 space-y-12 sm:space-y-16">
        {/* Hero */}
        <header className="space-y-4 text-center">
          <Kicker>Build-a-thons &amp; group build days</Kicker>
          <h1 className="text-[1.85rem] leading-[1.15] sm:text-5xl font-semibold tracking-tight sm:leading-tight">
            This moment calls us
            <br />
            to build{' '}
            <em
              className="not-italic"
              style={{
                color: C.orangeDeep,
                textDecoration: 'underline',
                textDecorationThickness: '3px',
                textDecorationColor: C.yellow,
                textUnderlineOffset: '6px',
              }}
            >
              together
            </em>
            .
          </h1>
          <p className="mx-auto max-w-xl text-base sm:text-lg leading-relaxed" style={{ color: C.body }}>
            A build-a-thon is a day when a room of people who share a place
            make the tools that place needs. Not a competition, not a demo of
            someone else's product. Neighbors, organizers, city staff, and
            first-time builders, working side by side, leaving with things
            that work.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <a
              href={PLAN_HREF}
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

        {/* Two shifts from the hackathon model */}
        <section className="space-y-5">
          <div className="text-center space-y-2">
            <Kicker>Why we're bringing the build-a-thon back</Kicker>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Two shifts from the hackathon we all remember</h2>
            <p className="mx-auto max-w-xl text-[15px] leading-relaxed" style={{ color: C.body }}>
              Hackathons asked for a weekend, a laptop full of tooling, and a
              pitch. Most people in a neighborhood were spectators, and most of
              what got built never shipped. Two things have changed.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Shift icon={DoorOpen} from="Developers only" to="Anyone can contribute">
              Building is now a conversation. The person who knows which
              corner floods, who runs the food pantry, or what the seniors on
              the block actually ask for is the most valuable builder in the
              room. Describe it in plain language and the tool takes shape in
              front of you. No setup, no code required, and the people who do
              code work alongside everyone else.
            </Shift>
            <Shift icon={Hammer} from="Prototypes and pitch decks" to="Working tools, built together">
              What leaves the room works. Live sites, real data, sign-ups,
              email, all included and free, so a tool made at 2pm is in
              neighbors' hands by 5. And building happens together: teams
              form in the room, the Builder points people at each other when
              their projects overlap, and finished work goes back to the
              commons for the next neighborhood to remix.
            </Shift>
          </div>
        </section>

        <Shot
          src="/media/workspace.webp"
          alt="The Relational Builder workspace: a conversation on the left building a block party app shown live on the right"
          caption="The whole toolchain is a conversation: describe the change on the left, watch the app become real on the right. The dashed card is Relational Builder noticing that someone three tables over is building something adjacent — more on that below."
        />

        {/* Why it runs well */}
        <section className="space-y-5">
          <div className="text-center space-y-2">
            <Kicker>Why it runs well in a room</Kicker>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Built for exactly this</h2>
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
        <div className="space-y-10 sm:space-y-14">
          <div className="text-center space-y-2">
            <Kicker>The day, hour by hour</Kicker>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Door to demo</h2>
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

        {/* Who might do this */}
        <section className="space-y-5">
          <div className="text-center space-y-2">
            <Kicker>A sense of what's possible</Kicker>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Who might build together</h2>
            <p className="mx-auto max-w-xl text-[15px] leading-relaxed" style={{ color: C.body }}>
              A build-a-thon fits the shape of the people who call it. A few
              of the rooms we picture:
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Scenario icon={Home} who="A block of neighbors with specific needs">
              Twelve households around one kitchen table. The shared tool
              library nobody can keep track of, the elder who needs rides on
              Tuesdays, the alley that needs a cleanup rota. By the end of the
              evening there's a sign-up that works on everyone's phone, and a
              printed flyer for the neighbors who weren't there.
            </Scenario>
            <Scenario icon={Map} who="A neighborhood sharing dreams and forming teams">
              A Saturday in the library. The morning is for saying out loud
              what people wish existed here. Teams form around the dreams
              that get the most nods, the afternoon is for building them, and
              the demo hour ends with everyone's phone open to five new tools
              made by people they now know by name.
            </Scenario>
            <Scenario icon={Landmark} who="A city hosting a civic build-a-thon">
              City staff and residents at the same tables. The 311 team
              brings what they hear, residents bring what they live, and
              together they build the small tools in between: a sidewalk
              report that reaches the right desk, a plain-language guide to a
              permit, a neighborhood dashboard drawn from open data.
            </Scenario>
            <Scenario icon={Building2} who="An organization moving its projects forward">
              A community organization brings its members in for a day. Each
              committee arrives with a project that's been stuck for lack of a
              tool: the volunteer schedule, the intake form, the map of who
              has what to lend. They leave with those tools live, and with
              members who know they can make the next one themselves.
            </Scenario>
          </div>
        </section>

        {/* Plan one with us */}
        <InquiryForm
          id="plan"
          topic="buildathon"
          title="Plan one with us"
          intro={
            <>
              Tell us a little about your place and the people you'd bring
              together. We'll mint your event code, walk through the room key
              and demo flow, and shape the day around your community, whether
              it's twelve neighbors in a library or a hundred people in a hall.
            </>
          }
          placePlaceholder="Your neighborhood, city, or organization"
          messagePlaceholder="Who would be in the room, and what do you hope they'd build?"
          submitLabel="Plan one with us"
          sentNote="Thank you. Josh will reply soon so we can start shaping the day together."
          aside={
            <a
              href={JOIN_HREF}
              className="inline-flex items-center gap-1.5 rounded-full border px-5 py-2 text-sm font-semibold"
              style={{ borderColor: C.border, color: C.body }}
            >
              Get a builder account <ArrowRight className="size-3.5" />
            </a>
          }
        />

        {/* Footer */}
        <footer className="pb-4 text-center text-xs space-y-2" style={{ color: C.muted }}>
          <p>
            The tools here serve presence — knowing your neighbors, listening
            well, showing up — never replace it.
          </p>
          <p>
            <a href="/" className="underline underline-offset-2">Home</a>
            {' '}·{' '}
            <a href="/studios" className="underline underline-offset-2">Studios</a>
            {' '}·{' '}
            <a href="/commons" className="underline underline-offset-2">Commons</a>
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
