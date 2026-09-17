import type { ReactNode } from 'react';
import { RBMark } from '@/components/RBMark';
import { LANDING_COLORS as C } from '@/components/Landing';
import { InquiryForm } from '@/components/InquiryForm';
import {
  MapPinned,
  Compass,
  Database,
  LayoutGrid,
  DoorOpen,
  ArrowRight,
  Sparkles,
  Users,
} from 'lucide-react';

/**
 * /studios — the public page for what a Studio is inside Relational Builder
 * and an invitation to create one. A Studio is a home for a community of
 * builders with a shared focus: its own values and principles layered on
 * the RTP base, the practices and guardrails it wants in every build, the
 * contexts and sources it knows, and a gallery of what its builders make.
 * Place is one shape that takes (a city, a neighborhood); a mission, a
 * network, or a practice is another. The worked example is a representative
 * San Francisco civic tech studio, not a live one. A companion to /buildathon (same shell, same form), reachable
 * signed in or out — Landing routes here before the app gate.
 */

const JOIN_HREF = '/#join';
const CREATE_HREF = '#create';

// The representative studio. Illustrative on purpose: no live studio is
// named here, so the page stays true as the real roster changes.
const SF = {
  name: 'San Francisco Civic Tech Studio',
  tagline: 'Tools for the city, made by the people who live in it',
  color: '#3D6B8B',
  neighborhoods: ['Tenderloin', 'Bayview', 'Excelsior', 'Mission', 'Sunset', 'Chinatown', 'Visitacion Valley'],
  data: ['DataSF open data', '311 service cases', 'Muni GTFS feeds', 'Planning & permits', 'Supervisor districts', 'Rec & Park facilities'],
  gallery: [
    { title: 'Corner store hours', place: 'Excelsior', what: 'Which stores are open late, kept current by the owners' },
    { title: 'Tenant rights walkthrough', place: 'Mission', what: 'Plain-language guide, in three languages, that points to real help' },
    { title: 'Block party permit helper', place: 'Sunset', what: 'The city form, explained one question at a time' },
    { title: 'Air quality phone tree', place: 'Bayview', what: 'Texts neighbors when readings cross a line' },
    { title: 'Sidewalk report that lands', place: 'Tenderloin', what: 'Files a 311 case and tells the block what happened next' },
    { title: 'Muni stop buddy', place: 'Chinatown', what: 'Seniors share rides to the same stop' },
  ],
};

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: C.orangeDeep }}>
      {children}
    </p>
  );
}

function Enables({ icon: Icon, title, children }: { icon: typeof Users; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border p-5 sm:p-6 space-y-2.5" style={{ borderColor: C.border, background: C.card }}>
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full" style={{ background: '#FBEFE6' }}>
          <Icon className="size-4.5" style={{ color: C.orangeDeep }} />
        </span>
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
      </div>
      <p className="text-[14px] leading-relaxed" style={{ color: C.body }}>
        {children}
      </p>
    </div>
  );
}

function Chip({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-block rounded-full border px-2.5 py-0.5 text-[12px]"
      style={{ borderColor: C.border, color: color ?? C.body, background: '#FFFFFF' }}
    >
      {children}
    </span>
  );
}

