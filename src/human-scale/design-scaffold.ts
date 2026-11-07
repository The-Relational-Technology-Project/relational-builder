/**
 * Design scaffolding for open models (an experiment, behind the flag).
 *
 * The build prompt's design section is principles ("obvious in three
 * seconds", "resist your default look") and the theme contract's values are
 * deliberately blank. The question this module tests: do small open models
 * design better when the prompt gives them concrete recipes and ready-made
 * visual directions instead? Three variants:
 *
 *   none       today's prompt, the control
 *   recipe     a screen recipe, a spacing and type scale, filled-token and
 *              contrast rules, and three don'ts taken from the bench board
 *   direction  the recipe plus five named visual directions written as full
 *              token sets; the model picks the one that fits the place
 *
 * The variant comes from BENCH_DESIGN_SCAFFOLD on the bench, or from this
 * browser's `rb.humanScale.designScaffold` in the Builder; `direction`
 * otherwise. Josh, reviewing the Nov 6 side-by-side: the direction builds
 * were "much better, not quite to Opus, but nearing it", so it is the
 * default whenever the flag is on. `none` stays selectable as the control.
 */

export type DesignScaffold = 'none' | 'recipe' | 'direction' | 'reference';

const VARIANTS: DesignScaffold[] = ['none', 'recipe', 'direction', 'reference'];
const STORAGE_KEY = 'rb.humanScale.designScaffold';

export function designScaffoldVariant(): DesignScaffold {
  const fromEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.BENCH_DESIGN_SCAFFOLD;
  if (fromEnv && (VARIANTS as string[]).includes(fromEnv)) return fromEnv as DesignScaffold;
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored && (VARIANTS as string[]).includes(stored)) return stored as DesignScaffold;
  } catch {
    // storage blocked: the default
  }
  return 'direction';
}

export interface VisualDirection {
  name: string;
  mood: string;
  /** Fonts from Google Fonts: display (headings) and body */
  fonts: { display: string; body: string };
  tokens: {
    background: string;
    foreground: string;
    card: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
    radius: string;
  };
}

/** Five directions, deliberately unlike each other and unlike the
 *  cream, serif and terracotta default the build prompt warns against */
export const VISUAL_DIRECTIONS: VisualDirection[] = [
  {
    name: 'Coastal fog',
    mood: 'cool gray-blue mornings, sea-glass teal, one lamp-yellow highlight; calm and clear',
    fonts: { display: 'Space Grotesk', body: 'Figtree' },
    tokens: {
      background: '#eef2f3', foreground: '#1d2a30', card: '#ffffff',
      primary: '#2a5764', primaryForeground: '#ffffff',
      secondary: '#dce7ea', secondaryForeground: '#1d2a30',
      muted: '#e3eaec', mutedForeground: '#4f5f66',
      accent: '#f2c14e', accentForeground: '#1d2a30',
      border: '#cbd7db', radius: '0.75rem',
    },
  },
  {
    name: 'Civic paper',
    mood: 'a well-made public notice: white paper, ink blue, one signal red, tight corners, numbers that line up',
    fonts: { display: 'Public Sans', body: 'Public Sans' },
    tokens: {
      background: '#ffffff', foreground: '#1b1f3b', card: '#f4f5fa',
      primary: '#2b3a8c', primaryForeground: '#ffffff',
      secondary: '#e6e8f3', secondaryForeground: '#1b1f3b',
      muted: '#eef0f6', mutedForeground: '#4a5070',
      accent: '#c8102e', accentForeground: '#ffffff',
      border: '#d5d8e6', radius: '0.25rem',
    },
  },
  {
    name: 'Schoolyard bright',
    mood: 'chalk mint, sunny yellow and a confident orange on a clean sky-white; round, friendly, made for kids and grandparents',
    fonts: { display: 'Baloo 2', body: 'Nunito' },
    tokens: {
      background: '#f7fbff', foreground: '#14213d', card: '#ffffff',
      primary: '#c2410c', primaryForeground: '#ffffff',
      secondary: '#c9f0e6', secondaryForeground: '#14213d',
      muted: '#eaf2f8', mutedForeground: '#4b5a75',
      accent: '#ffd23f', accentForeground: '#14213d',
      border: '#d6e2ee', radius: '1rem',
    },
  },
  {
    name: 'Quiet library',
    mood: 'warm stone gray, deep plum and a touch of brass; reading-room calm, generous line height',
    fonts: { display: 'Source Serif 4', body: 'Source Sans 3' },
    tokens: {
      background: '#f3f1ee', foreground: '#22201c', card: '#fbfaf8',
      primary: '#4a3f6b', primaryForeground: '#ffffff',
      secondary: '#e7e2ec', secondaryForeground: '#22201c',
      muted: '#ebe8e3', mutedForeground: '#5c574f',
      accent: '#b08d1e', accentForeground: '#22201c',
      border: '#dcd7cf', radius: '0.375rem',
    },
  },
  {
    name: 'Night market',
    mood: 'a dark street lit by lanterns: deep indigo ground, lantern orange, one teal; lively, for evening gatherings',
    fonts: { display: 'Sora', body: 'Sora' },
    tokens: {
      background: '#14121f', foreground: '#f4f1ea', card: '#1f1c2e',
      primary: '#ff9f1c', primaryForeground: '#14121f',
      secondary: '#2a2640', secondaryForeground: '#f4f1ea',
      muted: '#24203a', mutedForeground: '#b3aec4',
      accent: '#2ec4b6', accentForeground: '#14121f',
      border: '#34304a', radius: '0.75rem',
    },
  },
];

