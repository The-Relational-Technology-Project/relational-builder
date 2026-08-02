import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUIStore } from '@/store/ui-store';
import { RBMark } from '@/components/RBMark';
import { ArrowLeft, ChevronDown, FolderOpen, LayoutGrid, Plus } from 'lucide-react';

/**
 * The wordmark, doubling as the one door to everywhere else.
 *
 * New Project, Gallery, and Projects used to sit in the header as three
 * peers of Share. They read as equals, so the eye had four candidates for
 * "the thing to press" — and on a mid-width window the row clipped. They're
 * all "go somewhere else", which is exactly what a logo means on the web, so
 * they live here now and Share is left alone as the header's one action.
 *
 * The wordmark still gets you home: "Back to building" is the first item
 * whenever you're off the builder, and the project pill next door remains a
 * one-click route back.
 */
export function AppNavMenu({ onNewProject }: { onNewProject: () => void }) {
  const view = useUIStore(s => s.view);
  const setView = useUIStore(s => s.setView);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="group flex items-center gap-1.5 shrink-0 rounded-md px-1 -mx-1 py-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Projects, gallery, and a new build"
      >
        <RBMark className="size-5 shrink-0" />
        <h1 className="text-sm font-semibold tracking-tight whitespace-nowrap">
          Relational Builder
        </h1>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {view !== 'builder' && (
          <>
            <DropdownMenuItem onSelect={() => setView('builder')}>
              <ArrowLeft className="size-3.5" />
              Back to building
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={onNewProject}>
          <Plus className="size-3.5" />
          New project
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setView('projects')}>
          <FolderOpen className="size-3.5" />
          Your projects
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setView('gallery')}>
          <LayoutGrid className="size-3.5" />
          Gallery
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
