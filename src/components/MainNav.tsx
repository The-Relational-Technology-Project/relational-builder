import { ArrowLeft, FolderOpen, LayoutGrid, Plus } from 'lucide-react';
import { RBMark } from '@/components/RBMark';
import { Separator } from '@/components/ui/separator';
import { buttonVariants } from '@/components/ui/button';
import { ProjectMenu } from '@/components/ProjectMenu';
import { useUIStore, type AppView } from '@/store/ui-store';
import { useCurrentProjectName } from '@/lib/use-project-name';
import { startNewProject } from '@/project/new-project';

/**
 * The header's left side, which says two different things depending on where
 * you are.
 *
 * **In a project** it is about the project: the mark, then the project's name
 * carrying everything true about it. Nothing competes with the work.
 *
 * **On a page** (Gallery, Projects, your profile…) it is a way around: the
 * way back to the project you left, then the three destinations. Sync and
 * Share disappear on these pages — there is no project in front of you to
 * sync or share.
 *
 * The mark itself doesn't go anywhere. A wordmark that navigates competes
 * with the named ways back, and a menu hidden behind a logo is a menu people
 * don't find.
 */

function Wordmark() {
  return (
    <div className="flex items-center gap-1.5 shrink-0 select-none" title="Relational Builder">
      <RBMark className="size-5 shrink-0" />
      <h1 className="text-sm font-semibold tracking-tight whitespace-nowrap">
        Relational Builder
      </h1>
    </div>
  );
}

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Plus;
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
  const newProject = () => {
    startNewProject();
    setView('builder');
  };

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
          <NavButton icon={Plus} label="New project" onClick={newProject} />
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
