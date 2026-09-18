import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/project-store';
import { useDeployStore } from '@/store/deploy-store';
import { useCloudStore } from '@/store/cloud-store';
import { useLocalProjects } from '@/project/local-projects';
import { cloudEnabled, useAuthStore } from '@/store/auth-store';
import { findLiveSiteByName } from '@/project/community-sites';
import { LiveSiteLink } from '@/components/LiveSiteLink';
import { PublishDialog } from '@/components/PublishDialog';
import { PromptDialog } from '@/components/PromptDialog';
import { SharePreview } from '@/components/SharePreview';
import { CollaborateDialog } from '@/components/CollaborateDialog';
import { ShareLiveDialog } from '@/components/ShareLiveDialog';
import { Share2, Upload, ScrollText, Eye, Users, ChevronDown, Presentation, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * One door for everything that sends a build into the world: Publish (a live
 * site), the build Prompt, a shareable preview link, and collaborators.
 * Consolidates what used to be four separate header buttons into a single
 * primary action. On mobile the menu sheet already plays that role, so the
 * actions render as flat buttons there instead of a nested dropdown.
 */
export function ShareMenu({ mobile }: { mobile?: boolean }) {
  const fileCount = useProjectStore(s => s.getFileCount());
  // The site this project already went live to, if any — the link a builder
  // came to Share for, offered first instead of behind Publish again
  const cloudProjectId = useCloudStore(s => s.currentProjectId);
  const localProjectId = useLocalProjects(s => s.currentId);
  const projectKey = cloudProjectId ?? localProjectId ?? 'local';
  const liveSite = useDeployStore(s => s.liveSites[projectKey]);
  const publishName = useDeployStore(s => s.publishNames[projectKey]);
  const setLiveSite = useDeployStore(s => s.setLiveSite);
  const signedIn = useAuthStore(s => Boolean(s.user));
  const publishLabel = liveSite ? 'Update live site' : 'Publish';

  // Sites published before the Builder kept the link locally: look it up
  // once by the remembered publish name so the menu can offer it
  useEffect(() => {
    if (liveSite || !publishName || !signedIn || !cloudEnabled) return;
    let cancelled = false;
    findLiveSiteByName(publishName).then(site => {
      if (cancelled || !site) return;
      setLiveSite(projectKey, {
        slug: site.slug,
        url: site.url,
        hasPassphrase: Boolean(site.has_passphrase),
        publishedAt: Date.parse(site.updated_at) || Date.now(),
      });
    });
    return () => { cancelled = true; };
  }, [liveSite, publishName, signedIn, projectKey, setLiveSite]);

  const [publishOpen, setPublishOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [collabOpen, setCollabOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);

  const dialogs = (
    <>
      {publishOpen && <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} />}
      {promptOpen && <PromptDialog open={promptOpen} onOpenChange={setPromptOpen} />}
      {previewOpen && <SharePreview open={previewOpen} onOpenChange={setPreviewOpen} />}
      {collabOpen && <CollaborateDialog open={collabOpen} onOpenChange={setCollabOpen} />}
      {liveOpen && <ShareLiveDialog open={liveOpen} onOpenChange={setLiveOpen} />}
    </>
  );

  if (mobile) {
    return (
      <>
        {liveSite && (
          <div className="w-full rounded-lg border bg-muted/40 p-2.5">
            <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 mb-1">
              <Globe className="size-3" />
              Live site
            </p>
            <LiveSiteLink url={liveSite.url} hasPassphrase={liveSite.hasPassphrase} />
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          disabled={fileCount === 0}
          onClick={() => setPublishOpen(true)}
        >
          <Upload className="size-3" />
          {publishLabel}
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setPromptOpen(true)}>
          <ScrollText className="size-3" />
          Prompt
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          disabled={fileCount === 0}
          onClick={() => setPreviewOpen(true)}
        >
          <Eye className="size-3" />
          Preview
        </Button>
        {cloudEnabled && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            disabled={fileCount === 0}
            onClick={() => setLiveOpen(true)}
          >
            <Presentation className="size-3" />
            Share Live
          </Button>
        )}
        {cloudEnabled && (
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setCollabOpen(true)}>
            <Users className="size-3" />
            Collaborate
          </Button>
        )}
        {dialogs}
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            // The one header action that makes the tool REAL — it reads as the
            // primary CTA, not another nav item
            'inline-flex items-center justify-center gap-1 rounded-full px-3.5 h-7 text-xs font-semibold transition-colors',
            'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
          )}
        >
          <Share2 className="size-3" />
          Share
          <ChevronDown className="size-3 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={liveSite ? 'w-64' : 'w-52'}>
          {liveSite && (
            <>
              <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 pb-0">
                <Globe className="size-3" />
                Live site
              </DropdownMenuLabel>
              {/* Not a menu item: clicking Copy must not close the menu before
                  "Copied" has a chance to show */}
              <div className="px-2 pb-2 pt-1">
                <LiveSiteLink url={liveSite.url} hasPassphrase={liveSite.hasPassphrase} />
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onClick={() => setPublishOpen(true)}
            disabled={fileCount === 0}
            className="gap-2 text-xs"
          >
            <Upload className="size-3.5 text-muted-foreground" />
            {publishLabel}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPromptOpen(true)} className="gap-2 text-xs">
            <ScrollText className="size-3.5 text-muted-foreground" />
            Prompt
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setPreviewOpen(true)}
            disabled={fileCount === 0}
            className="gap-2 text-xs"
          >
            <Eye className="size-3.5 text-muted-foreground" />
            Share preview
          </DropdownMenuItem>
          {cloudEnabled && (
            <DropdownMenuItem
              onClick={() => setLiveOpen(true)}
              disabled={fileCount === 0}
              className="gap-2 text-xs"
            >
              <Presentation className="size-3.5 text-muted-foreground" />
              Share Live
            </DropdownMenuItem>
          )}
          {cloudEnabled && (
            <DropdownMenuItem onClick={() => setCollabOpen(true)} className="gap-2 text-xs">
              <Users className="size-3.5 text-muted-foreground" />
              Collaborate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </>
  );
}
