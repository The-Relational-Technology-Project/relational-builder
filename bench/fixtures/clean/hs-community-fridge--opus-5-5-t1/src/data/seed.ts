// A small sketch of fridge life. Replace with real neighbors as they join.
export type PersonId = 'you' | 'marisol';
export const people: Record<PersonId, { name: string }> = {
  you: { name: 'You' },
  marisol: { name: 'Marisol' },
};
export const STEWARD: PersonId = 'marisol';

export type FridgeStatus = 'full' | 'some' | 'empty';
export type UpdateKind = 'stocked' | 'low' | 'note';
export interface Bring { personId: PersonId; what: string }
export interface Update {
  id: string;
  kind: UpdateKind;
  text: string;
  authorId: PersonId;
  at: number;
  bringing: Bring[];
  thanks: PersonId[];
}
export type ShiftKind = 'clean' | 'restock';
export interface Shift {
  id: string;
  date: number;
  kind: ShiftKind;
  claimedBy: PersonId | null;
  helpers: PersonId[];
}

export const shiftInfo: Record<ShiftKind, { label: string; time: string }> = {
  clean: { label: 'Wipe down & check dates', time: '9–9:30 am' },
  restock: { label: 'Restock & tidy shelves', time: '6–7 pm' },
};

const min = 60_000;
const hr = 60 * min;
const now = Date.now();

export const seedStatus = { value: 'some' as FridgeStatus, by: 'marisol' as PersonId, at: now - 40 * min };

export const seedUpdates: Update[] = [
  {
    id: 'u1', kind: 'stocked', authorId: 'marisol', at: now - 40 * min,
    text: 'Two flats of eggs, a bag of oranges, and day-old sourdough from the bakery up the block. Top shelf.',
    bringing: [], thanks: [],
  },
  {
    id: 'u2', kind: 'low', authorId: 'you', at: now - 3 * hr,
    text: 'Out of milk and diapers (size 4). Plenty of produce though.',
    bringing: [{ personId: 'marisol', what: 'a gallon of milk after work' }], thanks: [],
  },
  {
    id: 'u3', kind: 'stocked', authorId: 'you', at: now - 20 * hr,
    text: 'Half a pot of lentil soup in labeled quart containers, made today. Vegan.',
    bringing: [], thanks: ['marisol'],
  },
  {
    id: 'u4', kind: 'note', authorId: 'marisol', at: now - 26 * hr,
    text: 'Wiped the shelves and tossed the wilted lettuce. The door seal sticks in the fog — give it a firm push shut.',
    bringing: [], thanks: [],
  },
];

function dayStart(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.getTime();
}

export const seedShifts: Shift[] = Array.from({ length: 7 }).flatMap((_, i) =>
  (['clean', 'restock'] as ShiftKind[]).map((kind) => ({
    id: `${i}-${kind}`,
    date: dayStart(i),
    kind,
    claimedBy: (i === 0 && kind === 'clean') || (i === 3 && kind === 'restock') ? 'marisol' : null,
    helpers: [],
  }))
);