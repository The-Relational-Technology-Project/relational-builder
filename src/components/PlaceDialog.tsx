import { useEffect, useState } from 'react';
import { MapPin, Loader2, Trash2, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProjectStore } from '@/store/project-store';
import {
  CATCHMENT_RADII_MILES,
  DEFAULT_CATCHMENT_MILES,
  catchmentFromGeoJson,
  centroidOfRings,
  describeCatchment,
  geocodePlace,
  resolveBoundary,
  type Catchment,
  type CatchmentSource,
  type GeoPoint,
} from '@/knowledge/geo';
import type { ProjectPlace } from '@/project/place';

/**
 * Where this software lives and the area it serves. Opened from the project
 * menu. Everything here is the builder's own call: the place is typed (or
 * left empty), the catchment is a radius, a ZIP, a named boundary from
 * OpenStreetMap, or a GeoJSON boundary pasted from anywhere (a watershed
 * from USGS, a bioregion from One Earth, a shape drawn at geojson.io), and
 * the public switch is off until they turn it on.
 *
 * Saved onto the project's lineage (project/place), where it reaches the
 * prompt at once and the repo, the published site, and the commons when
 * those happen.
 */

type ServesMode = 'radius' | 'zip' | 'boundary' | 'geojson';

const SERVES_MODES: { id: ServesMode; label: string; hint: string }[] = [
  { id: 'radius', label: 'A radius', hint: 'So many miles around the place' },
  { id: 'zip', label: 'A ZIP or postcode', hint: 'A boundary from OpenStreetMap where one exists, a radius where not' },
  { id: 'boundary', label: 'A neighborhood or town', hint: 'Its official boundary from OpenStreetMap' },
  { id: 'geojson', label: 'A boundary I bring', hint: 'A watershed, a bioregion, or a shape you drew, as GeoJSON' },
];

const GEOJSON_SOURCES: { id: CatchmentSource; label: string }[] = [
  { id: 'watershed', label: 'Watershed' },
  { id: 'bioregion', label: 'Bioregion' },
  { id: 'drawn', label: 'Drawn by hand' },
  { id: 'other', label: 'Something else' },
];

