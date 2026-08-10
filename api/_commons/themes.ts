/**
 * Theme pages — the big-picture doors into the commons. Each one is an
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
      `This page collects the practices we keep seeing work, from the RT Commons — a shared library where every entry carries the name of who contributed it and stays free to remix. Start with one. The recipes below are small enough to try this month and structured enough that you won't be starting from scratch.`,
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
      `These recipes come from the Civic Media Cookbook by News Futures, kept in the RT Commons alongside the neighboring practices they pair with. Each one names the need it serves, the ingredients, and the steps — and each can become a working tool in Relational Builder.`,
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
};
