/**
 * Theme pages — the guides into the commons. Each one is an
 * editorial page: a point of view, featured entries pulled live from the
 * commons, real projects from the network, a vote ("which would you try?"),
 * and a notes wall anyone can sign. Content lives here in code so themes
 * can be jammed on in PRs; the entries themselves stay in the commons.
 */

export interface ThemeSection {
  heading: string;
  blurb: string;
  /** slugs featured in this section, resolved live against the commons */
  slugs: string[];
  /** per-slug one-liners that say why it's here (falls back to summary) */
  notes?: Record<string, string>;
}

export interface ThemeExample {
  name: string;
  place: string;
  url: string;
  note: string;
}

export interface Theme {
  slug: string;
  title: string;
  eyebrow: string;
  description: string; // meta description
  intro: string[];     // paragraphs, plain text
  sections: ThemeSection[];
  examples: ThemeExample[];
  votePrompt: string;
  voteSlugs: string[];
  notesPrompt: string;
  related?: { label: string; href: string }[];
}

export const THEMES: Record<string, Theme> = {
  'on-your-block': {
    slug: 'on-your-block',
    title: 'Community-Building on Your Block',
    eyebrow: 'Neighboring practices',
    description:
      'Practical, proven ways to build community on your own block — block parties, welcome wagons, tool libraries, block stewards — with recipes you can follow and tools you can remix for your neighborhood.',
    intro: [
      `Most of what makes a block feel like a neighborhood isn't an app or a program — it's a repeatable practice. Someone welcomes new neighbors on purpose. Someone keeps a list of who has a ladder. Someone throws the party. These practices travel: what worked on a block in Ithaca or the Outer Sunset can work on yours, adjusted for your people and your place.`,
      `This page collects the practices we keep seeing work, from the Civic Commons — a shared library where every entry carries the name of who contributed it and stays free to remix. Start with one. The recipes below are small enough to try this month and structured enough that you won't be starting from scratch.`,
    ],
    sections: [
      {
        heading: 'Start here: five practices that fit almost any block',
        blurb: `Each is a recipe — what it is, why it works, and the steps to run it where you live.`,
        slugs: ['welcome-wagon', 'block-stewards', 'buy-nothing-group', 'babysitting-co-op', 'tool-library'],
        notes: {
          'welcome-wagon': 'The highest-leverage habit on any block: a deliberate hello when someone moves in.',
          'block-stewards': 'One or two neighbors who quietly hold the block — the connective role, named.',
          'buy-nothing-group': 'A gift economy at block scale. Stuff circulates; so do reasons to talk.',
          'babysitting-co-op': 'Trade care instead of money. The classic trust-builder for households with kids.',
          'tool-library': 'Nobody needs to own a post-hole digger. Sharing the garage is the point.',
        },
      },
      {
        heading: 'Then build the infrastructure',
        blurb: `When a practice sticks, a small tool helps it keep going without anyone burning out. These are remixable in Relational Builder — describe your block, and the tool adapts.`,
        slugs: ['block-party-organizing', 'neighbor-story-sharing'],
        notes: {
          'block-party-organizing': 'Everything for the block party: invites, signups, the day-of checklist.',
          'neighbor-story-sharing': 'Collect and keep the stories your block tells about itself.',
        },
      },
    ],
    examples: [
      {
        name: 'Outer Sunset Today',
        place: 'Outer Sunset, San Francisco',
        url: 'https://github.com/The-Relational-Technology-Project/outer-sunset-today',
        note: 'A neighborhood site built and remixed in the open — part of the commons lineage.',
      },
    ],
    votePrompt: 'Which would you try on your block first?',
    voteSlugs: ['welcome-wagon', 'block-stewards', 'buy-nothing-group', 'babysitting-co-op', 'tool-library'],
    notesPrompt: `What's working on your block? Leave a note — a practice, a lesson, a hello. Notes are public and signed with the name you give.`,
    related: [
      { label: 'Civic Media for Your Neighborhood', href: '/commons/themes/civic-media' },
      { label: 'Stories from the field', href: '/commons/stories' },
    ],
  },

  'civic-media': {
    slug: 'civic-media',
    title: 'Civic Media for Your Neighborhood',
    eyebrow: 'Local information as care work',
    description:
      'Recipes for neighborhood-scale civic media — community-stewarded stories, navigation networks, crisis activation — from the Civic Media Cookbook, with worksheets to plan your own and tools to build it.',
    intro: [
      `Every neighborhood runs on information: who's organizing what, where to get help, what's changing on the corridor, what happened at the meeting nobody could attend. When that information moves well, a place can take care of itself. Civic media is the practice of building that flow on purpose — closer to care work than to journalism, and small enough for a few neighbors to run.`,
      `These recipes come from the Civic Media Cookbook by News Futures, kept in the Civic Commons alongside the neighboring practices they pair with. Each one names the need it serves, the ingredients, and the steps — and each can become a working tool in Relational Builder.`,
    ],
    sections: [
      {
        heading: 'The recipes',
        blurb: `Ten shapes civic media takes at neighborhood scale. Start from the need you actually have.`,
        slugs: [
          'community-stewarded-stories', 'navigation-networks', 'crisis-activation',
          'making-invisible-visible', 'connection-infrastructure', 'care-webs',
          'community-research-teams', 'community-support-spaces', 'place-as-canvas', 'priority-setting',
        ],
      },
      {
        heading: 'Plan yours: the worksheets',
        blurb: `Three worksheets for going from "our neighborhood needs something" to a recipe you can run.`,
        slugs: ['worksheet-community-needs', 'worksheet-recipe-builder', 'worksheet-impact-tracker'],
        notes: {
          'worksheet-community-needs': 'Name the information needs your neighbors actually have.',
          'worksheet-recipe-builder': 'Turn a need into a recipe: ingredients, steps, who stirs.',
          'worksheet-impact-tracker': 'Know whether the information is landing — lightly, without a dashboard.',
        },
      },
    ],
    examples: [
      {
        name: 'Civic Media Cookbook',
        place: 'News Futures',
        url: 'https://www.newsfutures.org/library/civic-media-cookbook',
        note: 'The original cookbook these recipes come from — full field guide included.',
      },
    ],
    votePrompt: 'Which does your neighborhood need most?',
    voteSlugs: [
      'community-stewarded-stories', 'navigation-networks', 'crisis-activation',
      'making-invisible-visible', 'care-webs',
    ],
    notesPrompt: `How does news actually travel where you live? Leave a note — group chats, corkboards, the neighbor who knows everything. Notes are public and signed with the name you give.`,
    related: [
      { label: 'Community-Building on Your Block', href: '/commons/themes/on-your-block' },
      { label: 'The reading room', href: '/commons/reading-room' },
    ],
  },

  organizing: {
    slug: 'organizing',
    title: 'Building Power with Your Neighbors',
    eyebrow: 'Community organizing',
    description:
      'Community organizing in the Marshall Ganz tradition, framed by six questions — who are my people, what do we care about, what resources do we have, what could we do together, what commitments do we make, and are we stronger now — with practices, stories and build prompts for each.',
    intro: [
      `Organizing is people building the power to change things together — not a mood, a craft. The tradition that runs from Fred Ross's house meetings through Cesar Chavez to Marshall Ganz's public narrative has a repeatable core: relationships built one conversation at a time, stories that turn values into action, strategy that turns what you have into what you need, and commitments people actually keep to each other.`,
      `This guide hangs the whole craft on six questions. Ask them in order, with your neighbors, and you're organizing: Who are my people? What do we care about? What resources do we have? Given all that, what could we do together? What commitments do we make to each other? And after we act — how did it go, and are we stronger now? Every practice, story and build prompt below sits under the question it answers.`,
    ],
    sections: [
      {
        heading: 'Start with the frame',
        blurb: `The six questions in one place, and the handbook this guide is grounded in.`,
        slugs: ['organizing-six-questions', 'organizing-people-power-change-guide'],
        notes: {
          'organizing-six-questions': 'The whole craft as six questions a block can actually ask.',
          'organizing-people-power-change-guide': 'The Ganz-tradition handbook — worksheets included, free to use.',
        },
      },
      {
        heading: 'Who are my people?',
        blurb: `Expansive on purpose — and in a place, it's the people who live there with you. Organizing starts by finding them, one conversation at a time.`,
        slugs: [
          'one-to-one-relational-meeting', 'the-house-meeting', 'sal-si-puedes',
          'cops-thousand-conversations', 'e-democracy-doorsteps', 'build-relational-map',
        ],
        notes: {
          'one-to-one-relational-meeting': 'The founding practice: thirty minutes, two people, no agenda but each other.',
          'the-house-meeting': 'Ten neighbors in a living room — where a list of names becomes a people.',
          'sal-si-puedes': 'Fred Ross knocks on a San Jose door in 1952 and finds Cesar Chavez.',
          'cops-thousand-conversations': 'San Antonio organizers held a thousand conversations before the first assembly.',
          'e-democracy-doorsteps': 'The neighborhood forums that reached everyone were built by door-knocking.',
          'build-relational-map': 'Start tonight: who do you know, who do they know, who is missing?',
        },
      },
      {
        heading: 'What do we care about?',
        blurb: `Values move people when they're carried by story. Public narrative — the story of self, us, and now — is how a "we" learns what it cares about out loud.`,
        slugs: ['story-of-self-us-now', 'why-stories-matter-ganz', 'build-public-narrative-workshop'],
        notes: {
          'story-of-self-us-now': 'Ganz’s craft: a choice point you faced, the values you share, the urgent ask.',
          'why-stories-matter-ganz': 'The essay behind the practice — why narrative is how values become action.',
          'build-public-narrative-workshop': 'Run a self/us/now workshop for your block, materials included.',
        },
      },
      {
        heading: 'What resources do we have?',
        blurb: `Asset-based community development starts from what's present, not what's missing: gifts, skills, associations, land, and the connectors who already know everyone.`,
        slugs: [
          'to-for-with-by', 'neighborhood-asset-map', 'gift-conversations',
          'roving-listener', 'block-connectors-edmonton', 'build-living-asset-map',
        ],
        notes: {
          'to-for-with-by': 'Cormac Russell’s ladder: are we doing this to people, for them, with them — or is it by them?',
          'neighborhood-asset-map': 'Map gifts before gaps — the needs map can wait.',
          'gift-conversations': 'Three questions per neighbor: gifts of the head, the hands, the heart.',
          'roving-listener': 'De’Amon Harges’s job in Indianapolis: listen for neighbors’ gifts, then connect them.',
          'block-connectors-edmonton': 'A city that hires no programs — just neighbors who connect neighbors.',
          'build-living-asset-map': 'The asset map as a living tool the block keeps updating.',
        },
      },
      {
        heading: 'What could we do together?',
        blurb: `Strategy is turning what you have into what you need to get what you want. Name the power that can give you what you want, then find your leverage on it.`,
        slugs: [
          'people-power-change', 'theory-of-change-sentence', 'tracking-down-the-power',
          'campaign-timeline-peaks', 'montgomery-381-days', 'moms-4-housing',
          'littlesis-oligrapher', 'build-power-map-canvas',
        ],
        notes: {
          'people-power-change': 'Ganz’s definitions: power is not a thing but a relationship — power with, power over.',
          'theory-of-change-sentence': 'If we do X, then Y will happen, because Z. Say it out loud; if it sounds wrong, it is.',
          'tracking-down-the-power': 'Who can actually give you what you want? Follow the decision to a name.',
          'campaign-timeline-peaks': 'Campaigns aren’t steady — foundation, kickoff, peaks, and a deadline.',
          'montgomery-381-days': 'Bus fare, feet, church basements, and one another — strategy’s cleanest example.',
          'moms-4-housing': 'A vacant house in Oakland, occupied by homeless mothers, changed California law.',
          'littlesis-oligrapher': 'The involuntary who’s-who of power — map your landlord’s LLC with your neighbors.',
          'build-power-map-canvas': 'The power map as a canvas your team fills in together.',
        },
      },
      {
        heading: 'What commitments do we make to each other?',
        blurb: `Organizing runs on commitments, not sentiments — asked for plainly, recorded, and distributed across a structure that doesn't burn one hero out.`,
        slugs: [
          'the-hard-ask', 'the-organizing-sentence', 'launch-a-team', 'snowflake-model',
          'grape-boycott-boycott-houses', 'kc-tenants', 'build-commitment-ledger',
        ],
        notes: {
          'the-hard-ask': 'Ask for something specific, and let the silence do its work. Expect three nos.',
          'the-organizing-sentence': 'We are organizing WHO to do WHAT by WHEN through HOW.',
          'launch-a-team': 'Purpose, roles, norms — the one-meeting recipe for a team that lasts.',
          'snowflake-model': 'Leadership that multiplies: each leader develops more leaders.',
          'grape-boycott-boycott-houses': 'Farmworker families moved into boycott houses in fifty cities — commitment made visible.',
          'kc-tenants': 'A tenant union whose leaders are the people it fights for.',
          'build-commitment-ledger': 'A shared ledger of who committed to what — visible, kind, and real.',
        },
      },
      {
        heading: 'How did it go — are we stronger now?',
        blurb: `Two questions after every action: did it work, and are we stronger? Wins that leave no new leaders behind are rented, not owned.`,
        slugs: [
          'the-debrief', 'coaching-five-steps', 'beautician-and-bus-driver',
          'parent-mentors-logan-square', 'dudley-street-how-many-of-you-live-here', 'build-debrief-ritual',
        ],
        notes: {
          'the-debrief': 'The ritual that turns action into learning and learning into leaders.',
          'coaching-five-steps': 'Enable others to act — five steps from doing it yourself to developing someone.',
          'beautician-and-bus-driver': 'Highlander’s measure of success: who left stronger than they came?',
          'parent-mentors-logan-square': 'The program where the win is the people it develops.',
          'dudley-street-how-many-of-you-live-here': 'One question from a resident restructured a whole initiative.',
          'build-debrief-ritual': 'A tool that asks both questions after every action, and remembers the answers.',
        },
      },
    ],
    examples: [
      {
        name: 'KC Tenants',
        place: 'Kansas City, Missouri',
        url: 'https://kctenants.org',
        note: 'A citywide tenant union led by poor and working-class tenants — the six questions at scale.',
      },
      {
        name: 'Leading Change Network',
        place: 'Global',
        url: 'https://leadingchangenetwork.org',
        note: 'Marshall Ganz’s community of organizing practice — guides, workshops, coaching.',
      },
      {
        name: 'ABCD Institute',
        place: 'DePaul University',
        url: 'https://resources.depaul.edu/abcd-institute',
        note: 'The home of asset-based community development — Kretzmann and McKnight’s lineage.',
      },
    ],
    votePrompt: 'Which practice would you try with your neighbors first?',
    voteSlugs: [
      'one-to-one-relational-meeting', 'the-house-meeting', 'story-of-self-us-now',
      'neighborhood-asset-map', 'the-debrief',
    ],
    notesPrompt: `Who are your people, and what do you care about? Leave a note — a practice you've tried, a story from your block, a question you're sitting with. Notes are public and signed with the name you give.`,
    related: [
      { label: 'Civic Tech at Neighborhood Scale', href: '/commons/themes/neighborhood-civic-tech' },
      { label: 'Community-Building on Your Block', href: '/commons/themes/on-your-block' },
      { label: 'Stories from the field', href: '/commons/stories' },
    ],
  },

  'neighborhood-civic-tech': {
    slug: 'neighborhood-civic-tech',
    title: 'Civic Tech at Neighborhood Scale',
    eyebrow: 'Local civic tech',
    description:
      'Open-source civic tech remixable at neighborhood scale — mapping, deciding, sharing and caring together — with the design lessons from a decade of neighborhood tech, stories from real blocks, and prompts to build your own.',
    intro: [
      `Civic tech doesn't have to be built for your neighborhood to work in your neighborhood. Ushahidi was built for crisis mapping in Kenya; it also makes a lovely map of the third places on your block. The pattern repeats across a decade of open-source civic software: the platforms are global, the deployments that matter are local — and small. What travels isn't the app, it's the remix: platforms (open source, self-hostable), patterns (adopt-a-thing, signs on fences), and stories of what real blocks did.`,
      `This guide was researched through the Civic Tech Field Guide's directory of thousands of projects — including its graveyard, which teaches as much as the survivors do. The tools below are all open source with real deployments behind them; each carries a one-line neighborhood remix idea, and each can be planned and built in Relational Builder. The design lessons come first, because the graveyard is full of tools that skipped them.`,
    ],
    sections: [
      {
        heading: 'Start with the thesis — and the graveyard',
        blurb: `Four frameworks before any tool: why remixing beats adopting, what the dead platforms teach, the six design lessons, and the shadow side to design against.`,
        slugs: [
          'remix-at-neighborhood-scale', 'learn-from-the-graveyard',
          'six-lessons-neighborhood-tech', 'design-for-care-not-enforcement',
        ],
        notes: {
          'remix-at-neighborhood-scale': 'The guide’s thesis: remix platforms, patterns and stories for your place.',
          'learn-from-the-graveyard': 'EveryBlock, Neighborland, PledgeBank — what the dead teach the living.',
          'six-lessons-neighborhood-tech': 'Phone-first, paper in the stack, pay stewards, small apps remix best.',
          'design-for-care-not-enforcement': 'Neighborhood tech’s documented shadow, and the design moves against it.',
        },
      },
      {
        heading: 'See your place together',
        blurb: `Maps and shared memory: tools for a neighborhood to see itself — its places, stories, and streets — on its own terms.`,
        slugs: ['ushahidi', 'localwiki', 'field-papers', 'terrastories', 'mapeo-comapeo', 'streetmix'],
        notes: {
          ushahidi: 'The global crisis mapper, remixed small: a map of third places, murals, or free fridges.',
          localwiki: 'A wiki for one place — Davis, California wrote 16,000 pages about itself.',
          'field-papers': 'Print an atlas, walk it with a pen, fold it back into the world’s open map.',
          terrastories: 'Offline-first storytelling on a map — built with and for Indigenous communities.',
          'mapeo-comapeo': 'Mapping that works with no internet and stays owned by the community.',
          streetmix: 'Redesign your street’s cross-section in a browser — the meeting-night favorite.',
        },
      },
      {
        heading: 'Decide together',
        blurb: `Participation platforms scale down surprisingly well: a block deciding how to spend $500 deserves ballot design as good as a city's.`,
        slugs: ['decidim', 'consul-democracy', 'polis', 'loomio', 'cobudget', 'stanford-pb-platform'],
        notes: {
          decidim: 'Barcelona’s participation platform — free software with a democratic constitution of its own.',
          'consul-democracy': 'Madrid’s proposals-debates-budgets platform, used by hundreds of cities.',
          polis: 'Surfaces what a divided group actually agrees on — famous from Taiwan’s vTaiwan.',
          loomio: 'Slow, asynchronous group decisions — built by a workers’ co-op.',
          cobudget: 'Money decisions made collectively, at grant-circle scale.',
          'stanford-pb-platform': 'The free multilingual ballot box, down to very small budgets.',
        },
      },
      {
        heading: 'Share, care, and coordinate',
        blurb: `The mutual-aid stack: food, stuff, services, events — coordination tools that treat neighbors as participants, not tickets.`,
        slugs: [
          'karrot', 'human-essentials', 'open-food-network', 'open-referral-hsds',
          'mobilizon', 'gathio', 'fixmystreet-platform',
        ],
        notes: {
          karrot: 'Foodsaving groups’ coordination tool — pickups, trust, and no bosses.',
          'human-essentials': 'The inventory backbone behind diaper banks and essentials pantries.',
          'open-food-network': 'Local food hubs as open infrastructure, not a marketplace’s cut.',
          'open-referral-hsds': 'The data standard so the neighborhood’s who-has-what list is written once.',
          mobilizon: 'Events and groups on the open fediverse — no attention economy attached.',
          gathio: 'An event page that deletes itself afterward — ephemerality as a feature.',
          'fixmystreet-platform': 'The original civic issue-reporter, remixable at any scale.',
        },
      },
      {
        heading: 'Proof it works: stories from real blocks',
        blurb: `What actually happened when neighborhoods picked up these patterns — including the ones that started as a spreadsheet and a phone number.`,
        slugs: [
          'bed-stuy-strong', 'adopt-a-hydrant-remixes', '596-acres',
          'five-sisters-forum', 'large-lots-chicago', 'disfactory',
        ],
        notes: {
          'bed-stuy-strong': 'Slack, Airtable, and a phone number fed 28,000 neighbors.',
          'adopt-a-hydrant-remixes': 'One tiny app, endlessly re-skinned: sirens, drains, sidewalks.',
          '596-acres': 'The map found the data; laminated signs on fences found the people.',
          'five-sisters-forum': 'Front Porch Forum’s origin: one digest a day, slow by design.',
          'large-lots-chicago': 'A one-page app sold city lots for $1 — and crime fell most when buyers were neighbors.',
          disfactory: 'Taiwanese citizens geotagging illegal factories — crowdsourced accountability that stuck.',
        },
      },
      {
        heading: 'Build yours',
        blurb: `Six starting points, ready to open in Relational Builder — describe your block and adapt from there.`,
        slugs: [
          'build-local-ushahidi-third-places', 'build-adopt-a-thing', 'build-block-scale-pb',
          'build-living-asset-map', 'build-front-porch-digest', 'build-mutual-aid-intake',
        ],
        notes: {
          'build-local-ushahidi-third-places': 'The local Ushahidi: a community-sourced map of your neighborhood’s third places.',
          'build-adopt-a-thing': 'Adopt-a-hydrant for whatever your block has: trees, drains, benches, bus stops.',
          'build-block-scale-pb': 'Participatory budgeting for a block party budget — real ballots, tiny stakes.',
          'build-living-asset-map': 'The organizing guide’s asset map as a living, neighbor-updated tool.',
          'build-front-porch-digest': 'One calm email a day for your block, human-moderated.',
          'build-mutual-aid-intake': 'Phone-first intake for a mutual-aid pod — paper stays in the stack.',
        },
      },
    ],
    examples: [
      {
        name: 'Civic Tech Field Guide',
        place: 'Global',
        url: 'https://civictech.guide',
        note: 'The directory this guide was researched from — thousands of projects, graveyard included.',
      },
      {
        name: 'Front Porch Forum',
        place: 'Vermont',
        url: 'https://frontporchforum.com',
        note: 'The strongest evidence in neighborhood tech: one digest a day, every Vermont town.',
      },
      {
        name: 'Large Lots',
        place: 'Chicago',
        url: 'https://www.largelots.org',
        note: 'City-owned lots to neighbors for $1, through a one-page application.',
      },
    ],
    votePrompt: 'Which would you remix for your neighborhood first?',
    voteSlugs: [
      'build-local-ushahidi-third-places', 'build-adopt-a-thing', 'build-block-scale-pb',
      'build-front-porch-digest', 'build-mutual-aid-intake',
    ],
    notesPrompt: `What tech does your neighborhood actually use — and what did it stop using? Leave a note: a remix idea, a deployment story, a tool we should know about. Notes are public and signed with the name you give.`,
    related: [
      { label: 'Building Power with Your Neighbors', href: '/commons/themes/organizing' },
      { label: 'Civic Media for Your Neighborhood', href: '/commons/themes/civic-media' },
      { label: 'Stories from the field', href: '/commons/stories' },
    ],
  },
};
