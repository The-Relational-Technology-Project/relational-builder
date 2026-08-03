/**
 * Starting fresh — the one place that decides what "a new project" clears.
 *
 * Lives outside the header because more than one door leads here now: the
 * nav's New Project, and the `/new` address someone can bookmark or type.
 * Never destructive: the work in progress is stashed on the local shelf
 * (cloud projects are already saved to the account) before anything clears.
 */

import { useChatStore } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';
import { useCloudStore } from '@/store/cloud-store';
import { useEnvStore } from '@/store/env-store';
import { stashAndStartFresh } from '@/project/local-projects';

export function startNewProject(): void {
  stashAndStartFresh();
  useCloudStore.getState().closeProject();
  useChatStore.getState().clearMessages();
  useProjectStore.getState().clearProject();
  // A fresh project starts with a fresh environment — service keys and
  // Community Cloud backends belong to the app they were connected for
  useEnvStore.getState().clearAll();
}
