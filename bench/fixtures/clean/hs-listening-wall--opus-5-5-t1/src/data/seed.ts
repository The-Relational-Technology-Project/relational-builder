import type { Answer, Theme, Publication } from '@/store';

// A small sketch of a wall in use. Real notes come from neighbours.
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

export const seedThemes: Theme[] = [{ id: 't-sit', questionId: 'centre', title: 'Places to sit and stay' }];

export const seedAnswers: Answer[] = [
  { id: 's1', questionId: 'centre', text: "More benches on Catherine Hill — I'd stop and chat if there were somewhere to sit.", name: null, at: daysAgo(6), metooBase: 4, metooBy: [], themeId: 't-sit' },
  { id: 's2', questionId: 'centre', text: 'Somewhere warm and free to sit on a rainy Tuesday that isn’t a café.', name: null, at: daysAgo(4), metooBase: 3, metooBy: [], themeId: 't-sit' },
  { id: 's3', questionId: 'centre', text: 'Let pop-ups use the empty shopfronts for a month at a time.', name: null, at: daysAgo(2), metooBase: 2, metooBy: [], themeId: null },
  { id: 's4', questionId: 'home', text: 'Walking by the river early, saying hello to the same dog walkers every day.', name: null, at: daysAgo(5), metooBase: 1, metooBy: [], themeId: null },
  { id: 's5', questionId: 'home', text: 'Market day, when I bump into three people I know before I’ve bought anything.', name: null, at: daysAgo(1), metooBase: 2, metooBy: [], themeId: null },
  { id: 's6', questionId: 'moving', text: 'A bus that runs after 7pm so I can get home from town without asking for a lift.', name: null, at: daysAgo(3), metooBase: 5, metooBy: [], themeId: null },
];

export const seedPubs: Record<string, Publication> = {
  centre: {
    published: true,
    summary: 'So far, people are asking for places to pause in town without having to buy something.',
  },
};