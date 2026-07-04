import { useStudioStore } from '@/store/studio-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

/**
 * The studio frame you're building in. Every project builds inside a studio
 * (Relational Tech Studio to start) with the global commons underneath —
 * the studio's principles and lineage travel with your project. Studios not
 * yet listed publicly stay reachable by deep link (?studio=slug), and if one
 * is active it appears here so its members can see where they are.
 */
export function StudioSwitcher() {
  const activeStudio = useStudioStore(s => s.activeStudio);
  const studios = useStudioStore(s => s.studios);
  const setStudio = useStudioStore(s => s.setStudio);

  if (!activeStudio) return null;

  // A deep-linked studio that isn't publicly listed still shows for its members
  const options = studios.some(s => s.slug === activeStudio.slug)
    ? studios
    : [activeStudio, ...studios];

  // Progressive disclosure: the switcher only earns toolbar space when there's
  // an actual choice — more than one studio, or a non-default one deep-linked
  // in. For everyone building in the default Relational Tech Studio, it's just
  // a non-actionable label, so we hide it.
  const isDefaultOnly = options.length <= 1 && activeStudio.slug === 'rt';
  if (isDefaultOnly) return null;

  return (
    <Select
      value={activeStudio.slug}
      onValueChange={(value) => {
        const studio = options.find(s => s.slug === value);
        if (studio) setStudio(studio);
      }}
    >
      <SelectTrigger className="h-7 w-auto gap-1.5 border-dashed text-xs px-2">
        <span
          className="size-2 rounded-full shrink-0"
          style={{ background: activeStudio.color ?? 'hsl(var(--muted-foreground))' }}
        />
        <span className="hidden lg:inline truncate max-w-36">
          {activeStudio.label}
        </span>
      </SelectTrigger>
      <SelectContent className="max-w-64">
        <p className="px-2 py-1.5 text-xs leading-snug text-muted-foreground">
          Your studio — its principles and lineage travel with everything you build.
        </p>
        {options.map(studio => (
          <SelectItem key={studio.slug} value={studio.slug}>
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span
                className="size-2 rounded-full shrink-0"
                style={{ background: studio.color ?? 'hsl(var(--muted-foreground))' }}
              />
              {studio.label}
            </span>
          </SelectItem>
        ))}
        <p className="px-2 pt-1.5 pb-1 text-xs text-muted-foreground/70 border-t mt-1">
          More studios on the way
        </p>
      </SelectContent>
    </Select>
  );
}
