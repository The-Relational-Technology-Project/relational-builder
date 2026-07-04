import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buttonVariants } from '@/components/ui/button';
import { ImportPlanDialog } from '@/components/ImportPlanDialog';
import { RemixDialog } from '@/components/RemixDialog';
import { Sparkles, FileDown, Shuffle, ChevronDown } from 'lucide-react';

/**
 * The primary way to start is the composer and the Studio gallery below it.
 * These are the quieter, less-common starts — importing a build plan or
 * forking a tool's actual code — folded into one unobtrusive menu so the
 * home toolbar stays about building, not about its own options.
 */
export function StartFromMenu() {
  const [importOpen, setImportOpen] = useState(false);
  const [remixOpen, setRemixOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' h-7 gap-1 text-xs'}
        >
          <Sparkles className="size-3" />
          Start from…
          <ChevronDown className="size-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onClick={() => setImportOpen(true)} className="gap-2 text-xs items-start py-2">
            <FileDown className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <span>
              <span className="font-medium block">A build plan</span>
              <span className="text-muted-foreground">Bring a plan from RTP Studio</span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRemixOpen(true)} className="gap-2 text-xs items-start py-2">
            <Shuffle className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <span>
              <span className="font-medium block">A tool's code</span>
              <span className="text-muted-foreground">Fork an existing repo to build on</span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ImportPlanDialog open={importOpen} onOpenChange={setImportOpen} hideTrigger />
      <RemixDialog open={remixOpen} onOpenChange={setRemixOpen} hideTrigger />
    </>
  );
}
