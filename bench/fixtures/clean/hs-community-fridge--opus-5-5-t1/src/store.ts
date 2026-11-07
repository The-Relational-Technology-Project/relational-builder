import { create } from 'zustand';
import {
  seedStatus, seedUpdates, seedShifts,
  type PersonId, type FridgeStatus, type UpdateKind, type Update, type Shift,
} from '@/data/seed';

interface FridgeState {
  me: PersonId;
  status: { value: FridgeStatus; by: PersonId; at: number };
  updates: Update[];
  shifts: Shift[];
  setMe: (me: PersonId) => void;
  setStatus: (value: FridgeStatus) => void;
  post: (kind: UpdateKind, text: string) => void;
  bring: (updateId: string, what: string) => void;
  toggleThanks: (updateId: string) => void;
  claim: (shiftId: string) => void;
  drop: (shiftId: string) => void;
  join: (shiftId: string) => void;
  leave: (shiftId: string) => void;
}

const newId = () => Math.random().toString(36).slice(2, 10);

export const useFridge = create<FridgeState>((set) => {
  const mapShift = (id: string, fn: (s: Shift, me: PersonId) => Shift) =>
    set((st) => ({ shifts: st.shifts.map((s) => (s.id === id ? fn(s, st.me) : s)) }));
  const mapUpdate = (id: string, fn: (u: Update, me: PersonId) => Update) =>
    set((st) => ({ updates: st.updates.map((u) => (u.id === id ? fn(u, st.me) : u)) }));

  return {
    me: 'you',
    status: seedStatus,
    updates: seedUpdates,
    shifts: seedShifts,
    setMe: (me) => set({ me }),
    setStatus: (value) => set((st) => ({ status: { value, by: st.me, at: Date.now() } })),
    post: (kind, text) =>
      set((st) => ({
        updates: [
          { id: newId(), kind, text, authorId: st.me, at: Date.now(), bringing: [], thanks: [] },
          ...st.updates,
        ],
      })),
    bring: (id, what) =>
      mapUpdate(id, (u, me) => ({
        ...u,
        bringing: [...u.bringing.filter((b) => b.personId !== me), { personId: me, what }],
      })),
    toggleThanks: (id) =>
      mapUpdate(id, (u, me) => ({
        ...u,
        thanks: u.thanks.includes(me) ? u.thanks.filter((p) => p !== me) : [...u.thanks, me],
      })),
    claim: (id) =>
      mapShift(id, (s, me) => (s.claimedBy ? s : { ...s, claimedBy: me, helpers: s.helpers.filter((h) => h !== me) })),
    drop: (id) =>
      mapShift(id, (s, me) =>
        s.claimedBy !== me ? s : { ...s, claimedBy: s.helpers[0] ?? null, helpers: s.helpers.slice(1) }
      ),
    join: (id) =>
      mapShift(id, (s, me) => (s.claimedBy === me || s.helpers.includes(me) ? s : { ...s, helpers: [...s.helpers, me] })),
    leave: (id) => mapShift(id, (s, me) => ({ ...s, helpers: s.helpers.filter((h) => h !== me) })),
  };
});