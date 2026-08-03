import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useCloudStore } from '@/store/cloud-store';
import { useLocalProjects } from '@/project/local-projects';

/**
 * The name of the project currently on the desk, or null when there isn't one
 * yet. A project exists the moment there are files *or* a conversation — the
 * chat before the first file is still the project.
 *
 * Cloud projects are named on the account; everything else is named on the
 * local shelf. The header asks this on every page, which is why it lives here
 * rather than inside one of them.
 */
export function useCurrentProjectName(): string | null {
  const fileCount = useProjectStore(s => s.getFileCount());
  const messageCount = useChatStore(s => s.messages.length);
  const cloudProjectId = useCloudStore(s => s.currentProjectId);
  const cloudProjectName = useCloudStore(s => s.currentProjectName);
  const localName = useLocalProjects(s => s.currentName);

  if (fileCount === 0 && messageCount === 0) return null;
  return (cloudProjectId ? cloudProjectName : localName) || 'Untitled project';
}
