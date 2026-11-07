import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { seedAnswers, seedThemes, seedPubs } from '@/data/seed';

export type PersonaId = 'you' | 'priya';

export const personas: { id: PersonaId; label: string }[] = [
  { id: 'you', label: 'You' },
  { id: 'priya', label: 'Priya (organizer)' },
];

export type Answer = {
  id: string;
  questionId: string;
  text: string;
  name: string | null;
  at: string;
  metooBase: number;
  metooBy: PersonaId[];
  themeId: string | null;
};

export type Theme = { id: string; questionId: string; title: string };
export type Publication = { published: boolean; summary: string };

type WallState = {
  persona: PersonaId;
  answers: Answer[];
  themes: Theme[];
  pubs: Record<string, Publication>;
  setPersona: (p: PersonaId) => void;
  pin: (questionId: string, text: string, name: string) => void;
  toggleMeToo: (id: string) => void;
  addTheme: (questionId: string, title: string) => void;
  removeTheme: (id: string) => void;
  assign: (answerId: string, themeId: string | null) => void;
  setPub: (questionId: string, patch: Partial<Publication>) => void;
};

const newId = () => Math.random().toString(36).slice(2, 10);

export const useWall = create<WallState>()(
  persist(
    (set) => ({
      persona: 'you',
      answers: seedAnswers,
      themes: seedThemes,
      pubs: seedPubs,
      setPersona: (persona) => set({ persona }),
      pin: (questionId, text, name) =>
        set((s) => ({
          answers: [
            {
              id: newId(),
              questionId,
              text: text.trim(),
              name: name.trim() || null,
              at: new Date().toISOString(),
              metooBase: 0,
              metooBy: [],
              themeId: null,
            },
            ...s.answers,
          ],
        })),
      toggleMeToo: (id) =>
        set((s) => ({
          answers: s.answers.map((a) =>
            a.id !== id
              ? a
              : {
                  ...a,
                  metooBy: a.metooBy.includes(s.persona)
                    ? a.metooBy.filter((p) => p !== s.persona)
                    : [...a.metooBy, s.persona],
                }
          ),
        })),
      addTheme: (questionId, title) =>
        set((s) => ({ themes: [...s.themes, { id: newId(), questionId, title: title.trim() }] })),
      removeTheme: (id) =>
        set((s) => ({
          themes: s.themes.filter((t) => t.id !== id),
          answers: s.answers.map((a) => (a.themeId === id ? { ...a, themeId: null } : a)),
        })),
      assign: (answerId, themeId) =>
        set((s) => ({ answers: s.answers.map((a) => (a.id === answerId ? { ...a, themeId } : a)) })),
      setPub: (questionId, patch) =>
        set((s) => ({
          pubs: {
            ...s.pubs,
            [questionId]: { ...(s.pubs[questionId] ?? { published: false, summary: '' }), ...patch },
          },
        })),
    }),
    { name: 'frome-listening-wall-v1' }
  )
);

export const meTooCount = (a: Answer) => a.metooBase + a.metooBy.length;