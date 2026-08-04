import type { StateStorage } from 'zustand/middleware';

/**
 * localStorage that survives a full quota. Zustand's persist middleware
 * calls setItem synchronously from set(), with no guard of its own — so
 * an unhandled QuotaExceededError would throw out of whatever mutated
 * the store, including writeFile mid-generation. Losing one persistence
 * beat is recoverable; breaking every store write is not.
 */
export const safeLocalStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch (err) {
      console.warn(`Persisting ${name} failed (storage quota?) — state stays in memory`, err);
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
};
