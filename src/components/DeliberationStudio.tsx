import { useMemo, useState } from 'react';
import { useUIStore } from '@/store/ui-store';
import {
  DELIB_CURATION,
  DELIB_STAGE_META,
  DELIB_TOOLS,
  NEIGHBORHOOD_STAGES,
  STARTING_TENSIONS,
  suggestTension,
  type DelibStage,
  type DelibTool,
} from '@/knowledge/delib-tools';
import { startDeliberationKit } from '@/project/start-from-delib-tool';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ImageOff, LayoutGrid, MessagesSquare, Sparkles } from 'lucide-react';

/**
 * The Deliberation Studio — a front door for neighborhoods that arrive with a
 * question rather than an app idea. The flow mirrors how a good facilitator
 * would start: hear the situation, name the tension underneath it, agree on
 * what the process needs, and only then reach for a tool pattern. The result
 * is not a build — it's an editable Plan-mode draft with the deliberative
 * frame stamped on, so the person stays the author of their own process.
 *
 * Never key-gated (like the gallery): describing your situation and reading
 * the shelf works before any model is configured.
 */
export function DeliberationStudio() {
  const setView = useUIStore(s => s.setView);
  const [question, setQuestion] = useState('');
  const [place, setPlace] = useState('');
  const [tensionPair, setTensionPair] = useState<string | null>(null);
  const [tensionSkipped, setTensionSkipped] = useState(false);
  const [stages, setStages] = useState<DelibStage[]>(['eliciting', 'deliberating', 'proposing']);
  const [toolId, setToolId] = useState<string | null>(null);

  const suggested = useMemo(() => suggestTension(question), [question]);
  const chosenTension = tensionSkipped
    ? null
    : STARTING_TENSIONS.find(t => t.pair === (tensionPair ?? suggested)) ?? null;
  const chosenTool: DelibTool | null = DELIB_TOOLS.find(t => t.id === toolId) ?? null;

  const toggleStage = (s: DelibStage) =>
    setStages(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));

  const ready = question.trim().length >= 12;

  function draftKit() {
    startDeliberationKit({
      question,
      place: place.trim() || undefined,
      tension: chosenTension,
      stages,
      tool: chosenTool,
    });
    setView('builder');
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <MessagesSquare className="size-5 text-muted-foreground" />
            Work through a question together
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            For neighborhoods that arrive with a question rather than an app idea. Describe your
            situation and the Studio drafts a deliberation kit — a small tool, a facilitation
            agenda, an outreach plan, and a printable flyer — as a plan you shape before anything
            is built. Every kit remixes patterns other places already run, with their builders
            credited.
          </p>
        </div>

        {/* 1 — the situation, in the person's own words */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium">What is your neighborhood working through?</h2>
          <Textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            rows={3}
            placeholder="e.g. The old library lot is being redeveloped and neighbors don't agree on what should happen there — or who gets to say."
          />
          <Input
            value={place}
            onChange={e => setPlace(e.target.value)}
            placeholder="Your neighborhood (optional — e.g. Belmont-Hillsboro, Nashville)"
            className="max-w-sm"
          />
        </section>

        {/* 2 — the tension underneath. A suggestion, never a classification. */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium">The tension underneath it</h2>
          <p className="text-xs text-muted-foreground">
            Most neighborhood questions sit on a real tension. Naming it early keeps the
            conversation honest — both poles stay respectable.
            {suggested && !tensionPair && !tensionSkipped && ' Based on your question, one is highlighted.'}
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {STARTING_TENSIONS.map(t => {
              const active = !tensionSkipped && (tensionPair ?? suggested) === t.pair;
              return (
                <button
                  key={t.pair}
                  onClick={() => { setTensionPair(t.pair); setTensionSkipped(false); }}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    active ? 'border-foreground bg-muted/60' : 'hover:border-foreground/25'
                  }`}
                >
                  <span className="text-sm font-medium">{t.pair}</span>
                  <span className="block text-xs text-muted-foreground">{t.blurb}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => { setTensionSkipped(true); setTensionPair(null); }}
            className={`text-xs transition-colors ${
              tensionSkipped ? 'text-foreground underline' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Skip — let the conversation find it
          </button>
        </section>

        {/* 3 — which stages the process needs (Metagov's middle five) */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium">What the process needs</h2>
          <p className="text-xs text-muted-foreground">
            Stages from {DELIB_CURATION.curator}'s governance cycle — a neighborhood usually
            lives in the middle five. Pick what this question calls for.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {NEIGHBORHOOD_STAGES.map(s => {
              const active = stages.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleStage(s)}
                  title={DELIB_STAGE_META[s].blurb}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    active
                      ? 'bg-foreground text-background border-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {DELIB_STAGE_META[s].label.toLowerCase()}
                </button>
              );
            })}
          </div>
          {stages.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {stages.map(s => `${DELIB_STAGE_META[s].label}: ${DELIB_STAGE_META[s].blurb}`).join(' · ')}
            </p>
          )}
        </section>

        {/* 4 — optionally, a pattern to grow from (with its makers named) */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium">A pattern to grow from <span className="font-normal text-muted-foreground">(optional)</span></h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => setToolId(null)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                toolId === null ? 'border-foreground bg-muted/60' : 'hover:border-foreground/25'
              }`}
            >
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-muted-foreground" /> Let the plan suggest one
              </span>
              <span className="block text-xs text-muted-foreground">
                The Studio picks from the shelf to fit your stages
              </span>
            </button>
            {DELIB_TOOLS.map(t => {
              const active = toolId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setToolId(active ? null : t.id)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors flex gap-2.5 ${
                    active ? 'border-foreground bg-muted/60' : 'hover:border-foreground/25'
                  }`}
                >
                  <span className="h-12 w-16 shrink-0 rounded border bg-muted overflow-hidden flex items-center justify-center text-muted-foreground/40">
                    {t.screenshot ? (
                      <img src={t.screenshot} alt="" loading="lazy" className="w-full h-full object-cover object-top" />
                    ) : (
                      <ImageOff className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="text-sm font-medium block truncate">{t.name}</span>
                    <span className="block text-xs text-muted-foreground line-clamp-2">
                      {t.tagline} — by {t.builders[0].name}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="space-y-2 pt-1">
          <Button disabled={!ready} onClick={draftKit}>
            <MessagesSquare className="size-4 mr-1.5" /> Draft my deliberation kit
          </Button>
          <p className="text-xs text-muted-foreground">
            Opens as an editable plan in the builder — nothing generates until you send it, and
            the plan decides with you what the kit needs. The deliberative principles (tension-first
            prompts, facilitation guardrails, exportable results) ride the whole project.
          </p>
        </div>

        {/* The shelf's provenance, up front where the flow starts */}
        <div className="rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground space-y-1">
          <p>
            Tool patterns surfaced via{' '}
            <a href={DELIB_CURATION.collectionUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-foreground">
              {DELIB_CURATION.curator}'s {DELIB_CURATION.collection}
            </a>{' '}
            — the{' '}
            <a href={DELIB_CURATION.projectUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-foreground">
              {DELIB_CURATION.project}
            </a>{' '}
            project ({DELIB_CURATION.people.map(p => p.name).join(', ')}) — plus field picks from the
            RTP network, with each tool's builders credited on its card.
          </p>
          <button
            onClick={() => setView('gallery')}
            className="inline-flex items-center gap-1 underline decoration-dotted hover:text-foreground"
          >
            <LayoutGrid className="size-3" /> Browse the deliberative tools shelf in the Gallery
          </button>
        </div>
      </div>
    </div>
  );
}
