import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, Trash2, ExternalLink, Check, X } from 'lucide-react';
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
  boundaryForSuggestion,
  catchmentFromGeoJson,
  centroidOfRings,
  describeCatchment,
  suggestPlaces,
  type Catchment,
  type CatchmentSource,
  type PlaceSuggestion,
  type SuggestKind,
} from '@/knowledge/geo';
import type { ProjectPlace } from '@/project/place';

/**
 * Where this software lives and the area it serves. Opened from the project
 * menu. Everything here is the builder's own call: the place is searched
 * and picked (never guessed from free text), the catchment is a radius, a
 * ZIP, a named boundary from OpenStreetMap, or a GeoJSON boundary pasted
 * from anywhere (a watershed from USGS, a bioregion from One Earth, a shape
 * drawn at geojson.io), and the public switch is off until they turn it on.
 *
 * Saved onto the project's lineage (project/place), where it reaches the
 * prompt at once and the repo, the published site, and the commons when
 * those happen.
 */

type ServesMode = 'radius' | 'zip' | 'boundary' | 'geojson';

const SERVES_MODES: { id: ServesMode; label: string; hint: string }[] = [
  { id: 'radius', label: 'A radius', hint: 'So many miles around the place' },
  { id: 'zip', label: 'A ZIP or postcode', hint: 'Its boundary where OpenStreetMap has one, a radius where not' },
  { id: 'boundary', label: 'A neighborhood or town', hint: 'Its boundary from OpenStreetMap' },
  { id: 'geojson', label: 'A boundary I bring', hint: 'A watershed, a bioregion, or a shape you drew, as GeoJSON' },
];

const GEOJSON_SOURCES: { id: CatchmentSource; label: string }[] = [
  { id: 'watershed', label: 'Watershed' },
  { id: 'bioregion', label: 'Bioregion' },
  { id: 'drawn', label: 'Drawn by hand' },
  { id: 'other', label: 'Something else' },
];

/**
 * Search and pick. Suggestions arrive as the person types (Photon, debounced);
 * choosing one is the confirmation and shows as a chip. Typed text that was
 * never picked is not a place — the parent refuses to save it and says so.
 */
