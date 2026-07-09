import { create } from 'zustand';
import {
  fetchConnectionInbox,
  respondToConnection,
  type ConnectionRequest,
} from '@/knowledge/connections';

/**
 * Pending connection requests addressed to the signed-in builder. Feeds the
 * friendly badge on the account menu and the "waiting for you" section on
 * the Connections page. Degrades silently to empty when signed out or when
 * the deployed connect function doesn't support inboxes yet.
 */
interface ConnectionsState {
  inbox: ConnectionRequest[];
  refreshInbox: () => Promise<void>;
  respond: (id: string, decision: 'accept' | 'decline') => Promise<{ error: string | null }>;
}

export const useConnectionsStore = create<ConnectionsState>((set, get) => ({
  inbox: [],
  refreshInbox: async () => {
    try {
      set({ inbox: await fetchConnectionInbox() });
    } catch {
      // Signed out or an older backend — no badge, no noise
    }
  },
  respond: async (id, decision) => {
    try {
      await respondToConnection(id, decision);
      set({ inbox: get().inbox.filter(r => r.id !== id) });
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Could not respond' };
    }
  },
}));
