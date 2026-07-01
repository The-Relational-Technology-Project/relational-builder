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

  setActiveProvider: (id: string) => void;
  setActiveModel: (id: string) => void;
  setApiKey: (providerId: string, key: string) => void;
  removeApiKey: (providerId: string) => void;
  refreshModels: () => Promise<void>;
}

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
      activeProviderId: 'claude',
      activeModelId: 'claude-opus-4-8',
      apiKeys: {},
      availableModels: [],

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
      version: 1,
      // Persisted configs from before July 2026 may point at Anthropic model
      // IDs that have since been retired (404 on the API) — remap them.
      migrate: (persisted) => {
        const state = persisted as Partial<ProviderState>;
        const RETIRED_MODEL_MAP: Record<string, string> = {
          'claude-opus-4-20250514': 'claude-opus-4-8',
          'claude-sonnet-4-20250514': 'claude-sonnet-5',
          'claude-haiku-3-5-20241022': 'claude-haiku-4-5',
        };
        if (state.activeModelId && RETIRED_MODEL_MAP[state.activeModelId]) {
          state.activeModelId = RETIRED_MODEL_MAP[state.activeModelId];
        }
        return state as ProviderState;
      },
      partialize: (state) => ({
        activeProviderId: state.activeProviderId,
        activeModelId: state.activeModelId,
        apiKeys: state.apiKeys,
      }),
    },
  ),
);
