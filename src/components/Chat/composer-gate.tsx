import { useProviderStore } from '@/store/provider-store';
import { useCommunityStore } from '@/store/community-store';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { registry } from '@/providers/registry';
import { Button } from '@/components/ui/button';

/**
 * Whether the composer can actually reach a model — shared by every surface
 * that renders one (the builder's chat input and the home hero), so "do you
 * need a key" has exactly one answer.
 */
export function useNeedsKey(): boolean {
  const activeProviderId = useProviderStore(s => s.activeProviderId);
  const apiKeys = useProviderStore(s => s.apiKeys);
  const communityActive = useCommunityStore(s => s.active);
  return Boolean(
    registry.getEntry(activeProviderId)?.requiresApiKey &&
      !apiKeys[activeProviderId] &&
      !(activeProviderId === 'claude' && communityActive),
  );
}

/**
 * The line under a gated composer. Someone who just passed the invitation
 * gate needs sign-in, not an API key — signing in enrolls them in free
 * community building automatically.
 */
export function NeedsKeyHint({ needsKey }: { needsKey: boolean }) {
  const authUser = useAuthStore(s => s.user);
  if (!needsKey) return null;

  if (cloudEnabled && !authUser) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Button
          onClick={() => useAuthStore.getState().promptSignIn()}
          className="h-11 rounded-full px-8 text-sm font-semibold w-full sm:w-auto"
        >
          Sign in to start building
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Free building is part of your invitation
        </p>
      </div>
    );
  }
  return (
    <p className="text-xs text-center text-muted-foreground">
      Add your API key in Settings to start building
    </p>
  );
}
