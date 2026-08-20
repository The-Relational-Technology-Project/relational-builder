import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNeedsKey, NeedsKeyHint } from '@/components/Chat/composer-gate';
import { useUIStore } from '@/store/ui-store';
import { startCapture, decodeAudioFile, type Capture, type CaptureChunk } from '@/dream/capture';
import { loadWhisper, type Transcriber, type WhisperProgress } from '@/dream/whisper';
import { distillDream, distillMessages, plantDream } from '@/dream/distill';
import type { ChatMessage } from '@/providers/types';
import {
  ArrowRight,
  Copy,
  Download,
  FileAudio,
  Loader2,
  Mic,
  MonitorUp,
  Moon,
  Sparkles,
  Square,
} from 'lucide-react';

/**
 * Dream Recorder — the listening front door. A group talks a project into
 * existence (build-a-thon table, Zoom breakout, one person at a laptop);
 * the transcript builds locally; one button distills it into a Project
 * Description; one more plants it in the Builder's composer.
 *
 * Two transcription engines:
 * - "Instant" — the browser's speech service (Chrome/Edge). Live and free,
 *   but speech is processed by the browser vendor. Honest label in the UI.
 * - "Private" — Whisper running on this device via transformers.js. Nothing
 *   leaves the machine; also the only engine that can hear a shared tab
 *   (Zoom) and transcribe dropped audio files.
 */

/* Web Speech API — not in TypeScript's DOM lib, so declared minimally here */
interface SRAlternative {
  transcript: string;
}
interface SRResult {
  isFinal: boolean;
  [index: number]: SRAlternative;
}
interface SREvent {
  resultIndex: number;
  results: { length: number; [index: number]: SRResult };
}
interface SRErrorEvent {
  error: string;
}
interface SpeechRec {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  start(): void;
  stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  }
}

type Engine = 'instant' | 'private';

