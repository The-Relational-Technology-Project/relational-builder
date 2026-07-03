import { useEffect, useState } from 'react';
import { useKnowledgeStore } from '@/store/knowledge-store';
import { useChatStore } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';
import {
  listSharedBuildPlans,
  fetchStudioBuildPlan,
  studioPlanToMarkdown,
  type StudioBuildPlan,
} from '@/knowledge/studio-plans';
import { remixRepo } from '@/project/remix';
import { listNetworkPrompts, listMyPrompts, plantSharedPrompt, type NetworkPrompt } from '@/cloud/prompts';
import { useAuthStore } from '@/store/auth-store';
import { Badge } from '@/components/ui/badge';
import { Shuffle, FileDown, Loader2, ScrollText } from 'lucide-react';

type SharedPlan = Pick<StudioBuildPlan, 'id' | 'title' | 'recommended_track' | 'created_at'>;

/**
 * Start from the Studio — one-click starting points pulled live from the
 * RT Studio library. Remixable tools become your workspace (via the remix
 * flow); shared build plans land in chat as your starting draft. Lineage
 * travels either way. The field's answer to blank-page paralysis, with
 * the commons as the template library.
 */
export function StarterGallery({ disabled }: { disabled?: boolean }) {
  const tools = useKnowledgeStore(s => s.tools);
  const importBuildPlan = useChatStore(s => s.importBuildPlan);
  const setLineage = useProjectStore(s => s.setLineage);

  const [plans, setPlans] = useState<SharedPlan[]>([]);
  const [networkPrompts, setNetworkPrompts] = useState<NetworkPrompt[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = useAuthStore(s => s.user?.id);

  useEffect(() => {
    listSharedBuildPlans(4).then(setPlans).catch(() => {});
    // The network prompt library — other builders' shared seeds. Exclude
    // your own by slug (owner_id is no longer exposed to the client).
    Promise.all([
      listNetworkPrompts(8),
      userId ? listMyPrompts().catch(() => []) : Promise.resolve([]),
    ])
      .then(([all, mine]) => {
        const mySlugs = new Set(mine.map(p => p.share_slug).filter(Boolean));
        setNetworkPrompts(all.filter(p => !mySlugs.has(p.share_slug)).slice(0, 4));
      })
      .catch(() => {});
  }, [userId]);

  const remixable = tools.filter(t => t.github_url).slice(0, 6);
  if (remixable.length === 0 && plans.length === 0 && networkPrompts.length === 0) return null;

  async function startFromNetworkPrompt(p: NetworkPrompt) {
    setBusyId(p.share_slug);
    setError(null);
    try {
      const ok = await plantSharedPrompt(p.share_slug);
      if (!ok) throw new Error('That prompt is no longer shared');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not fetch that prompt');
    } finally {
      setBusyId(null);
    }
  }

  async function startFromTool(toolId: string, repo: string) {
    setBusyId(toolId);
    setError(null);
    try {
      await remixRepo(repo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not pull that project');
    } finally {
      setBusyId(null);
    }
  }

  async function startFromPlan(plan: SharedPlan) {
    setBusyId(plan.id);
    setError(null);
    try {
      const full = await fetchStudioBuildPlan(plan.id);
      if (!full) throw new Error('That plan is no longer shared');
      importBuildPlan(studioPlanToMarkdown(full));
      setLineage({
        source: 'rtp-studio-plan',
        planTitle: full.title,
        importedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not fetch that plan');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Start from the Studio
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {remixable.map(tool => (
          <button
            key={tool.id}
            disabled={disabled || busyId !== null}
            onClick={() => startFromTool(tool.id, tool.github_url!)}
            className="text-left border rounded-lg p-3 hover:bg-muted transition-colors disabled:opacity-50 space-y-1"
          >
            <div className="flex items-center gap-1.5">
              {busyId === tool.id ? (
                <Loader2 className="size-3 animate-spin shrink-0" />
              ) : (
                <Shuffle className="size-3 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs font-medium truncate">{tool.name}</span>
              <Badge variant="outline" className="text-[9px] ml-auto shrink-0">remix</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-2">
              {tool.summary ?? tool.description}
            </p>
          </button>
        ))}
        {plans.map(plan => (
          <button
            key={plan.id}
            disabled={disabled || busyId !== null}
            onClick={() => startFromPlan(plan)}
            className="text-left border rounded-lg p-3 hover:bg-muted transition-colors disabled:opacity-50 space-y-1"
          >
            <div className="flex items-center gap-1.5">
              {busyId === plan.id ? (
                <Loader2 className="size-3 animate-spin shrink-0" />
              ) : (
                <FileDown className="size-3 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs font-medium truncate">{plan.title}</span>
              <Badge variant="outline" className="text-[9px] ml-auto shrink-0">plan</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              A shared build plan from the Studio — lands in chat as your starting draft.
            </p>
          </button>
        ))}
        {networkPrompts.map(p => (
          <button
            key={p.share_slug}
            disabled={disabled || busyId !== null}
            onClick={() => startFromNetworkPrompt(p)}
            className="text-left border rounded-lg p-3 hover:bg-muted transition-colors disabled:opacity-50 space-y-1"
          >
            <div className="flex items-center gap-1.5">
              {busyId === p.share_slug ? (
                <Loader2 className="size-3 animate-spin shrink-0" />
              ) : (
                <ScrollText className="size-3 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs font-medium truncate">{p.title}</span>
              <Badge variant="outline" className="text-[9px] ml-auto shrink-0">prompt</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-2">
              {p.body}
            </p>
            {p.author_name && (
              <p className="text-[10px] text-muted-foreground/70">shared by {p.author_name}</p>
            )}
          </button>
        ))}
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">
        Live from the network — remix a working tool, start from a shared
        plan, or grow a shared prompt. Credit travels with your version.
      </p>
    </div>
  );
}
