import { useStudioStore } from '@/store/studio-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

const GLOBAL = '__global__';

/**
 * Choose the frame you're building in: the global commons (default) or a
 * Studio from the network. The studio's principles layer onto the base in
 * the AI's context, and the studio travels in the project's lineage.
 */
export function StudioSwitcher() {
  const activeStudio = useStudioStore(s => s.activeStudio);
  const studios = useStudioStore(s => s.studios);
  const setStudio = useStudioStore(s => s.setStudio);

  // Nothing to switch between until the studio list loads
  if (studios.length === 0 && !activeStudio) return null;

  return (
    <Select
      value={activeStudio?.slug ?? GLOBAL}
      onValueChange={(value) => {
        if (value === GLOBAL) return setStudio(null);
        const studio = studios.find(s => s.slug === value);
        if (studio) setStudio(studio);
      }}
    >
      <SelectTrigger
        className="h-7 w-auto gap-1.5 border-dashed text-xs px-2"
        title="Build within a studio's frame — its principles and lineage travel with your project"
      >
        <span
          className="size-2 rounded-full shrink-0"
          style={{ background: activeStudio?.color ?? 'hsl(var(--muted-foreground))' }}
        />
        <span className="hidden lg:inline truncate max-w-28">
          {activeStudio?.label ?? 'Global commons'}
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={GLOBAL}>
          <span className="text-xs">Global commons (no studio)</span>
        </SelectItem>
        {studios.map(studio => (
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
      </SelectContent>
    </Select>
  );
}