function PlaceSearch({ id, kind, value, onPick, placeholder, autoFocus }: {
  id: string;
  kind: SuggestKind;
  value: PlaceSuggestion | null;
  onPick: (s: PlaceSuggestion | null) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [typed, setTyped] = useState('');
  const [options, setOptions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (value) return;
    const q = typed.trim();
    if (q.length < 2) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t = setTimeout(() => {
      setSearching(true);
      void suggestPlaces(q, kind, ctrl.signal).then(res => {
        if (ctrl.signal.aborted) return;
        setOptions(res);
        setActive(0);
        setOpen(true);
        setSearching(false);
      });
    }, 280);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [typed, kind, value]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-primary/50 bg-primary/5 px-2.5 py-1.5 text-sm">
        <Check className="size-3.5 shrink-0 text-primary" />
        <span className="min-w-0 truncate">{value.label}</span>
        <button
          type="button"
          onClick={() => { onPick(null); setTyped(''); setOptions([]); }}
          className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          title="Pick a different place"
        >
          <X className="size-3" /> change
        </button>
      </div>
    );
  }

  const choose = (s: PlaceSuggestion) => { onPick(s); setOpen(false); setOptions([]); setTyped(''); };
  const noMatch = !searching && open && typed.trim().length >= 2 && options.length === 0;

  return (
    <div className="relative">
      <div className="relative">
        <Input
          id={id}
          value={typed}
          onChange={e => {
            setTyped(e.target.value);
            if (e.target.value.trim().length < 2) { setOptions([]); setOpen(false); setSearching(false); }
          }}
          onFocus={() => { if (options.length > 0) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={e => {
            if (!open || options.length === 0) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, options.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); choose(options[active]); }
            else if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder}
          className="h-8 text-sm pr-7"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          autoFocus={autoFocus}
        />
        {searching && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-muted-foreground" />}
      </div>
      {open && options.length > 0 && (
        <ul
          id={`${id}-options`}
          role="listbox"
          className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-md border bg-popover shadow-md text-sm"
        >
          {options.map((s, i) => (
            <li
              key={`${s.lat},${s.lng},${s.label}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={e => { e.preventDefault(); choose(s); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-2.5 py-1.5 ${i === active ? 'bg-accent' : ''}`}
            >
              <span className="block truncate">{s.label.split(',')[0]}</span>
              {s.context && <span className="block truncate text-[11px] text-muted-foreground">{s.context}</span>}
            </li>
          ))}
        </ul>
      )}
      {noMatch && (
        <p className="mt-1 text-[11px] text-muted-foreground">No places match that. Try adding the city or state, or a different spelling.</p>
      )}
    </div>
  );
}

export function PlaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const lineage = useProjectStore(s => s.lineage);
  const setLineage = useProjectStore(s => s.setLineage);
  const existing = lineage?.place;

  const [where, setWhere] = useState<PlaceSuggestion | null>(null);
  const [mode, setMode] = useState<ServesMode>('radius');
  const [miles, setMiles] = useState<number>(DEFAULT_CATCHMENT_MILES);
  const [zip, setZip] = useState<PlaceSuggestion | null>(null);
  const [boundary, setBoundary] = useState<PlaceSuggestion | null>(null);
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
    setZip(null);
    setBoundary(null);
    setGeojsonText('');
    if (!existing) {
      setWhere(null);
      setMode('radius');
      setMiles(DEFAULT_CATCHMENT_MILES);
      setIsPublic(false);
      return;
    }
    setWhere({ lat: existing.lat, lng: existing.lng, label: existing.label, context: '' });
    setIsPublic(existing.public);
    const c = existing.catchment;
    if (!c) { setMode('radius'); setMiles(DEFAULT_CATCHMENT_MILES); return; }
    if (c.source === 'zip') { setMode('zip'); if (c.ref) setZip({ lat: existing.lat, lng: existing.lng, label: c.ref, context: '' }); return; }
    if (c.kind === 'radius') { setMode('radius'); setMiles(c.miles ?? DEFAULT_CATCHMENT_MILES); return; }
    if (c.source === 'neighborhood' || c.source === 'city' || c.source === 'county') {
      setMode('boundary');
      setBoundary({ lat: existing.lat, lng: existing.lng, label: c.label, context: '', ...(c.ref?.startsWith('relation/') ? { osmType: 'R' as const, osmId: Number(c.ref.slice(9)) } : {}) });
      return;
    }
    setMode('geojson');
    setGeojsonSource(c.source);
    setGeojsonLabel(c.label);
  }, [open, existing]);

  const keepingSavedBoundary = (s: PlaceSuggestion | null) =>
    !!s && !!existing?.catchment && existing.catchment.kind === 'polygon' && s.label === existing.catchment.label;

  const needsWhere = mode === 'radius';
  const canSave =
    (mode === 'radius' && !!where) ||
    (mode === 'zip' && !!zip) ||
    (mode === 'boundary' && !!(boundary ?? where)) ||
    mode === 'geojson';

  async function save() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      let point: PlaceSuggestion | null = where;
      let catchment: Catchment | undefined;
      let precision: ProjectPlace['precision'] = 'neighborhood';

      if (mode === 'radius') {
        if (!point) throw new Error('Pick the place from the list first.');
        catchment = { kind: 'radius', miles, label: `${miles} ${miles === 1 ? 'mile' : 'miles'} around ${point.label}`, source: 'radius' };
        precision = miles <= 3 ? 'neighborhood' : miles <= 12 ? 'city' : 'region';
      } else if (mode === 'zip') {
        if (!zip) throw new Error('Pick the ZIP or postcode from the list first.');
        const code = zip.label.split(',')[0].trim();
        const saved = existing?.catchment;
        const found = saved?.source === 'zip' && saved.ref === code ? saved : await boundaryForSuggestion(zip, 'zip');
        if (found && found.kind === 'polygon') {
          catchment = { ...found, label: `ZIP ${code}`, ref: code };
        } else {
          // US ZIPs have no boundary in OpenStreetMap; the honest fallback is
          // a radius that says it is approximate
          catchment = { kind: 'radius', miles: 2, label: `ZIP ${code} (about 2 miles around its centre)`, source: 'zip', ref: code };
          setNote(`OpenStreetMap has no boundary for ${code}, so the Builder uses about 2 miles around its centre.`);
        }
        point = point ?? zip;
      } else if (mode === 'boundary') {
        const pick = boundary ?? where;
        if (!pick) throw new Error('Pick the neighborhood or town from the list first.');
        const found = keepingSavedBoundary(boundary) ? existing!.catchment! : await boundaryForSuggestion(pick, 'neighborhood');
        if (!found) throw new Error(`OpenStreetMap knows where ${pick.label.split(',')[0]} is but has no boundary for it. Use a radius, or bring a boundary as GeoJSON.`);
        catchment = found;
        point = point ?? pick;
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
        if (!point) {
          const c = centroidOfRings(catchment.rings ?? []);
          if (!c) throw new Error('Could not find the centre of that boundary.');
          point = { ...c, label: catchment.label, context: '' };
        }
        precision = geojsonSource === 'bioregion' ? 'region' : 'neighborhood';
      }

      const place: ProjectPlace = {
        lat: point.lat,
        lng: point.lng,
        label: point.label,
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
            <Label htmlFor="place-where" className="text-xs">Where{!needsWhere && mode !== 'geojson' && <span className="text-muted-foreground font-normal"> (optional)</span>}{mode === 'geojson' && <span className="text-muted-foreground font-normal"> (optional, names the place)</span>}</Label>
            <PlaceSearch
              id="place-where"
              kind="place"
              value={where}
              onPick={setWhere}
              placeholder="Start typing a neighborhood or town, then pick it"
              autoFocus={!existing}
            />
            <p className="text-[11px] text-muted-foreground">
              Search, then pick from the list. Neighborhoods and towns only, never an address.
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
              <PlaceSearch id="place-zip" kind="postcode" value={zip} onPick={setZip} placeholder="Type the code, then pick it" />
              <p className="text-[11px] text-muted-foreground">US ZIP codes have no boundary in OpenStreetMap; those get about 2 miles around the centre.</p>
            </div>
          )}

          {mode === 'boundary' && (
            <div className="space-y-1.5">
              <Label htmlFor="place-boundary" className="text-xs">Neighborhood, town, or county</Label>
              <PlaceSearch id="place-boundary" kind="boundary" value={boundary} onPick={setBoundary} placeholder={where ? `Leave empty to use ${where.label.split(',')[0]}` : 'Search, then pick it'} />
              <p className="text-[11px] text-muted-foreground">The boundary comes from OpenStreetMap where one is mapped. Many neighborhoods have none; the Builder will say so.</p>
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
