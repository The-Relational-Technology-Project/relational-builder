import { useProvenanceStore, summarizeRows } from './provenance-store';
import { ENERGY_METHOD_VERSION } from './provenance';

/**
 * One line in the build report: what this project's building cost in model
 * calls, with the energy figure marked as the estimate it is. Rendered only
 * behind the human-scale flag (the caller checks).
 */
export function FootprintLine({ projectId }: { projectId: string | null }) {
  const rows = useProvenanceStore(s => s.rows);
  const mine = rows.filter(r => r.projectId === projectId);
  if (mine.length === 0) return null;
  const s = summarizeRows(mine);
  const energy = s.energyWhEstimate === null
    ? `energy not estimated (${s.unestimated === s.calls ? 'these models’ sizes are not public' : 'some model sizes are not public'})`
    : `about ${s.energyWhEstimate} Wh, an estimate (${ENERGY_METHOD_VERSION})${s.unestimated ? `, ${s.unestimated} call${s.unestimated === 1 ? '' : 's'} not estimated` : ''}`;
  return (
    <p className="text-xs text-muted-foreground leading-relaxed" data-testid="footprint-line">
      <span className="font-medium text-foreground">Footprint</span> · {s.calls} model {s.calls === 1 ? 'call' : 'calls'} on {s.models.join(', ')} · about {Math.round((s.tokensIn + s.tokensOut) / 1000)}k tokens (estimated from text length) · {energy}.
    </p>
  );
}
