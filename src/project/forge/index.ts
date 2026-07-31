/**
 * Forge registry: metadata for the connect UI and a client factory.
 */

import type { ForgeClient, ForgeId, ForgeMeta } from './types';
import { GitHubClient } from './github';
import { GitLabClient } from './gitlab';
import { ForgejoClient } from './forgejo';

export * from './types';

export const FORGES: Record<ForgeId, ForgeMeta> = {
  github: {
    id: 'github',
    name: 'GitHub',
    defaultBaseUrl: 'https://github.com',
    needsInstanceUrl: false,
    tokenPlaceholder: 'ghp_...',
    tokenHelp: 'Needs the repo scope.',
    tokenUrl: () =>
      'https://github.com/settings/tokens/new?scopes=repo&description=Relational+Builder',
  },
  gitlab: {
    id: 'gitlab',
    name: 'GitLab',
    defaultBaseUrl: 'https://gitlab.com',
    needsInstanceUrl: false,
    tokenPlaceholder: 'glpat-...',
    tokenHelp: 'Needs the api scope.',
    tokenUrl: baseUrl =>
      `${baseUrl.replace(/\/$/, '')}/-/user_settings/personal_access_tokens?scopes=api&name=Relational+Builder`,
  },
  forgejo: {
    id: 'forgejo',
    name: 'Forgejo / Gitea',
    defaultBaseUrl: null,
    needsInstanceUrl: true,
    tokenPlaceholder: 'Access token',
    tokenHelp: 'Needs repository and user read/write scopes.',
    tokenUrl: baseUrl => `${baseUrl.replace(/\/$/, '')}/user/settings/applications`,
  },
};

/**
 * A client for a forge. `baseUrl` matters for GitLab (self-managed) and
 * Forgejo/Gitea (always self-chosen); GitHub ignores it.
 */
export function forgeClient(forge: ForgeId, baseUrl?: string): ForgeClient {
  switch (forge) {
    case 'github':
      return new GitHubClient();
    case 'gitlab':
      return new GitLabClient(baseUrl || 'https://gitlab.com');
    case 'forgejo': {
      if (!baseUrl) throw new Error('A Forgejo/Gitea connection needs an instance URL');
      return new ForgejoClient(baseUrl);
    }
  }
}