export function PlaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const lineage = useProjectStore(s => s.lineage);
  const setLineage = useProjectStore(s => s.setLineage);
  const existing = lineage?.place;

  const [placeText, setPlaceText] = useState('');
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [mode, setMode] = useState<ServesMode>('radius');
  const [miles, setMiles] = useState<number>(DEFAULT_CATCHMENT_MILES);
  const [zip, setZip] = useState('');
  const [boundaryText, setBoundaryText] = useState('');
  const [geojsonText, setGeojsonText] = useState('');
  const [geojsonSource, setGeojsonSource] = useState<CatchmentSource>('watershed');
  const [geojsonLabel, setGeojsonLabel] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Load what is saved each time the dialog opens
  useEffect(() => {
    if (!open) return;
    setError(null);
    setNote(null);
    if (!existing) {
      setPlaceText('');
      setPoint(null);
      setMode('radius');
      setMiles(DEFAULT_CATCHMENT_MILES);
      setZip('');
      setBoundaryText('');
      setGeojsonText('');
      setIsPublic(false);
      return;
    }
    setPlaceText(existing.label);
    setPoint({ lat: existing.lat, lng: existing.lng, label: existing.label });
    setIsPublic(existing.public);
    const c = existing.catchment;
    if (!c) { setMode('radius'); setMiles(DEFAULT_CATCHMENT_MILES); return; }
    if (c.kind === 'radius') { setMode(c.source === 'zip' ? 'zip' : 'radius'); setMiles(c.miles ?? DEFAULT_CATCHMENT_MILES); if (c.source === 'zip') setZip(c.ref ?? ''); return; }
    if (c.source === 'zip') { setMode('zip'); setZip(c.ref ?? ''); return; }
    if (c.source === 'neighborhood' || c.source === 'city' || c.source === 'county') { setMode('boundary'); setBoundaryText(c.label); return; }
    setMode('geojson');
    setGeojsonSource(c.source);
    setGeojsonLabel(c.label);
    setGeojsonText('');
  }, [open, existing]);

  const canSave = placeText.trim().length > 0 || mode === 'geojson' || mode === 'zip' || mode === 'boundary';

  async function save() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      let resolvedPoint: GeoPoint | null = point && point.label === placeText.trim() ? point : null;
      let catchment: Catchment | undefined;
      let precision: ProjectPlace['precision'] = 'neighborhood';

      if (mode === 'radius') {
        if (!resolvedPoint) resolvedPoint = await geocodePlace(placeText);
        if (!resolvedPoint) throw new Error(`Couldn't find "${placeText.trim()}". Try a neighborhood and city, or a town and state.`);
        catchment = { kind: 'radius', miles, label: `${miles} ${miles === 1 ? 'mile' : 'miles'} around ${resolvedPoint.label}`, source: 'radius' };
        precision = miles <= 3 ? 'neighborhood' : miles <= 12 ? 'city' : 'region';
      } else if (mode === 'zip') {
        const q = zip.trim();
        if (!q) throw new Error('Type the ZIP or postcode.');
        const hit = await resolveBoundary(q, 'zip');
        if (!hit) throw new Error(`Couldn't find a place for "${q}". Add the country if it is outside the US.`);
        // The typed place names it; the ZIP's own centre only when nothing was typed
        if (!resolvedPoint && placeText.trim()) resolvedPoint = await geocodePlace(placeText);
        resolvedPoint = resolvedPoint ?? hit.point;
        if (hit.catchment) {
          catchment = hit.catchment;
        } else {
          // US ZIPs have no boundary in OpenStreetMap; the honest fallback is
          // a radius that says it is approximate
          catchment = { kind: 'radius', miles: 2, label: `ZIP ${q} (about 2 miles around its centre)`, source: 'zip', ref: q };
          setNote(`OpenStreetMap has no boundary for ${q}, so the Builder uses about 2 miles around its centre.`);
        }
        precision = 'neighborhood';
      } else if (mode === 'boundary') {
        const q = boundaryText.trim() || placeText.trim();
        if (!q) throw new Error('Name the neighborhood or town.');
        const hit = await resolveBoundary(q, 'neighborhood');
        if (!hit) throw new Error(`Couldn't find "${q}" in OpenStreetMap. Try adding the city or state.`);
        if (!hit.catchment) throw new Error(`OpenStreetMap knows where "${q}" is but has no boundary for it. Use a radius, or bring a boundary as GeoJSON.`);
        if (!resolvedPoint && placeText.trim() && boundaryText.trim()) resolvedPoint = await geocodePlace(placeText);
        resolvedPoint = resolvedPoint ?? hit.point;
        catchment = hit.catchment;
        precision = 'neighborhood';
      } else {
        const label = geojsonLabel.trim();
        const fromText = geojsonText.trim();
        if (fromText) {
          const parsed = catchmentFromGeoJson(fromText, geojsonSource, label);
          if (!parsed) throw new Error('That is not GeoJSON with an area in it. Export a Polygon or MultiPolygon (a Feature or FeatureCollection is fine).');
          catchment = parsed;
        } else if (existing?.catchment && existing.catchment.kind === 'polygon') {
          catchment = { ...existing.catchment, source: geojsonSource, label: label || existing.catchment.label };
        } else {
          throw new Error('Paste the GeoJSON for the boundary.');
        }
        if (!resolvedPoint) {
          if (placeText.trim()) resolvedPoint = await geocodePlace(placeText);
          if (!resolvedPoint) {
            const c = centroidOfRings(catchment.rings ?? []);
            if (!c) throw new Error('Could not find the centre of that boundary.');
            resolvedPoint = { ...c, label: catchment.label };
          }
        }
        precision = geojsonSource === 'bioregion' ? 'region' : 'neighborhood';
      }

      const place: ProjectPlace = {
        lat: resolvedPoint.lat,
        lng: resolvedPoint.lng,
        label: resolvedPoint.label,
        precision,
        basis: 'manual',
        catchment,
        public: isPublic,
      };
      setLineage({ ...(lineage ?? { source: null }), place });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the place');
    } finally {
      setBusy(false);
    }
  }

  function clearPlace() {
    if (!lineage) return;
    const { place: _drop, ...rest } = lineage;
    void _drop;
    setLineage(rest);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MapPin className="size-4 text-primary" /> Place</DialogTitle>
          <DialogDescription>
            Where this software lives and the area it serves. The Builder draws on it for examples, maps, and local data.
            Nothing here is guessed from your connection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="place-text" className="text-xs">Where</Label>
            <Input
              id="place-text"
              value={placeText}
              onChange={e => { setPlaceText(e.target.value); setPoint(null); }}
              placeholder="A neighborhood and city, or a town and state"
              className="h-8 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Resolved to the neighborhood or town, not an address. {mode === 'geojson' && 'Optional when you bring a boundary.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Serves</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {SERVES_MODES.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors ${mode === m.id ? 'border-primary bg-primary/10' : 'hover:bg-accent'}`}
                >
                  <span className="block text-xs font-medium">{m.label}</span>
                  <span className="block text-[11px] text-muted-foreground leading-snug">{m.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {mode === 'radius' && (
            <div className="space-y-1.5">
              <Label htmlFor="place-miles" className="text-xs">How far: {miles < 1 ? 'about half a mile' : `${miles} ${miles === 1 ? 'mile' : 'miles'}`}</Label>
              <input
                id="place-miles"
                type="range"
                min={0}
                max={CATCHMENT_RADII_MILES.length - 1}
                step={1}
                value={Math.max(0, CATCHMENT_RADII_MILES.findIndex(r => r === miles))}
                onChange={e => setMiles(CATCHMENT_RADII_MILES[Number(e.target.value)])}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>½ mi</span><span>2</span><span>5</span><span>25 mi</span>
              </div>
            </div>
          )}

          {mode === 'zip' && (
            <div className="space-y-1.5">
              <Label htmlFor="place-zip" className="text-xs">ZIP or postcode</Label>
              <Input id="place-zip" value={zip} onChange={e => setZip(e.target.value)} placeholder="60647, or SW1A 1AA" className="h-8 text-sm" />
              <p className="text-[11px] text-muted-foreground">US ZIP codes have no boundary in OpenStreetMap; those get about 2 miles around the centre.</p>
            </div>
          )}

          {mode === 'boundary' && (
            <div className="space-y-1.5">
              <Label htmlFor="place-boundary" className="text-xs">Neighborhood, town, or county</Label>
              <Input id="place-boundary" value={boundaryText} onChange={e => setBoundaryText(e.target.value)} placeholder={placeText.trim() || 'Logan Square, Chicago'} className="h-8 text-sm" />
              <p className="text-[11px] text-muted-foreground">Leave it empty to use the place above. The boundary comes from OpenStreetMap where one is mapped.</p>
            </div>
          )}

          {mode === 'geojson' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {GEOJSON_SOURCES.map(src => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setGeojsonSource(src.id)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${geojsonSource === src.id ? 'border-primary bg-primary/10' : 'hover:bg-accent'}`}
                  >
                    {src.label}
                  </button>
                ))}
              </div>
              <Input value={geojsonLabel} onChange={e => setGeojsonLabel(e.target.value)} placeholder="Name it: North Branch Chicago River watershed" className="h-8 text-sm" />
              <textarea
                value={geojsonText}
                onChange={e => setGeojsonText(e.target.value)}
                placeholder={existing?.catchment?.kind === 'polygon' ? `Paste new GeoJSON to replace "${existing.catchment.label}", or leave empty to keep it` : 'Paste GeoJSON here: a Polygon, MultiPolygon, Feature, or FeatureCollection'}
                className="w-full h-24 rounded-md border bg-background px-2.5 py-1.5 text-xs font-mono"
                spellCheck={false}
              />
              <p className="text-[11px] text-muted-foreground leading-snug">
                Draw one at <a href="https://geojson.io" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">geojson.io <ExternalLink className="size-2.5" /></a>,
                or export a watershed from the USGS Watershed Boundary Dataset or a bioregion from One Earth. Rings are trimmed to 400 points.
              </p>
            </div>
          )}

          <label className="flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer">
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="mt-0.5 accent-primary" />
            <span className="space-y-0.5">
              <span className="block text-xs font-medium">List this project on the public map of place-based software</span>
              <span className="block text-[11px] text-muted-foreground leading-snug">
                Writes the place and catchment into <code>.reltech.yml</code> and a <code>place.json</code> beside the published site, nothing more.
                Off, the place stays in the Builder and in what you build.
              </span>
            </span>
          </label>

          {existing && (
            <p className="text-[11px] text-muted-foreground">
              Saved now: {existing.label}{existing.catchment ? ` · serves ${describeCatchment(existing)}` : ''}{existing.public ? ' · on the public map' : ''}
            </p>
          )}
          {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-1">
            {existing ? (
              <button type="button" onClick={clearPlace} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                <Trash2 className="size-3" /> Remove place
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button size="sm" onClick={() => void save()} disabled={busy || !canSave}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : 'Save place'}
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/80">Places and boundaries from OpenStreetMap (ODbL), via Photon and Nominatim.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