const RECIPE = [
  '## Design recipe (follow it; it is the house style for app builds)',
  '',
  '**Screen structure.** Every app-class build uses this skeleton unless the person asked for something else:',
  '1. A sticky `AppBar` with the place\'s or project\'s real name (never "My App").',
  '2. A first card that answers the tool\'s main question at a glance (are the ladders in? what is the library asking this month?), big and plain, with the one primary action beside it.',
  '3. Below it, the working lists as kit `Card`s: one clear title, one line of detail, at most one primary action per card. Every list that can be empty gets an `EmptyState` with warm words.',
  '4. On phones a `BottomNav` with 3 or 4 items; at `md` and up the bottom nav hides (`md:hidden`), a top nav shows (`hidden md:flex`), and lists sit beside their detail in two columns inside `max-w-5xl mx-auto px-4`.',
  '',
  '**Scale.** Spacing only from 4, 8, 12, 16, 24, 32 px (`gap-1 gap-2 gap-3 gap-4 gap-6 gap-8`). Four type sizes only: one display (`text-3xl md:text-4xl font-semibold`), one heading (`text-lg font-semibold`), body (`text-base`), caption (`text-sm text-muted-foreground`). Load the two fonts you chose with a Google Fonts `@import` at the top of `/src/index.css` and set `--font-sans` (and a display font class) to them.',
  '',
  '**Color.** Fill EVERY token in the theme contract with this project\'s palette; never ship the gray placeholders. One primary for actions, one accent used sparingly for status or highlights, cards a step off the background so they read as surfaces. Text must meet 4.5:1 contrast against what it sits on, including `muted-foreground` on `background` and `primary-foreground` on `primary`.',
  '',
  '**Three things the bench saw go wrong; do not do them.**',
  '- A header and a nav with nothing between them: the first screen must show real seeded content without a click.',
  '- Gray cards on a gray page with gray text: if two adjacent surfaces look the same, change one.',
  '- A phone layout stretched across a laptop: at `md`+ the page must use the width (two columns, a real top nav), not a 400px column or a full-bleed list.',
].join('\n');

function directionsBlock(): string {
  const lines = [
    '## Visual directions (pick one)',
    '',
    'Pick the ONE direction below that best fits the place and the people, use its tokens and fonts exactly (you may change one value if the place calls for it), and say in one line of your reply which direction you chose and why. Do not invent a new palette.',
    '',
  ];
  for (const d of VISUAL_DIRECTIONS) {
    const t = d.tokens;
    lines.push(
      `- **${d.name}**: ${d.mood}. Fonts: ${d.fonts.display} (display), ${d.fonts.body} (body). ` +
        `Tokens: --background ${t.background}; --foreground ${t.foreground}; --card ${t.card}; --card-foreground ${t.foreground}; ` +
        `--primary ${t.primary}; --primary-foreground ${t.primaryForeground}; --secondary ${t.secondary}; --secondary-foreground ${t.secondaryForeground}; ` +
        `--muted ${t.muted}; --muted-foreground ${t.mutedForeground}; --accent ${t.accent}; --accent-foreground ${t.accentForeground}; ` +
        `--border ${t.border}; --input ${t.border}; --ring ${t.primary}; --radius ${t.radius}.`,
    );
  }
  return lines.join('\n');
}