/** The illustrative studio, laid out the way a studio reads inside the Builder */
function StudioExample() {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.border, background: C.card, boxShadow: '0 10px 34px rgba(42,31,24,.09)' }}>
      {/* Studio identity */}
      <div className="flex items-start gap-3 border-b p-5 sm:p-6" style={{ borderColor: C.border }}>
        <span className="mt-0.5 size-8 shrink-0 rounded-full" style={{ background: SF.color }} />
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight">{SF.name}</h3>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: C.border, color: C.muted }}>
              Representative example
            </span>
          </div>
          <p className="text-sm" style={{ color: C.body }}>{SF.tagline}</p>
        </div>
      </div>

      <div className="grid gap-0 sm:grid-cols-2">
        {/* (a) neighborhoods */}
        <div className="space-y-2.5 border-b p-5 sm:p-6 sm:border-r" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <MapPinned className="size-4" style={{ color: C.orangeDeep }} />
            <h4 className="text-sm font-semibold">Knows the neighborhoods</h4>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: C.body }}>
            Say "the Excelsior" and the Builder already knows it's a family
            neighborhood of small storefronts along Mission Street where a lot
            of households speak Spanish, Tagalog, or Cantonese at home. The
            stewards wrote that down once. Every build after starts from it.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SF.neighborhoods.map(n => <Chip key={n}>{n}</Chip>)}
          </div>
        </div>

        {/* (b) frame */}
        <div className="space-y-2.5 border-b p-5 sm:p-6" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <Compass className="size-4" style={{ color: C.orangeDeep }} />
            <h4 className="text-sm font-semibold">Has its own frame, based on the place</h4>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: C.body }}>
            Layered on the shared relational tech principles, this studio adds
            its own. The AI plans, critiques, and presents every build through
            them.
          </p>
          <ul className="space-y-1.5 text-[13px] leading-relaxed" style={{ color: C.body }}>
            <li className="flex gap-2"><span style={{ color: C.orangeDeep }}>1.</span> Build for the residents the city's systems reach last.</li>
            <li className="flex gap-2"><span style={{ color: C.orangeDeep }}>2.</span> Every tool should work in the languages of the block it serves.</li>
            <li className="flex gap-2"><span style={{ color: C.orangeDeep }}>3.</span> Close the loop: when a neighbor reports something, they hear back.</li>
            <li className="flex gap-2"><span style={{ color: C.orangeDeep }}>4.</span> Prefer tools a block can run without the city, and hand the city a way in.</li>
          </ul>
        </div>

        {/* (c) data */}
        <div className="space-y-2.5 border-b p-5 sm:p-6 sm:border-b-0 sm:border-r" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <Database className="size-4" style={{ color: C.orangeDeep }} />
            <h4 className="text-sm font-semibold">Knows the civic data sources</h4>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: C.body }}>
            Ask for "a map of the trees on our block" and the Builder reaches
            for the right DataSF dataset, knows how 311 cases are shaped, and
            which feeds update live. Stewards keep this list, so no builder
            has to discover it alone.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SF.data.map(d => <Chip key={d}>{d}</Chip>)}
          </div>
        </div>

        {/* (d) gallery */}
        <div className="space-y-2.5 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <LayoutGrid className="size-4" style={{ color: C.orangeDeep }} />
            <h4 className="text-sm font-semibold">A gallery of remixable examples</h4>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: C.body }}>
            What SF builders make, on a shelf of its own. Anyone in the studio
            can open one and remix it for their block.
          </p>
          <ul className="grid gap-1.5 pt-1">
            {SF.gallery.map(g => (
              <li key={g.title} className="rounded-lg border px-3 py-2" style={{ borderColor: C.border, background: C.bg }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-medium">{g.title}</span>
                  <span className="shrink-0 text-[11px]" style={{ color: C.muted }}>{g.place}</span>
                </div>
                <p className="text-[12px] leading-snug" style={{ color: C.body }}>{g.what}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** A short exchange showing the studio doing its work */
function Exchange() {
  const bubble = (who: 'you' | 'rb', text: ReactNode) => (
    <div className={`flex ${who === 'you' ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[88%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed"
        style={
          who === 'you'
            ? { background: C.orangeDeep, color: '#FFF6EE' }
            : { background: C.card, color: C.body, border: `1px solid ${C.border}` }
        }
      >
        {text}
      </div>
    </div>
  );
  return (
    <div className="rounded-2xl border p-4 sm:p-5 space-y-3" style={{ borderColor: C.border, background: C.bg }}>
      {bubble('you', 'The seniors in my building in the Tenderloin keep missing the free produce days. Can we make something?')}
      {bubble(
        'rb',
        <>
          Yes. A few things I already know from the studio: many residents in
          Tenderloin SROs don't have reliable data plans, so I'll make this
          work as a printed calendar and as a text reminder, not just a web
          page. The food pantry schedules come from a DataSF dataset the
          studio lists, so the dates can stay current on their own. And
          there's a{' '}
          <strong style={{ color: C.ink }}>Muni stop buddy</strong> in the
          studio gallery that pairs seniors for the same trip. Want to start
          from that, so neighbors can go together?
        </>,
      )}
      {bubble('you', "Yes, start from that. Chinese and Vietnamese too, please.")}
      <p className="pt-1 text-center text-[11px]" style={{ color: C.muted }}>
        An illustration of a studio at work. The builder never had to explain the neighborhood, find the dataset, or start from a blank page.
      </p>
    </div>
  );
}

export function StudiosPage() {
  return (
    <div
      className="min-h-dvh overflow-y-auto"
      style={{ background: C.bg, color: C.ink, fontFamily: "'Inter Variable', system-ui, sans-serif" }}
    >
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
            <a href="/buildathon" className="hidden sm:inline hover:underline underline-offset-4" style={{ color: C.body }}>
              Build-a-thons
            </a>
            <a
              href={CREATE_HREF}
              className="rounded-full px-4 py-1.5 text-xs font-semibold"
              style={{ background: C.orangeDeep, color: '#FFF6EE' }}
            >
              Create your studio
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16 space-y-12 sm:space-y-16">
        {/* Hero */}
        <header className="space-y-4 text-center">
          <Kicker>Studios</Kicker>
          <h1 className="text-[1.85rem] leading-[1.15] sm:text-5xl font-semibold tracking-tight sm:leading-tight">
            A Builder that shares
            <br />
            your values.
          </h1>
          <p className="mx-auto max-w-xl text-base sm:text-lg leading-relaxed" style={{ color: C.body }}>
            A Studio is a home for a community of builders inside Relational
            Builder. It carries what your community holds in common: your
            focus, your values and principles, the practices and guardrails
            you want in every build, the contexts and sources you know, and
            the tools your people are already making. Everyone who builds in
            the studio starts from there, not from a blank page.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <a
              href={CREATE_HREF}
              className="rounded-full px-5 py-2 text-sm font-semibold"
              style={{ background: C.orangeDeep, color: '#FFF6EE' }}
            >
              Create your studio
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

        {/* What a studio enables */}
        <section className="space-y-5">
          <div className="text-center space-y-2">
            <Kicker>What a studio enables</Kicker>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Four things the Builder takes from a studio</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Enables icon={Compass} title="A frame: your values, principles, and practices">
              The shared relational tech principles, plus the studio's own.
              A mission, a set of practices, guardrails a network has agreed
              on. The AI uses them to plan a build, critique a first draft,
              and say plainly what a tool does when it's presented. Every
              build, not just the ones where someone remembers to ask.
            </Enables>
            <Enables icon={MapPinned} title="The contexts your community works in">
              Who your builders serve, what those people have been asking
              for, the settings a tool has to fit. For a civic studio that's
              neighborhoods and city teams; for a network it might be its
              chapters or the practice it teaches. Written once by the
              stewards, present in every conversation after.
            </Enables>
            <Enables icon={Database} title="The sources you trust">
              Open data portals, service feeds, a body of research, a
              curriculum, a directory. The studio keeps the list, so a
              builder asks for what they want and the Builder already knows
              where it lives.
            </Enables>
            <Enables icon={LayoutGrid} title="A gallery of remixable examples">
              A shelf of its own in the Commons Gallery. What the studio's
              builders make is there for the next builder to open, learn from,
              and remix for their block.
            </Enables>
          </div>
          <p className="mx-auto max-w-2xl text-center text-[14px] leading-relaxed" style={{ color: C.body }}>
            <DoorOpen className="mr-1.5 inline size-4 align-[-3px]" style={{ color: C.orangeDeep }} />
            And a door of its own: a studio link brings people straight in,
            stewards approve who joins, and the studio travels with every
            project made inside it.
          </p>
        </section>

        {/* The representative example */}
        <section className="space-y-5">
          <div className="text-center space-y-2">
            <Kicker>What that looks like</Kicker>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Picture a civic tech studio for San Francisco</h2>
            <p className="mx-auto max-w-xl text-[15px] leading-relaxed" style={{ color: C.body }}>
              One shape a studio can take. Imagine one started by a few SF
              civic technologists, neighborhood organizers, and city staff,
              with a focus on tools residents and city teams make together.
              Here's what it would carry, and what a builder inside it would
              feel.
            </p>
          </div>
          <StudioExample />
          <Exchange />
        </section>

        {/* Who starts one */}
        <section className="space-y-5">
          <div className="text-center space-y-2">
            <Kicker>Who starts a studio</Kicker>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Any community with something in common</h2>
            <p className="mx-auto max-w-xl text-[15px] leading-relaxed" style={{ color: C.body }}>
              A place is one thing to share. A focus, a mission, or a set of
              practices is another. Studios hold all of these.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Enables icon={Users} title="A shared focus">
              A community organized around one kind of work, such as
              participatory systems that city teams and residents shape
              together, whose builders should all hold that focus.
            </Enables>
            <Enables icon={Sparkles} title="A mission and its practices">
              An organization or network with a long-held mission and a way of
              working it wants embedded in every tool its members make, not
              re-explained each time.
            </Enables>
            <Enables icon={MapPinned} title="A place">
              A city, region, or neighborhood with stewards who want to hold
              what the place knows, and a gallery of what neighbors have built
              for it.
            </Enables>
          </div>
        </section>

        {/* Create your studio */}
        <InquiryForm
          id="create"
          topic="studio"
          title="Create your studio"
          intro={
            <>
              Tell us about your community of builders and what they hold in
              common. We'll set the studio up together: its values and
              principles, its practices and guardrails, its contexts and
              sources, its door, and its first stewards. Studios are free to
              start.
            </>
          }
          placePlaceholder="Your network, organization, city, or neighborhood"
          messagePlaceholder="Who would build here, and what values, practices, or contexts should shape every build?"
          submitLabel="Create your studio"
          sentNote="Thank you. Josh will reply soon so we can start shaping your studio together."
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
            <a href="/buildathon" className="underline underline-offset-2">Build-a-thons</a>
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
