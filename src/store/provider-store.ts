import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { registry } from '@/providers/registry';
import type { ModelInfo } from '@/providers/types';

interface ApiKeyConfig {
  [providerId: string]: string;
}

interface ProviderState {
  activeProviderId: string;
  activeModelId: string;
  apiKeys: ApiKeyConfig;
  availableModels: ModelInfo[];
  /** True when the person picked the current model themselves (via the model
   *  picker) for this project — automatic defaults must respect it. Cleared
   *  whenever a project is cleared or opened. */
  modelPinned: boolean;

  setActiveProvider: (id: string) => void;
  setActiveModel: (id: string) => void;
  /** A deliberate model choice: sets the model AND pins it for this project */
  pinModel: (id: string) => void;
  clearModelPin: () => void;
  setApiKey: (providerId: string, key: string) => void;
  removeApiKey: (providerId: string) => void;
  refreshModels: () => Promise<void>;
}

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
      activeProviderId: 'claude',
      activeModelId: 'claude-opus-5',
      apiKeys: {},
      availableModels: [],
      modelPinned: false,

      setActiveProvider: (id: string) => {
        set({ activeProviderId: id });
        // Pick the first model — try available models first, then defaults
        let models = get().availableModels.filter(m => m.provider === id);
        if (models.length === 0) {
          models = registry.getDefaultModels(id);
        }
        if (models.length > 0) {
          set({ activeModelId: models[0].id });
        }
      },

      setActiveModel: (id: string) => {
        set({ activeModelId: id });
      },

      pinModel: (id: string) => {
        set({ activeModelId: id, modelPinned: true });
      },

      clearModelPin: () => {
        set({ modelPinned: false });
      },

      setApiKey: async (providerId: string, key: string) => {
        registry.setApiKey(providerId, key);
        set(state => ({
          apiKeys: { ...state.apiKeys, [providerId]: key },
        }));
        // Refresh models when a key is added — await so models are ready before "Use"
        await get().refreshModels();
      },

      removeApiKey: (providerId: string) => {
        registry.setApiKey(providerId, '');
        set(state => {
          const keys = { ...state.apiKeys };
          delete keys[providerId];
          return { apiKeys: keys };
        });
      },

      refreshModels: async () => {
        // Restore API keys from persisted state into the registry
        const { apiKeys } = get();
        for (const [pid, key] of Object.entries(apiKeys)) {
          registry.setApiKey(pid, key);
        }
        const models = await registry.getAllModels();
        set({ availableModels: models });
      },
    }),
    {
      name: 'rb-provider-config',
      version: 5,
      migrate: (persisted, version) => {
        const state = persisted as Partial<ProviderState>;

        // v1: persisted configs may point at retired Anthropic model IDs
        const RETIRED_MODEL_MAP: Record<string, string> = {
          'claude-opus-4-20250514': 'claude-opus-4-8',
          'claude-sonnet-4-20250514': 'claude-sonnet-5',
          'claude-haiku-3-5-20241022': 'claude-haiku-4-5',
        };
        if (state.activeModelId && RETIRED_MODEL_MAP[state.activeModelId]) {
          state.activeModelId = RETIRED_MODEL_MAP[state.activeModelId];
        }

        // v2: the Tier-1 RTP provider is hidden until its endpoint is live —
        // rescue anyone stuck on it ("Failed to fetch" on every message)
        if (state.activeProviderId === 'rtp-hosted' && !import.meta.env.VITE_RTP_MODEL_URL) {
          state.activeProviderId = 'claude';
          state.activeModelId = 'claude-sonnet-5';
        }

        // v3 moved keyless builders Opus→Sonnet to protect the pilot budget.
        // v4 reverses it: Opus 4.8 is the community default — early adopters
        // deserve the best experience, and budgets got a lot bigger. Only
        // keyless builders on Sonnet (the default they never chose) move;
        // run it only when upgrading from ≤3 so a deliberate later switch
        // back to Sonnet sticks.
        if (
          version <= 3 &&
          state.activeProviderId === 'claude' &&
          state.activeModelId === 'claude-sonnet-5' &&
          !state.apiKeys?.['claude']
        ) {
          state.activeModelId = 'claude-opus-4-8';
        }

        // v5: Opus 5 replaces both community defaults (Fable first-build,
        // Opus 4.8 edits) after the July 27 launch bench. Move only people
        // still on a default they never chose: keyless, un-pinned, on one
        // of the two old default models. A pinned pick — or any model they
        // switched to deliberately — sticks.
        if (
          version <= 4 &&
          state.activeProviderId === 'claude' &&
          (state.activeModelId === 'claude-opus-4-8' || state.activeModelId === 'claude-fable-5') &&
          !state.apiKeys?.['claude'] &&
          !state.modelPinned
        ) {
          state.activeModelId = 'claude-opus-5';
        }

        return state as ProviderState;
      },
      partialize: (state) => ({
        activeProviderId: state.activeProviderId,
        activeModelId: state.activeModelId,
        apiKeys: state.apiKeys,
        // Survives reloads mid-project; cleared on project clear/open
        modelPinned: state.modelPinned,
      }),
    },
  ),
);
