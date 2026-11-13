import { useStudioStore, approvedMemberships } from '@/store/studio-store';

/**
 * "Where does it go?" for the one Contribute door: the RT Commons, or any
 * studio the person belongs to. Nothing renders for someone in no studio,
 * so the commons form stays exactly as it was for them.
 */
export function ContributeDestinationRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (dest: string) => void;
}) {
  const memberships = useStudioStore(s => s.memberships);
  const studios = approvedMemberships(memberships);
  if (studios.length === 0) return null;
  const options = [
    { key: 'commons', label: 'RT Commons' },
    ...studios.map(m => ({ key: m.studio_slug, label: m.studio_label })),
  ];
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium">Where does it go?</p>
      <div className="flex flex-wrap gap-1">
        {options.map(o => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
              value === o.key
                ? 'bg-foreground text-background border-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
