import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/store/project-store';
import { useDeployStore } from '@/store/deploy-store';
import { useEnvStore } from '@/store/env-store';
import { exportProjectZip, downloadBlob } from '@/project/export';
import { buildEnvJs } from '@/project/env-module';
import { needsBuild, buildStaticSite, materializeSource, vercelServerlessFiles, SERVERLESS_PATH } from '@/project/build-for-publish';
import { withAppIcons } from '@/project/app-icon';
import { publishToCommunityHosting } from '@/project/deploy-community';
import { HANDLE_RE, PROFILE_PROJECT_NAME, suggestHandle } from '@/project/builder-profile';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { useLocalProjects } from '@/project/local-projects';
import { getPromptForProject } from '@/cloud/prompts';
import { deployToNetlify } from '@/project/deploy-netlify';
import { deployToVercel } from '@/project/deploy-vercel';
import { deployToBunny } from '@/project/deploy-bunny';
import { deployToCodeberg } from '@/project/deploy-codeberg';
import { useRegionStore } from '@/store/region-store';
import { orderByRegion, regionBadge, regionalizeFiles, type ServiceHome } from '@/regions/regions';
import { Download, ExternalLink, Globe, Check, Loader2, Lock } from 'lucide-react';
import { LiveSiteLink } from './LiveSiteLink';
import { cn } from '@/lib/utils';
import { CommonsSubmitCard } from './CommonsSubmitCard';
import { StudioSubmitCard } from './StudioSubmitCard';
import { suggestProjectName } from '@/project/suggest-name';
import { runSecurityScan, type SecurityFinding } from '@/project/security-scan';
import { ShieldAlert } from 'lucide-react';

type DeployTarget = 'community' | 'download' | 'netlify' | 'vercel' | 'bunny' | 'codeberg';

/**
 * Every target with where it runs — regional modes rank the row by this
 * (src/regions). Download has no home: the files leave with the person.
 * Order matters twice: it's the row in the default mode (EU hosts filtered
 * out), and the tie-break inside each band once a regional mode ranks it —
 * so the EU hosts sit ahead of Download, and Download ahead of the US hosts.
 */
const TARGETS: { id: DeployTarget; label: string; icon: string; home?: ServiceHome }[] = [
  { id: 'community', label: 'Community', icon: '🌱', home: { company: 'US', euData: 'no', note: 'RTP\'s hosting runs on Supabase in the US.' } },
  { id: 'bunny', label: 'Bunny', icon: '🇪🇺', home: { company: 'SI', euData: 'yes', note: 'Files stored in Falkenstein, Germany; served from Bunny\'s European edge. About €1 a month.' } },
  { id: 'codeberg', label: 'Codeberg', icon: '🇪🇺', home: { company: 'DE', euData: 'yes', note: 'A Berlin non-profit, free. Your site is a public git repository.' } },
  { id: 'download', label: 'Download', icon: '📦' },
  { id: 'netlify', label: 'Netlify', icon: '▲', home: { company: 'US', euData: 'no' } },
  { id: 'vercel', label: 'Vercel', icon: '◆', home: { company: 'US', euData: 'no' } },
];

interface DnsInstruction {
  type: string;
  host: string;
  value: string;
}

interface DeployResult {
  url: string;
  adminUrl?: string;
  dnsInstructions?: DnsInstruction[];
  totalViews?: number;
  hasPassphrase?: boolean;
}

