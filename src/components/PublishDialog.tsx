import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/store/project-store';
import { useDeployStore } from '@/store/deploy-store';
import { exportProjectZip, downloadBlob } from '@/project/export';
import { deployToNetlify } from '@/project/deploy-netlify';
import { deployToVercel } from '@/project/deploy-vercel';
import { Upload, Download, ExternalLink, Globe, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type DeployTarget = 'download' | 'netlify' | 'vercel';

interface DeployResult {
  url: string;
  adminUrl?: string;
}

export function PublishDialog() {
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState('my-community-app');
  const [activeTarget, setActiveTarget] = useState<DeployTarget>('download');
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<DeployResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getAllFiles = useProjectStore(s => s.getAllFiles);
  const fileCount = useProjectStore(s => s.getFileCount());

  const netlifyToken = useDeployStore(s => s.netlifyToken);
  const vercelToken = useDeployStore(s => s.vercelToken);
  const setNetlifyToken = useDeployStore(s => s.setNetlifyToken);
  const setVercelToken = useDeployStore(s => s.setVercelToken);

  const resetState = () => {
    setResult(null);
    setError(null);
    setDeploying(false);
  };

  const handleClose = (v: boolean) => {
    setOpen(v);
    if (!v) resetState();
  };

  const handleDeploy = async () => {
    const files = getAllFiles();
    if (files.length === 0) return;

    setDeploying(true);
    setError(null);
    setResult(null);

    try {
      if (activeTarget === 'download') {
        const blob = await exportProjectZip(files, projectName);
        const safeName = projectName.replace(/[^a-zA-Z0-9-_]/g, '-');
        downloadBlob(blob, `${safeName}.zip`);
        setResult({ url: '' }); // signals success for download
      } else if (activeTarget === 'netlify') {
        if (!netlifyToken) {
          setError('Please enter your Netlify access token');
          return;
        }
        const blob = await exportProjectZip(files, projectName);
        const res = await deployToNetlify(blob, projectName, netlifyToken);
        setResult({ url: res.siteUrl, adminUrl: res.adminUrl });
      } else if (activeTarget === 'vercel') {
        if (!vercelToken) {
          setError('Please enter your Vercel access token');
          return;
        }
        const res = await deployToVercel(files, projectName, vercelToken);
        setResult({ url: res.url, adminUrl: res.deploymentUrl });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  };

  const targets: { id: DeployTarget; label: string; icon: string }[] = [
    { id: 'download', label: 'Download', icon: '📦' },
    { id: 'netlify', label: 'Netlify', icon: '▲' },
    { id: 'vercel', label: 'Vercel', icon: '◆' },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger
        className={cn(
          "inline-flex items-center justify-center gap-1 rounded-md px-3 h-7 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
          fileCount === 0 && "opacity-50 pointer-events-none"
        )}
        disabled={fileCount === 0}
      >
        <Upload className="size-3" />
        Publish
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Project name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Project name</label>
            <Input
              value={projectName}
              onChange={e => { setProjectName(e.target.value); resetState(); }}
              placeholder="my-community-app"
              className="h-8 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {fileCount} file{fileCount !== 1 ? 's' : ''} with .reltech.yml manifest
            </p>
          </div>

          {/* Deploy target selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Deploy to</label>
            <div className="flex gap-1.5">
              {targets.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setActiveTarget(t.id); resetState(); }}
                  className={cn(
                    "flex-1 text-xs py-1.5 px-2 rounded-md border transition-colors text-center",
                    activeTarget === t.id
                      ? "border-foreground bg-foreground text-background font-medium"
                      : "border-border text-muted-foreground hover:border-foreground/50"
                  )}
                >
                  <span className="mr-1">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Token input for Netlify */}
          {activeTarget === 'netlify' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Netlify access token</label>
              <Input
                type="password"
                value={netlifyToken}
                onChange={e => setNetlifyToken(e.target.value)}
                placeholder="nfp_..."
                className="h-8 text-sm font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Get one at{' '}
                <a
                  href="https://app.netlify.com/user/applications#personal-access-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  app.netlify.com/user/applications
                </a>
              </p>
            </div>
          )}

          {/* Token input for Vercel */}
          {activeTarget === 'vercel' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Vercel access token</label>
              <Input
                type="password"
                value={vercelToken}
                onChange={e => setVercelToken(e.target.value)}
                placeholder="..."
                className="h-8 text-sm font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Get one at{' '}
                <a
                  href="https://vercel.com/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  vercel.com/account/tokens
                </a>
              </p>
            </div>
          )}

          {/* Deploy button */}
          <Button
            onClick={handleDeploy}
            disabled={deploying || !projectName.trim()}
            className="w-full gap-2"
          >
            {deploying ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {activeTarget === 'download' ? 'Packaging...' : 'Deploying...'}
              </>
            ) : activeTarget === 'download' ? (
              <>
                <Download className="size-4" />
                Download project zip
              </>
            ) : (
              <>
                <Globe className="size-4" />
                Deploy to {activeTarget === 'netlify' ? 'Netlify' : 'Vercel'}
              </>
            )}
          </Button>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Success — deployed */}
          {result && result.url && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Check className="size-3.5 text-green-600" />
                <p className="text-xs font-medium">Deployed successfully!</p>
              </div>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline hover:text-foreground flex items-center gap-1"
              >
                {result.url} <ExternalLink className="size-2.5" />
              </a>
            </div>
          )}

          {/* Success — download (no URL) */}
          {result && !result.url && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <p className="text-xs font-medium">Next steps to join the network:</p>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Unzip and push to a new GitHub repository</li>
                <li>
                  Add the{' '}
                  <code className="bg-muted px-1 rounded text-[11px]">relational-tech</code>{' '}
                  topic to your repo
                </li>
                <li>
                  The{' '}
                  <a
                    href="https://updates.relationaltechproject.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground inline-flex items-center gap-0.5"
                  >
                    network watcher <ExternalLink className="size-2.5" />
                  </a>{' '}
                  will discover your project automatically
                </li>
              </ol>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