const LANGS: { value: string; label: string; whisper: string }[] = [
  { value: '', label: 'Auto / browser default', whisper: '' },
  { value: 'en-US', label: 'English', whisper: 'en' },
  { value: 'es-ES', label: 'Español', whisper: 'es' },
  { value: 'fr-FR', label: 'Français', whisper: 'fr' },
  { value: 'pt-BR', label: 'Português', whisper: 'pt' },
  { value: 'zh-CN', label: '中文', whisper: 'zh' },
];

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function DreamRecorderPage() {
  const setView = useUIStore(s => s.setView);
  const needsKey = useNeedsKey();

  const [engine, setEngine] = useState<Engine>('instant');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [lang, setLang] = useState('');
  const [tabOn, setTabOn] = useState(false);
  const [backupUrl, setBackupUrl] = useState<string | null>(null);
  const [whisperState, setWhisperState] = useState<WhisperProgress | null>(null);
  const [pendingJobs, setPendingJobs] = useState(0);
  const [decodingFile, setDecodingFile] = useState(false);
  const [guidance, setGuidance] = useState('');
  const [distilling, setDistilling] = useState(false);
  const [output, setOutput] = useState('');
  const [refine, setRefine] = useState('');
  const [planting, setPlanting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const captureRef = useRef<Capture | null>(null);
  const recognitionRef = useRef<SpeechRec | null>(null);
  const recognizingRef = useRef(false);
  const transcriberRef = useRef<Transcriber | null>(null);
  const conversationRef = useRef<ChatMessage[]>([]);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const transcriptBoxRef = useRef<HTMLTextAreaElement | null>(null);

  const SRClass =
    typeof window !== 'undefined'
      ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
      : undefined;
  const instantSupported = Boolean(SRClass);

  useEffect(() => {
    if (!instantSupported) setEngine('private');
  }, [instantSupported]);

  // Session timer while recording
  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => {
      setElapsed(captureRef.current?.elapsedSec() ?? 0);
    }, 500);
    return () => window.clearInterval(t);
  }, [recording]);

  // Leaving the page mid-recording stops everything cleanly
  useEffect(() => {
    return () => {
      recognizingRef.current = false;
      recognitionRef.current?.stop();
      void captureRef.current?.stop();
    };
  }, []);

  const appendLine = useCallback((stampSec: number, text: string, tag?: string) => {
    const clean = text.trim();
    if (!clean) return;
    const line = `[${fmt(stampSec)}]${tag ? ` (${tag})` : ''} ${clean}`;
    setTranscript(prev => (prev && !prev.endsWith('\n') ? prev + '\n' : prev) + line + '\n');
    // Follow the newest line, like a chat
    requestAnimationFrame(() => {
      const box = transcriptBoxRef.current;
      if (box) box.scrollTop = box.scrollHeight;
    });
  }, []);

  /* ---------- Whisper chunk handling ---------- */
  const langWhisper = LANGS.find(l => l.value === lang)?.whisper || undefined;

  const handleChunk = useCallback(
    (chunk: CaptureChunk) => {
      const transcriber = transcriberRef.current;
      if (!transcriber) return;
      setPendingJobs(n => n + 1);
      transcriber(chunk.samples, langWhisper)
        .then(text => {
          // Tag lines by source only once a call is in the mix — room-only
          // sessions stay untagged
          const tag = chunk.source === 'call' || tabOn ? chunk.source : undefined;
          appendLine(chunk.startSec, text, tag);
        })
        .catch(() => setError('A stretch of audio failed to transcribe — the recording backup still has it.'))
        .finally(() => setPendingJobs(n => n - 1));
    },
    [appendLine, langWhisper, tabOn],
  );
  const handleChunkRef = useRef(handleChunk);
  handleChunkRef.current = handleChunk;

  /* ---------- Instant engine (Web Speech) ---------- */
  function startInstant() {
    if (!SRClass) return;
    const rec = new SRClass();
    rec.continuous = true;
    rec.interimResults = true;
    if (lang) rec.lang = lang;
    rec.onresult = (event: SREvent) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) appendLine(captureRef.current?.elapsedSec() ?? 0, r[0].transcript);
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
    };
    rec.onend = () => {
      // Chrome halts recognition after pauses — keep it running
      if (recognizingRef.current) {
        try {
          rec.start();
        } catch {
          /* already restarted */
        }
      }
    };
    rec.onerror = (e: SRErrorEvent) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone access was blocked — allow the mic for this page and try again.');
        void stopRecording();
      }
    };
    rec.start();
    recognitionRef.current = rec;
    recognizingRef.current = true;
  }

  /* ---------- Start / stop ---------- */
  async function startRecording() {
    setError(null);
    if (backupUrl) {
      URL.revokeObjectURL(backupUrl);
      setBackupUrl(null);
    }
    try {
      if (engine === 'private') {
        // Load (or reuse) the on-device model before audio starts piling up
        transcriberRef.current = await loadWhisper(setWhisperState);
      }
      captureRef.current = await startCapture({
        collectPcm: engine === 'private',
        onChunk: chunk => handleChunkRef.current(chunk),
        onTabEnded: () => setTabOn(false),
      });
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Microphone access was blocked — allow the mic for this page and try again.'
          : `Couldn't start recording: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }
    if (engine === 'instant') startInstant();
    setRecording(true);
  }

  async function stopRecording() {
    recognizingRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterim('');
    setRecording(false);
    setTabOn(false);
    const capture = captureRef.current;
    captureRef.current = null;
    if (capture) {
      const backup = await capture.stop();
      if (backup) setBackupUrl(URL.createObjectURL(backup));
    }
  }

  async function shareTab() {
    const capture = captureRef.current;
    if (!capture) return;
    const result = await capture.addTabAudio();
    if (result === 'ok') setTabOn(true);
    else if (result === 'no-audio')
      setError('That share had no audio — pick a tab and tick "Also share tab audio".');
  }

  /* ---------- Dropped audio files (private engine) ---------- */
  async function transcribeFile(file: File) {
    setError(null);
    setDecodingFile(true);
    try {
      const transcriber = await loadWhisper(setWhisperState);
      const samples = await decodeAudioFile(file);
      setPendingJobs(n => n + 1);
      try {
        const text = await transcriber(samples, langWhisper);
        setTranscript(prev => (prev ? prev + '\n' : '') + `[from ${file.name}]\n` + text + '\n');
      } finally {
        setPendingJobs(n => n - 1);
      }
    } catch (e) {
      setError(`Couldn't transcribe that file: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDecodingFile(false);
    }
  }

  /* ---------- Distill ---------- */
  function runDistill(refineInstruction?: string) {
    const text = transcript.trim();
    if (!refineInstruction && !text) {
      setError('There’s no transcript yet — record something or paste one in.');
      return;
    }
    setError(null);
    if (recording) void stopRecording();
    setDistilling(true);

    const handle = distillDream(
      refineInstruction
        ? {
            conversation: conversationRef.current,
            refineInstruction,
            onToken: full => setOutput(full),
          }
        : { transcript: text, guidance, onToken: full => setOutput(full) },
    );

    handle.done
      .then(full => {
        const base = refineInstruction
          ? [
              ...conversationRef.current,
              { role: 'user' as const, content: `Please revise the project description: ${refineInstruction}` },
            ]
          : distillMessages(text, guidance);
        conversationRef.current = [...base, { role: 'assistant', content: full }];
        setOutput(full);
        requestAnimationFrame(() =>
          outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        );
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setDistilling(false));
  }

  async function plant() {
    if (!output.trim()) return;
    setPlanting(true);
    try {
      await plantDream(output.trim());
      setView('builder');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPlanting(false);
    }
  }

  const busyTranscribing = pendingJobs > 0 || decodingFile;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <header className="text-center space-y-2">
          <Moon className="size-8 mx-auto text-primary" />
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Dream Recorder</h1>
          <p className="text-muted-foreground text-[15px] max-w-md mx-auto">
            Talk through the dream together — leave with a project description, ready to build.
          </p>
          <p className="text-xs text-muted-foreground">
            🎙 Audio is recorded on this device. Only the finished transcript goes to a model, and
            only when you press Distill. Ask the room before you record.
          </p>
        </header>

        {/* 1 · Capture */}
        <section className="border rounded-xl p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="font-medium">1 · Capture the conversation</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              One voice or a whole table. On a Zoom call, share the tab so the laptop hears the far
              side too — or paste a transcript straight in.
            </p>
          </div>

          {/* Engine choice */}
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => !recording && setEngine('instant')}
              disabled={!instantSupported}
              className={`px-3 py-1.5 rounded-full border transition-colors ${
                engine === 'instant'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              } ${!instantSupported ? 'opacity-40' : ''}`}
              title={instantSupported ? undefined : 'Not supported in this browser'}
            >
              Instant · browser speech service
            </button>
            <button
              onClick={() => !recording && setEngine('private')}
              className={`px-3 py-1.5 rounded-full border transition-colors ${
                engine === 'private'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Private · Whisper on this device
            </button>
            <select
              value={lang}
              onChange={e => setLang(e.target.value)}
              disabled={recording}
              className="ml-auto text-xs border rounded-md px-2 py-1 bg-background"
              aria-label="Spoken language"
            >
              {LANGS.map(l => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            {engine === 'instant'
              ? 'Live and free, but speech is processed by your browser vendor. For sensitive conversations, use Private.'
              : 'Nothing leaves this device. The model downloads once (~100 MB) and is cached; transcription trails the conversation by a few seconds.'}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => (recording ? void stopRecording() : void startRecording())}
              variant={recording ? 'destructive' : 'default'}
              className="rounded-full"
            >
              {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
              {recording ? 'Stop' : transcript ? 'Resume recording' : 'Start recording'}
            </Button>
            <span
              className={`tabular-nums text-lg font-medium ${recording ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {fmt(elapsed)}
            </span>
            {recording && engine === 'private' && (
              <Button variant="outline" size="sm" onClick={() => void shareTab()} disabled={tabOn}>
                <MonitorUp className="size-3.5" />
                {tabOn ? 'Hearing the call' : 'Add a Zoom tab'}
              </Button>
            )}
            {whisperState && engine === 'private' && whisperState.text !== 'Ready' && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" />
                {whisperState.text}
                {whisperState.pct !== null ? ` ${whisperState.pct}%` : ''}
              </span>
            )}
            {busyTranscribing && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" />
                transcribing…
              </span>
            )}
          </div>

          {interim && <p className="text-sm italic text-muted-foreground">{interim}</p>}

          <textarea
            ref={transcriptBoxRef}
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder="The transcript builds here as people talk — or paste one from Zoom, Otter, or anywhere else. Edit freely; it's just text."
            className="w-full min-h-44 rounded-lg border bg-background px-3.5 py-3 text-sm leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              <FileAudio className="size-3.5" />
              Transcribe an audio file (on-device)
              <input
                type="file"
                accept="audio/*,video/webm,video/mp4"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) void transcribeFile(f);
                  e.target.value = '';
                }}
              />
            </label>
            {backupUrl && (
              <a
                href={backupUrl}
                download="dream-recording.webm"
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="size-3.5" />
                Save audio backup (stays on this device)
              </a>
            )}
            {transcript && (
              <button
                onClick={() => {
                  if (window.confirm('Clear the transcript?')) {
                    setTranscript('');
                    conversationRef.current = [];
                  }
                }}
                className="text-muted-foreground hover:text-foreground transition-colors ml-auto"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {/* 2 · Distill */}
        <section className="border rounded-xl p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="font-medium">2 · Distill the dream</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The transcript goes to your builder's model, which follows the arc of the
              conversation — what merged, what got cut, where the group landed — and writes the
              project description.
            </p>
          </div>

          <Input
            value={guidance}
            onChange={e => setGuidance(e.target.value)}
            placeholder='Anything to emphasize? e.g. "go with the tree-planting idea" (optional)'
          />

          <div className="flex items-center gap-3">
            <Button onClick={() => runDistill()} disabled={distilling || needsKey}>
              {distilling ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {distilling ? 'Listening back through it…' : 'Distill the dream'}
            </Button>
          </div>
          <NeedsKeyHint needsKey={needsKey} />
          {error && <p className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
        </section>

        {/* 3 · The description */}
        {output && (
          <section ref={outputRef} className="border rounded-xl p-4 sm:p-5 space-y-4">
            <div>
              <h2 className="font-medium">3 · Your project description</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Plant it in the Builder to start — it lands in the composer, yours to edit before
                anything is sent.
              </p>
            </div>

            <div className="prose prose-sm dark:prose-invert max-w-none border rounded-lg px-4 py-3 bg-muted/20">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void plant()} disabled={distilling || planting}>
                {planting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                Plant it in the Builder
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigator.clipboard.writeText(output).catch(() => undefined)}
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                value={refine}
                onChange={e => setRefine(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && refine.trim() && !distilling) {
                    runDistill(refine.trim());
                    setRefine('');
                  }
                }}
                placeholder='Nudge it: "shorter", "focus on the flyer", "we called it Root Party"…'
              />
              <Button
                variant="outline"
                disabled={!refine.trim() || distilling}
                onClick={() => {
                  runDistill(refine.trim());
                  setRefine('');
                }}
              >
                Refine
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