export function PublishDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  // Which project this publish belongs to — keyed like github-store repos
  const cloudProjectId = useCloudStore(s => s.currentProjectId);
  const localProjectId = useLocalProjects(s => s.currentId);
  const publishNameKey = cloudProjectId ?? localProjectId ?? 'local';
  const savedPublishName = useDeployStore(s => s.publishNames[publishNameKey]);
  const setPublishName = useDeployStore(s => s.setPublishName);
  const liveSite = useDeployStore(s => s.liveSites[publishNameKey]);
  const setLiveSite = useDeployStore(s => s.setLiveSite);
  const cloudProjectName = useCloudStore(s => s.currentProjectName);
  const localProjectName = useLocalProjects(s => s.currentName);

  // The name this project already published under wins — re-publishing is a
  // "save", not a "save as". Next comes the name the project is saved under
  // (renames included) — the builder already chose it, so don't fall back to
  // guessing from the first prompt. Only a nameless workspace gets a guess.
  // (Lazy init is enough: the dialog mounts fresh on each open.)
  const savedProjectName = ((cloudProjectId ? cloudProjectName : localProjectName) ?? '').trim();
  const [projectName, setProjectName] = useState(
    () => savedPublishName ?? (savedProjectName || null) ?? suggestProjectName() ?? 'my-community-app',
  );
  // EU mode: the EU hosts lead the row and are the default pick
  const regionMode = useRegionStore(s => s.mode);
  const [activeTarget, setActiveTarget] = useState<DeployTarget>(() =>
    useRegionStore.getState().mode === 'eu' ? 'bunny' : 'community',
  );
  // Community hosting only: non-empty sets/changes the site's passphrase;
  // empty means "no change" (removal lives in the Your Sites dashboard)
  const [passphrase, setPassphrase] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<DeployResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanFindings, setScanFindings] = useState<SecurityFinding[] | null>(null);

  const getAllFiles = useProjectStore(s => s.getAllFiles);
  const fileCount = useProjectStore(s => s.getFileCount());
  const lineage = useProjectStore(s => s.lineage);
  // The builder's public page publishes one way only: community hosting,
  // public, at /b/{handle}/ — the handle is the one thing to choose
  const isProfilePage = lineage?.source === 'builder-profile';
  const profile = useAuthStore(s => s.profile);
  const [handle, setHandle] = useState(
    () => liveSite?.slug ?? suggestHandle(profile?.display_name, useAuthStore.getState().user?.email),
  );

  const netlifyToken = useDeployStore(s => s.netlifyToken);
  const vercelToken = useDeployStore(s => s.vercelToken);
  const customDomain = useDeployStore(s => s.customDomain);
  const setNetlifyToken = useDeployStore(s => s.setNetlifyToken);
  const setVercelToken = useDeployStore(s => s.setVercelToken);
  const setCustomDomain = useDeployStore(s => s.setCustomDomain);
  const bunnyAccountKey = useDeployStore(s => s.bunnyAccountKey);
  const setBunnyAccountKey = useDeployStore(s => s.setBunnyAccountKey);
  const bunnySite = useDeployStore(s => s.bunnySites[publishNameKey]);
  const setBunnySite = useDeployStore(s => s.setBunnySite);
  const codebergToken = useDeployStore(s => s.codebergToken);
  const setCodebergToken = useDeployStore(s => s.setCodebergToken);
  const codebergSite = useDeployStore(s => s.codebergSites[publishNameKey]);
  const setCodebergSite = useDeployStore(s => s.setCodebergSite);

  const envVars = useEnvStore(s => s.vars);
  const envRecord = Object.fromEntries(envVars.map(v => [v.key, v.value]));
  const publicEnvVars = envVars.filter(v => !v.isSecret).map(v => ({ key: v.key, value: v.value }));
  const user = useAuthStore(s => s.user);

  const resetState = () => {
    setResult(null);
    setError(null);
    setDeploying(false);
    setScanFindings(null);
  };

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) resetState();
  };

  const handleDeploy = async (skipScan = false) => {
    const files = getAllFiles();
    if (files.length === 0) return;

    // Publish-time security check: warn (with specifics) before anything
    // secret-shaped ships in public code; the builder decides from there
    if (!skipScan) {
      const findings = runSecurityScan(files);
      if (findings.length > 0) {
        setScanFindings(findings);
        return;
      }
    }
    setScanFindings(null);

    setDeploying(true);
    setError(null);
    setResult(null);

    try {
      // The build prompt ships in .reltech.yml when this project has one —
      // the code and the seed travel together
      const buildPrompt = cloudProjectId
        ? await getPromptForProject(cloudProjectId).catch(() => null)
        : null;

      // Framework projects build to static files first — hosting targets get
      // the RUNNING site (same output the preview shows); Download gets the
      // SOURCE plus a working Vite scaffold for npm install && npm run dev.
      const isFramework = needsBuild(files);
      // Regional mode rewrites (EU: Google Fonts → Bunny Fonts) apply to
      // whatever ships — buildStaticSite does it for framework output, the
      // simple-tool path gets it here
      const builtFiles = isFramework
        ? await buildStaticSite(files, publicEnvVars)
        : regionalizeFiles(files, regionMode);
      // Every hosted site ships home-screen icons (manifest + apple-touch-icon)
      // unless the project brings its own. Serverless sources stay out of the
      // static file set on every target — Vercel gets its `api/*` functions
      // appended below, where they actually run.
      const siteFiles = withAppIcons(builtFiles, projectName).filter(f => !SERVERLESS_PATH.test(f.path));

      if (activeTarget === 'community') {
        const res = await publishToCommunityHosting(
          siteFiles,
          isProfilePage ? PROFILE_PROJECT_NAME : projectName,
          publicEnvVars,
          passphrase,
          isProfilePage ? { handle: handle.trim().toLowerCase() } : undefined,
        );
        setResult({ url: res.url, totalViews: res.total_views, hasPassphrase: res.has_passphrase });
        setLiveSite(publishNameKey, {
          slug: res.slug,
          url: res.url,
          hasPassphrase: Boolean(res.has_passphrase),
          publishedAt: Date.now(),
        });
      } else if (activeTarget === 'download') {
        const sourceFiles = isFramework ? materializeSource(files) : files;
        const blob = await exportProjectZip(sourceFiles, projectName, lineage, publicEnvVars, buildPrompt);
        const safeName = projectName.replace(/[^a-zA-Z0-9-_]/g, '-');
        downloadBlob(blob, `${safeName}.zip`);
        setResult({ url: '' }); // signals success for download
      } else if (activeTarget === 'netlify') {
        if (!netlifyToken) {
          setError('Please enter your Netlify access token');
          return;
        }
        const blob = await exportProjectZip(siteFiles, projectName, lineage, publicEnvVars, buildPrompt);
        const domain = customDomain.trim() || undefined;
        const res = await deployToNetlify(blob, projectName, netlifyToken, envRecord, domain);
        setResult({ url: res.siteUrl, adminUrl: res.adminUrl, dnsInstructions: res.dnsInstructions });
      } else if (activeTarget === 'vercel') {
        if (!vercelToken) {
          setError('Please enter your Vercel access token');
          return;
        }
        const domain = customDomain.trim() || undefined;
        const filesWithEnv =
          publicEnvVars.length > 0 && !siteFiles.some(f => f.path.replace(/^\//, '') === 'env.js')
            ? [...siteFiles, { path: '/env.js', content: buildEnvJs(publicEnvVars), language: 'javascript', createdAt: Date.now(), updatedAt: Date.now() }]
            : siteFiles;
        // `api/*` sources ride along un-bundled: Vercel's file-system routing
        // compiles them into serverless functions (secrets reach them as
        // project env vars, set inside deployToVercel)
        const res = await deployToVercel(
          [...filesWithEnv, ...vercelServerlessFiles(files)],
          projectName, vercelToken, envRecord, domain,
        );
        setResult({ url: res.url, adminUrl: res.deploymentUrl, dnsInstructions: res.dnsInstructions });
      } else if (activeTarget === 'bunny') {
        if (!bunnyAccountKey) {
          setError('Please enter your Bunny account API key');
          return;
        }
        const domain = customDomain.trim() || undefined;
        const res = await deployToBunny(siteFiles, projectName, bunnyAccountKey, bunnySite, domain);
        setBunnySite(publishNameKey, res.site);
        setResult({ url: res.siteUrl, adminUrl: res.adminUrl, dnsInstructions: res.dnsInstructions });
      } else if (activeTarget === 'codeberg') {
        if (!codebergToken) {
          setError('Please enter your Codeberg access token');
          return;
        }
        const domain = customDomain.trim() || undefined;
        const res = await deployToCodeberg(siteFiles, projectName, codebergToken, codebergSite, domain);
        setCodebergSite(publishNameKey, res.site);
        setResult({ url: res.siteUrl, adminUrl: res.adminUrl, dnsInstructions: res.dnsInstructions });
      }

      // Published under this name — remember it for the next publish
      setPublishName(publishNameKey, projectName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  };

  // Default mode shows the four the dialog always had; the EU hosts appear
  // once EU mode is on, ranked first (orderByRegion keeps catalog order
  // inside each band, so Bunny then Codeberg, then Download, then the US
  // targets). Profile pages publish one way only.
  const targets = isProfilePage
    ? TARGETS.filter(t => t.id === 'community')
    : orderByRegion(
        regionMode === 'eu' ? TARGETS : TARGETS.filter(t => t.id !== 'bunny' && t.id !== 'codeberg'),
        regionMode,
      );
  const activeHome = TARGETS.find(t => t.id === activeTarget)?.home;
  const activeBadge = regionBadge(activeHome, regionMode);
  const handleOk = HANDLE_RE.test(handle.trim().toLowerCase());

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Put it out there</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Project name — or, for the builder's page, the handle */}
          {isProfilePage ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Your handle</label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground shrink-0">relationalbuilder.org/b/</span>
                <Input
                  value={handle}
                  onChange={e => { setHandle(e.target.value); resetState(); }}
                  placeholder="your-name"
                  className="h-8 text-sm"
                  spellCheck={false}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {liveSite
                  ? 'Publishing again replaces your page. A new handle moves it and frees the old address.'
                  : 'Lowercase letters, digits, and hyphens, 3 to 32 characters. This becomes your public address, and search engines will index the page.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Project name</label>
              <Input
                value={projectName}
                onChange={e => { setProjectName(e.target.value); resetState(); }}
                placeholder="my-community-app"
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {fileCount} file{fileCount !== 1 ? 's' : ''} with .reltech.yml manifest
              </p>
            </div>
          )}

          {/* Deploy target selector */}
          {!isProfilePage && <div className="space-y-1.5">
            <label className="text-xs font-medium">Deploy to</label>
            <div className="flex flex-wrap gap-1.5">
              {targets.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setActiveTarget(t.id); resetState(); }}
                  className={cn(
                    "flex-1 text-xs py-1.5 px-2 rounded-md border transition-colors text-center min-w-[5.5rem]",
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
            {/* Where the chosen host runs, in EU mode — honest either way */}
            {activeBadge && activeHome && (
              <p className={cn('text-xs', activeHome.euData === 'yes' ? 'text-green-700' : 'text-amber-700')}>
                {activeBadge}{activeHome.note ? ` — ${activeHome.note}` : ''}
              </p>
            )}
          </div>}

          {/* Already live: the link first, so Share and Publish both answer
              "where is it?" — publishing again updates this same site */}
          {activeTarget === 'community' && liveSite && !result && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Globe className="size-3.5 text-green-700" />
                Live on community hosting
              </p>
              <LiveSiteLink url={liveSite.url} hasPassphrase={liveSite.hasPassphrase} />
              <p className="text-xs text-muted-foreground">
                Publishing again replaces what's at this link with your current build.
              </p>
            </div>
          )}

          {/* Community hosting info */}
          {activeTarget === 'community' && !liveSite && !isProfilePage && (
            <div className="rounded-lg border border-dashed border-green-600/40 bg-green-600/5 p-3 space-y-1">
              <p className="text-xs font-medium">🌱 Free hosting from the Relational Tech Project</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                One click, no accounts or tokens — your app goes live at a shareable
                link with simple visit counts. Every builder gets 10 sites
                (republish anytime by using the same name).
                {!cloudEnabled ? ' Community hosting needs the cloud backend configured.' : !user ? ' Sign in (top right) to publish.' : ''}
              </p>
            </div>
          )}

          {/* Private site (community hosting only; never a builder page) */}
          {activeTarget === 'community' && !isProfilePage && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1">
                <Lock className="size-3" />
                Passphrase{' '}
                <span className="text-muted-foreground font-normal">(optional — makes the site private)</span>
              </label>
              <Input
                value={passphrase}
                onChange={e => { setPassphrase(e.target.value); resetState(); }}
                placeholder="Leave empty for a public site"
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Visitors unlock the site once with this passphrase and stay in for
                30 days — checked on the server, never in your page's code. When
                republishing, leaving this empty keeps the current passphrase;
                remove or change it anytime from Your Sites.
              </p>
            </div>
          )}

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
              <p className="text-xs text-muted-foreground">
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
              <p className="text-xs text-muted-foreground">
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

          {/* Bunny: account key creates the zones; the per-site upload key is remembered */}
          {activeTarget === 'bunny' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Bunny account API key</label>
              <Input
                type="password"
                value={bunnyAccountKey}
                onChange={e => setBunnyAccountKey(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="h-8 text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">
                From{' '}
                <a
                  href="https://dash.bunny.net/account/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  dash.bunny.net → Account → API
                </a>
                . The first publish creates a storage zone in Germany and a CDN
                zone serving Europe only; later publishes update the same site.
              </p>
              {bunnySite && (
                <p className="text-xs text-muted-foreground">
                  Live at <span className="font-mono">{bunnySite.hostname}</span> — publishing again replaces it.
                </p>
              )}
            </div>
          )}

          {/* Codeberg: a token with write:repository + write:user */}
          {activeTarget === 'codeberg' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Codeberg access token</label>
              <Input
                type="password"
                value={codebergToken}
                onChange={e => setCodebergToken(e.target.value)}
                placeholder="..."
                className="h-8 text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">
                From{' '}
                <a
                  href="https://codeberg.org/user/settings/applications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  codeberg.org → Settings → Applications
                </a>
                {' '}with <span className="font-mono">write:repository</span> and{' '}
                <span className="font-mono">write:user</span>. The site becomes a
                public repository with a <span className="font-mono">pages</span> branch,
                served by Codeberg Pages within a few minutes.
              </p>
              {codebergSite && (
                <p className="text-xs text-muted-foreground">
                  Repository <span className="font-mono">{codebergSite.owner}/{codebergSite.repo}</span> — publishing again commits to it.
                </p>
              )}
            </div>
          )}

          {/* Custom domain (for the token-based hosts) */}
          {(activeTarget === 'netlify' || activeTarget === 'vercel' || activeTarget === 'bunny' || activeTarget === 'codeberg') && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Custom domain{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                value={customDomain}
                onChange={e => { setCustomDomain(e.target.value); resetState(); }}
                placeholder="myapp.ourneighborhood.org"
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                You'll need to update DNS records with your domain registrar after deploying.
              </p>
            </div>
          )}

          {/* Security scan findings — read before shipping */}
          {scanFindings && scanFindings.length > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 space-y-2">
              <p className="text-xs font-medium text-destructive flex items-center gap-1.5">
                <ShieldAlert className="size-3.5" />
                Hold on — this looks like it would ship a secret
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {scanFindings.slice(0, 8).map((f, i) => (
                  <p key={i} className="text-xs text-destructive/90">
                    <span className="font-mono">{f.path}:{f.line}</span> — {f.issue}
                    <span className="block font-mono text-xs opacity-70 truncate">{f.snippet}</span>
                  </p>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Anything published is public. Move secrets to the Env tab (marked
                secret) and ask the AI to use <code>env</code> instead — or publish
                anyway if you're sure these are safe.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setScanFindings(null)}>
                  Let me fix it first
                </Button>
                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleDeploy(true)}>
                  Publish anyway
                </Button>
              </div>
            </div>
          )}

          {/* Deploy button */}
          <Button
            onClick={() => handleDeploy()}
            disabled={deploying || (isProfilePage ? !handleOk : !projectName.trim()) || (activeTarget === 'community' && (!cloudEnabled || !user))}
            className="w-full gap-2"
          >
            {deploying ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {activeTarget === 'download' ? 'Packaging...' : 'Deploying...'}
              </>
            ) : activeTarget === 'community' ? (
              <>
                <Globe className="size-4" />
                {liveSite ? 'Update the live site' : 'Publish to community hosting'}
              </>
            ) : activeTarget === 'download' ? (
              <>
                <Download className="size-4" />
                Download project zip
              </>
            ) : (
              <>
                <Globe className="size-4" />
                {activeTarget === 'bunny' && bunnySite
                  ? 'Update the site on Bunny'
                  : activeTarget === 'codeberg' && codebergSite
                    ? 'Update the site on Codeberg'
                    : `Deploy to ${TARGETS.find(t => t.id === activeTarget)?.label ?? activeTarget}`}
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
                <p className="text-xs font-medium">
                  {activeTarget === 'community' ? "It's live — here's the link to share" : 'Deployed successfully!'}
                </p>
              </div>
              {activeTarget === 'community' ? (
                <LiveSiteLink url={result.url} />
              ) : (
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline hover:text-foreground flex items-center gap-1"
                >
                  {result.url} <ExternalLink className="size-2.5" />
                </a>
              )}
              {result.totalViews !== undefined && result.totalViews > 0 && (
                <p className="text-xs text-muted-foreground">
                  {result.totalViews.toLocaleString()} visit{result.totalViews === 1 ? '' : 's'} so far
                </p>
              )}
              {result.hasPassphrase && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="size-3 shrink-0" />
                  Private site — share the passphrase alongside the link.
                </p>
              )}

              {/* DNS instructions for custom domain */}
              {result.dnsInstructions && result.dnsInstructions.length > 0 && (
                <div className="mt-2 pt-2 border-t space-y-1.5">
                  <p className="text-xs font-medium">DNS setup for your custom domain:</p>
                  <p className="text-xs text-muted-foreground">
                    Add {result.dnsInstructions.length === 1 ? 'this record' : 'these records'} with your domain registrar:
                  </p>
                  <div className="bg-background rounded border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="px-2 py-1 text-left font-medium">Type</th>
                          <th className="px-2 py-1 text-left font-medium">Host</th>
                          <th className="px-2 py-1 text-left font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.dnsInstructions.map((dns, i) => (
                          <tr key={i} className="font-mono">
                            <td className="px-2 py-1">{dns.type}</td>
                            <td className="px-2 py-1">{dns.host}</td>
                            <td className="px-2 py-1 truncate max-w-[180px]">{dns.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    DNS changes can take up to 48 hours to propagate. SSL is automatic.
                  </p>
                </div>
              )}
            </div>
          )}


          {/* Success — download (no URL) */}
          {result && !result.url && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <p className="text-xs font-medium">Next steps to join the network:</p>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Unzip and push to a new repository (GitHub, GitLab, or your community's forge)</li>
                <li>
                  Add the{' '}
                  <code className="bg-muted px-1 rounded text-xs">relational-tech</code>{' '}
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

          {/* Offer back to your studio's gallery (gated-studio members) —
              the studio remix loop's on-ramp */}
          <StudioSubmitCard projectName={projectName} sourceUrl={result?.url || undefined} />

          {/* Offer to the commons — always available, deploy or not */}
          <CommonsSubmitCard projectName={projectName} sourceUrl={result?.url || undefined} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