/**
 * What Opus did on Nov 6 that the open models' direction builds mostly did
 * not, from the side-by-side screenshots: a first screen that is full, not
 * tidy; texture on every item (a face, a time, an action of its own); and
 * copy that names people and places. Written as three rules and two short
 * reference first screens, because small models copy shapes better than
 * they follow adjectives.
 */
const REFERENCE = [
  '## Reference first screens (copy the SHAPE, not the words)',
  '',
  'Three things separate a finished neighborhood tool from a tidy demo; do all three:',
  '- **The first screen is full.** Above the fold: the big status or question block, the main action, AND the first real items. At `md`+ a second column carries the next most useful list (this week\'s pickups, the other questions), so a laptop never shows one narrow column and empty space.',
  '- **Every item has texture.** A face or initials (`<Avatar name=... />`), who and when ("Dev Patel · 2 hours ago"), a small badge for its kind, and ONE action of its own written as a verb a neighbor would say ("Thank Dev", "I can return it", "Me too"), not a generic "View".',
  '- **Copy names people and places.** The steward by name, the street, the day: "Dev keeps the tool shed. He is there Saturday mornings." Never "Welcome to the app" or "Manage your items".',
  '',
  'A coordination tool (status plus tasks; here a tool library), as a shape:',
  '```tsx',
  '<main className="max-w-5xl mx-auto px-4 py-6 grid gap-6 md:grid-cols-[1fr_320px]">',
  '  <section className="grid gap-4">',
  '    <Card className="overflow-hidden">',
  '      <div className="bg-accent text-accent-foreground p-6"><h1 className="text-3xl font-semibold">2 of 3 ladders in</h1><p>Returned by Dev Patel · 2 hours ago</p></div>',
  '      <div className="p-4 grid gap-3"><p className="text-sm text-muted-foreground">What do you need this weekend?</p><div className="grid grid-cols-3 gap-2">{/* Ladder / Drill / Saw buttons, the busy ones marked */}</div><Button>Borrow something</Button></div>',
  '    </Card>',
  '    <h2 className="text-lg font-semibold">Latest at the shed</h2>',
  '    {updates.map(u => (<Card key={u.id} className="p-4 flex gap-3"><Avatar name={u.by} /><div className="grid gap-1"><p className="text-sm"><b>{u.by}</b> · {u.when} <Badge variant="secondary">{u.kind}</Badge></p><p>{u.text}</p><Button size="sm" variant="outline">Thank {u.first}</Button></div></Card>))}',
  '  </section>',
  '  <aside className="grid gap-3 content-start"><h2 className="text-lg font-semibold">This week\'s pickups</h2>{/* day cards, each pickup: what, time, who, I can cover it */}</aside>',
  '</main>',
  '```',
  '',
  'A content tool (questions plus answers; here a library asking its readers), as a shape:',
  '```tsx',
  '<main className="max-w-5xl mx-auto px-4 py-6 grid gap-6 md:grid-cols-[1fr_300px]">',
  '  <section className="grid gap-4">',
  '    <header className="grid gap-2"><h1 className="text-3xl md:text-4xl font-semibold">What should the new room be for?</h1><p className="text-muted-foreground">The Eastside Library team reads every answer. Add yours with your first name, or without.</p></header>',
  '    <Card className="p-5 grid gap-3"><p className="text-sm text-muted-foreground">Question 1 of 2</p><h2 className="text-xl font-semibold">What would bring you in on a weekday evening?</h2>{/* the answer box and an Add mine button, right here */}</Card>',
  '    {answers.map(a => (<Card key={a.id} className="p-4 grid gap-2"><p className="text-lg">“{a.text}”</p><div className="flex items-center gap-2 text-sm text-muted-foreground"><Avatar name={a.by ?? "Anonymous"} />{a.by ?? "Anonymous"} · {a.when}<Button size="sm" variant="outline" className="ml-auto">Me too · {a.meToo}</Button></div></Card>))}',
  '  </section>',
  '  <aside className="grid gap-3 content-start">{/* the other question as a card with its answer count; what the team heard so far */}</aside>',
  '</main>',
  '```',
].join('\n');

/** The prompt block for a variant; empty for `none` */
export function designScaffoldPrompt(variant: DesignScaffold = designScaffoldVariant()): string {
  if (variant === 'recipe') return RECIPE;
  if (variant === 'direction') return `${RECIPE}\n\n${directionsBlock()}`;
  if (variant === 'reference') return `${RECIPE}\n\n${directionsBlock()}\n\n${REFERENCE}`;
  return '';
}

/** WCAG contrast ratio between two #rrggbb colors */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = hex.replace('#', '');
    const [r, g, bl] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
