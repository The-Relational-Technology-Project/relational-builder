import { ArrowLeft, FolderOpen, LayoutGrid } from 'lucide-react';
import { RBMark } from '@/components/RBMark';
import { Separator } from '@/components/ui/separator';
import { buttonVariants } from '@/components/ui/button';
import { ProjectMenu } from '@/components/ProjectMenu';
import { useUIStore, type AppView } from '@/store/ui-store';
import { useCurrentProjectName } from '@/lib/use-project-name';

/**
 * The header's left side, which says two different things depending on where
 * you are.
 *
 * **In a project** it is about the project: the mark, then the project's name
 * carrying everything true about it. Nothing competes with the work.
 *
 * **On a page** (Home, Gallery, Projects, your profile…) it is a way around:
 * the way back to the project you left, then the destinations. Sync and
 * Share disappear on these pages — there is no project in front of you to
 * sync or share.
 *
 * The mark goes Home — the web's oldest convention, and the one door that's
 * always in the same place. It points *away* from the project while the
 * named pill points back, so the two never compete. (It used to go nowhere:
 * that made sense when Home wasn't a place you could stand while a project
 * stayed open — now it is, and starting something new lives there.)
 */

function Wordmark() {
  const setView = useUIStore(s => s.setView);
  return (
    <button
      onClick={() => setView('home')}
      title="Home"
      className="flex items-center gap-1.5 shrink-0 select-none rounded-md -mx-1 px-1 py-0.5 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <RBMark className="size-5 shrink-0" />
      <h1 className="text-sm font-semibold tracking-tight whitespace-nowrap">
        Relational Builder
      </h1>
    </button>
  );
}

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof FolderOpen;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        buttonVariants({ variant: active ? 'secondary' : 'ghost', size: 'sm' }) +
        ' h-7 gap-1 text-xs shrink-0'
      }
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

export function MainNav() {
  const view = useUIStore(s => s.view);
  const setView = useUIStore(s => s.setView);
  const projectName = useCurrentProjectName();

  const go = (next: AppView) => () => setView(next);

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Wordmark />
      <Separator orientation="vertical" className="h-5 shrink-0" />

      {view === 'builder' ? (
        // A project in front of you: its name is the nav. With nothing built
        // yet there is no project to name, so the destinations stand in.
        projectName !== null ? (
          <ProjectMenu />
        ) : (
          <>
            <NavButton icon={FolderOpen} label="Your projects" onClick={go('projects')} />
            <NavButton icon={LayoutGrid} label="Gallery" onClick={go('gallery')} />
          </>
        )
      ) : (
        <>
          {projectName !== null && (
            <button
              onClick={go('builder')}
              title="Back to this project"
              className="group flex items-center gap-1.5 min-w-0 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs font-medium text-foreground/80 shadow-xs transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="size-3 shrink-0 text-muted-foreground group-hover:text-foreground" />
              <span className="max-w-[180px] truncate">{projectName}</span>
            </button>
          )}
          {/* No "New project" button: starting something new is what Home's
              composer is — one door, not two labels for it */}
          <NavButton
            icon={FolderOpen}
            label="Your projects"
            active={view === 'projects'}
            onClick={go('projects')}
          />
          <NavButton
            icon={LayoutGrid}
            label="Gallery"
            active={view === 'gallery'}
            onClick={go('gallery')}
          />
        </>
      )}
    </div>
  );
}
