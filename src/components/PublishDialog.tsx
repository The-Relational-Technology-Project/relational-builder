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
import { exportProjectZip, downloadBlob } from '@/project/export';
import { Upload, Download, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PublishDialog() {
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState('my-community-app');
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const getAllFiles = useProjectStore(s => s.getAllFiles);
  const fileCount = useProjectStore(s => s.getFileCount());

  const handleExport = async () => {
    const files = getAllFiles();
    if (files.length === 0) return;

    setExporting(true);
    try {
      const blob = await exportProjectZip(files, projectName);
      const safeName = projectName.replace(/[^a-zA-Z0-9-_]/g, '-');
      downloadBlob(blob, `${safeName}.zip`);
      setExported(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setExported(false); }}>
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
          <DialogTitle>Publish to Commons</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-xs font-medium">Project name</label>
            <Input
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="my-community-app"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium">What's included</label>
            <p className="text-xs text-muted-foreground">
              {fileCount} project file{fileCount !== 1 ? 's' : ''}, a{' '}
              <code className="bg-muted px-1 rounded text-[11px]">.reltech.yml</code>{' '}
              manifest, and a README.
            </p>
          </div>

          <Button
            onClick={handleExport}
            disabled={exporting || !projectName.trim()}
            className="w-full gap-2"
          >
            <Download className="size-4" />
            {exporting ? 'Packaging...' : 'Download project zip'}
          </Button>

          {exported && (
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
