import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNeedsKey, NeedsKeyHint } from '@/components/Chat/composer-gate';
import { useUIStore } from '@/store/ui-store';
import { useProviderStore } from '@/store/provider-store';
import { useCommunityStore } from '@/store/community-store';
import { startCapture, decodeAudioFile, type Capture, type CaptureChunk } from '@/dream/capture';
import { loadWhisper, type Transcriber, type WhisperProgress } from '@/dream/whisper';
import { distillDream, distillMessages, plantDream } from '@/dream/distill';
import {
  remoteTranscriptionConfigured,
  transcribeRemote,
  type RemoteProgress,
} from '@/dream/transcribe-remote';
import { TRANSCRIPT_ACCEPT, readTranscriptFile } from '@/dream/transcript-files';
import { fileToDataUrl, isImageFile } from '@/lib/image';
import { RecordingBanner } from '@/components/dream/RecordingBanner';
import { WalkCard } from '@/components/dream/WalkCard';
import type { ChatMessage } from '@/providers/types';
import {
  ArrowRight,
  Copy,
  Download,
  FileAudio,
  FileText,
  ImagePlus,
  Loader2,
  Mic,
  MonitorUp,
  Moon,
  Pause,
  Play,
  Sparkles,
  Square,
  X,
} from 'lucide-react';

/**
 * Dream Recorder — the listening front door. A group talks a project into
 * existence (kitchen table, build-a-thon table, a neighborhood walk, a Zoom
 * breakout, one person at a laptop); the transcript builds locally; one
 * button distills it into a Project Description; one more plants it in the
 * Builder's composer.
 *
 * Two live engines for recording right here:
 * - "Instant" — the browser's speech service (Chrome/Edge, Safari on iOS).
 *   Live and free, but speech is processed by the browser vendor. Honest
 *   label in the UI.
 * - "Private" — Whisper running on this device via transformers.js. Nothing
 *   leaves the machine; also the only engine that can hear a shared tab
 *   (Zoom). Heavy on a phone.
 *
 * And a door for what people already have: recordings from a phone's voice
 * memo app (transcribed on-device, or sent to the `transcribe` edge function
 * when that's the better tool — the person picks, the UI says what leaves
 * the device), transcript files, and photos of napkin/whiteboard notes.
 * Everything added stacks into one transcript in order.
 *
 * On a phone the page is built around one big button and a banner the whole
 * table can see and pause. The screen stays awake while recording.
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

/** Where an added recording gets transcribed */
type UploadEngine = 'device' | 'server';
const UPLOAD_ENGINE_KEY = 'rb.dream.upload-engine';

function loadUploadEngine(fallback: UploadEngine): UploadEngine {
  try {
    const v = localStorage.getItem(UPLOAD_ENGINE_KEY);
    if (v === 'device' || v === 'server') return v;
  } catch {
    /* private mode */
  }
  return fallback;
}

/** One thing a person added: a recording or a transcript file */
interface Source {
  id: string;
  name: string;
  kind: 'recording' | 'transcript';
  status: 'working' | 'done' | 'error';
  /** Progress or the error, in words */
  detail: string;
  /** The block appended to the transcript (so it can be removed again) */
  block?: string;
}

/** A source's block in the shared transcript: a header, then its lines */
function sourceBlock(header: string, text: string): string {
  return `=== ${header} ===\n${text.trim()}\n`;
}

const MAX_PHOTOS = 4;

export function DreamRecorderPage() {
  const setView = useUIStore(s => s.setView);
  const needsKey = useNeedsKey();
  const openaiKey = useProviderStore(s => s.apiKeys['openai']);
  const communityActive = useCommunityStore(s => s.active);
  const remoteConfigured = remoteTranscriptionConfigured();
  const remoteAvailable = remoteConfigured && (Boolean(openaiKey) || communityActive);

  const [engine, setEngine] = useState<Engine>('instant');
  const [uploadEngine, setUploadEngine] = useState<UploadEngine>(() =>
    loadUploadEngine(remoteConfigured ? 'server' : 'device'),
  );
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [lang, setLang] = useState('');
  const [tabOn, setTabOn] = useState(false);
  const [backupUrl, setBackupUrl] = useState<string | null>(null);
  const [whisperState, setWhisperState] = useState<WhisperProgress | null>(null);
  const [pendingJobs, setPendingJobs] = useState(0);
  const [sources, setSources] = useState<Source[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [guidance, setGuidance] = useState('');
  const [distilling, setDistilling] = useState(false);
  const [output, setOutput] = useState('');
  const [refine, setRefine] = useState('');
  const [planting, setPlanting] = useState(false);
  const [plantError, setPlantError] = useState<string | null>(null);
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

  useEffect(() => {
    try {
      localStorage.setItem(UPLOAD_ENGINE_KEY, uploadEngine);
    } catch {
      /* private mode */
    }
  }, [uploadEngine]);

  // Session timer + level meter while recording
  useEffect(() => {
    if (!recording) {
      setLevel(0);
      return;
    }
    const t = window.setInterval(() => {
      setElapsed(captureRef.current?.elapsedSec() ?? 0);
      setLevel(captureRef.current?.level() ?? 0);
    }, 120);
    return () => window.clearInterval(t);
  }, [recording]);

  // Keep the screen awake while the phone sits on the table listening. A
  // dark screen would look like it stopped, and on iOS it actually would.
  useEffect(() => {
    if (!recording) return;
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const request = async () => {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* low battery, or not allowed — the recording still runs */
      }
    };
    const onVisible = () => {
      if (active && document.visibilityState === 'visible') void request();
    };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
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

  const appendBlock = useCallback((block: string) => {
    setTranscript(prev => {
      const base = prev.trim() ? prev.replace(/\n*$/, '\n\n') : '';
      return base + block;
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

  function stopInstant() {
    recognizingRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterim('');
  }

  /* ---------- Start / pause / stop ---------- */
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
    setPaused(false);
    setRecording(true);
  }

  function pauseRecording() {
    const capture = captureRef.current;
    if (!capture || capture.isPaused()) return;
    capture.pause();
    if (engine === 'instant') stopInstant();
    setPaused(true);
  }

  function resumeRecording() {
    const capture = captureRef.current;
    if (!capture || !capture.isPaused()) return;
    capture.resume();
    if (engine === 'instant') startInstant();
    setPaused(false);
  }

  async function stopRecording() {
    stopInstant();
    setRecording(false);
    setPaused(false);
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

  /* ---------- Things people bring: recordings, transcripts, photos ---------- */
  function updateSource(id: string, patch: Partial<Source>) {
    setSources(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function addRecording(file: File) {
    setError(null);
    const id = crypto.randomUUID();
    setSources(prev => [
      ...prev,
      { id, name: file.name, kind: 'recording', status: 'working', detail: 'Starting…' },
    ]);
    try {
      let text: string;
      if (uploadEngine === 'server') {
        const onProgress = (p: RemoteProgress) =>
          updateSource(id, {
            detail:
              p.stage === 'uploading'
                ? `Uploading… ${p.pct ?? 0}%`
                : 'Transcribing… a few minutes for a long walk',
          });
        const result = await transcribeRemote(file, { language: langWhisper, onProgress });
        text = result.transcript;
      } else {
        updateSource(id, { detail: 'Loading the on-device model…' });
        const transcriber = await loadWhisper(p => {
          setWhisperState(p);
          updateSource(id, { detail: p.pct !== null ? `${p.text} ${p.pct}%` : p.text });
        });
        updateSource(id, { detail: 'Decoding the audio…' });
        const samples = await decodeAudioFile(file);
        updateSource(id, {
          detail: `Transcribing on this device… about ${fmt(samples.length / 16000)} of audio, this takes a while`,
        });
        setPendingJobs(n => n + 1);
        try {
          text = await transcriber(samples, langWhisper);
        } finally {
          setPendingJobs(n => n - 1);
        }
      }
      if (!text.trim()) throw new Error('Nothing came back — was there speech in that file?');
      const block = sourceBlock(`Recording: ${file.name}`, text);
      appendBlock(block);
      updateSource(id, { status: 'done', detail: 'Added to the transcript', block });
    } catch (e) {
      updateSource(id, {
        status: 'error',
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function addTranscript(file: File) {
    setError(null);
    const id = crypto.randomUUID();
    setSources(prev => [
      ...prev,
      { id, name: file.name, kind: 'transcript', status: 'working', detail: 'Reading…' },
    ]);
    try {
      const text = await readTranscriptFile(file);
      const block = sourceBlock(`Transcript: ${file.name}`, text);
      appendBlock(block);
      updateSource(id, { status: 'done', detail: 'Added to the transcript', block });
    } catch (e) {
      updateSource(id, { status: 'error', detail: e instanceof Error ? e.message : String(e) });
    }
  }

  function removeSource(source: Source) {
    setSources(prev => prev.filter(s => s.id !== source.id));
    // Only lift the block out if it's still there verbatim — edits win
    const block = source.block;
    if (block) {
      setTranscript(prev => {
        if (!prev.includes(block)) return prev;
        const rest = prev.replace(block, '').replace(/\n{3,}/g, '\n\n').trim();
        return rest ? rest + '\n' : '';
      });
    }
  }

  async function addPhotos(files: File[]) {
    setError(null);
    const images = files.filter(isImageFile);
    if (!images.length) {
      setError('Add a photo (JPEG, PNG, WebP) of the notes.');
      return;
    }
    for (const file of images) {
      try {
        const url = await fileToDataUrl(file);
        setPhotos(prev => (prev.length < MAX_PHOTOS ? [...prev, url] : prev));
      } catch {
        setError(`Couldn't read ${file.name} as an image.`);
      }
    }
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    for (const file of [...files]) {
      if (isImageFile(file)) void addPhotos([file]);
      else if (file.type.startsWith('audio/') || file.type.startsWith('video/')) void addRecording(file);
      else void addTranscript(file);
    }
  }

  /* ---------- Distill ---------- */
  function runDistill(refineInstruction?: string) {
    const text = transcript.trim();
    if (!refineInstruction && !text && photos.length === 0) {
      setError('There’s nothing to distill yet — record something, add a recording or transcript, or paste one in.');
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
        : { transcript: text, guidance, images: photos, onToken: full => setOutput(full) },
    );

    handle.done
      .then(full => {
        const base = refineInstruction
          ? [
              ...conversationRef.current,
              { role: 'user' as const, content: `Please revise the project description: ${refineInstruction}` },
            ]
          : distillMessages(text, guidance, photos);
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

  function plant() {
    if (!output.trim()) return;
    setPlanting(true);
    try {
      plantDream(output.trim(), photos);
      setView('builder');
    } catch (e) {
      // Shown beside the button (below), not only up in step 2 — a failure
      // here has to be visible from where the click happened
      setPlantError(e instanceof Error ? e.message : String(e));
      setPlanting(false);
    }
  }

  const busyTranscribing = pendingJobs > 0;
  const hasAnything = Boolean(transcript.trim()) || photos.length > 0;

  return (
    <div className="h-full overflow-y-auto">
      {recording && (
        <RecordingBanner
          elapsed={fmt(elapsed)}
          paused={paused}
          level={level}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onStop={() => void stopRecording()}
        />
      )}
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-5 sm:space-y-6">
        <header className="text-center space-y-2">
          <Moon className="size-8 mx-auto text-primary" />
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Dream Recorder</h1>
          <p className="text-muted-foreground text-[15px] max-w-md mx-auto">
            Talk through the dream together, at a table or on a walk. Leave with a project
            description, ready to build.
          </p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            🎙 Recording here stays on this device; only the transcript goes to a model, when you
            press Distill. Ask the room before you record.
          </p>
        </header>

        {/* 1 · Capture */}
        <section className="border rounded-xl p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="font-medium">1 · Record the conversation</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Put the phone in the middle of the table. One voice or the whole room. On a Zoom
              call, share the tab so the laptop hears the far side too.
            </p>
          </div>

          {/* The big button — the whole UI on a phone */}
          <div className="flex flex-col items-center gap-2 py-1">
            <button
              type="button"
              onClick={() => (recording ? void stopRecording() : void startRecording())}
              aria-label={recording ? 'Stop recording' : 'Start recording'}
              className="relative size-24 sm:size-20 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span
                aria-hidden
                className={`absolute inset-0 rounded-full ${recording && !paused ? 'bg-destructive/25' : 'bg-transparent'}`}
                style={{
                  transform: `scale(${recording && !paused ? 1 + level * 0.45 : 1})`,
                  transition: 'transform 120ms linear',
                }}
              />
              <span
                className={`relative flex size-full items-center justify-center rounded-full shadow-md transition-colors ${
                  recording
                    ? paused
                      ? 'bg-muted text-muted-foreground border'
                      : 'bg-destructive text-white'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {recording ? <Square className="size-8 sm:size-7" /> : <Mic className="size-9 sm:size-8" />}
              </span>
            </button>
            <div className="text-center leading-tight">
              <div
                className={`tabular-nums text-xl font-medium ${recording && !paused ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {fmt(elapsed)}
              </div>
              <div className="text-xs text-muted-foreground">
                {recording
                  ? paused
                    ? 'Paused. Tap the button to stop, or resume below.'
                    : busyTranscribing
                      ? 'Listening… transcribing a few seconds behind'
                      : 'Listening. Tap the button to stop.'
                  : transcript
                    ? 'Tap to record more'
                    : 'Tap to start recording'}
              </div>
            </div>
            {recording && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full h-9"
                  onClick={paused ? resumeRecording : pauseRecording}
                >
                  {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                  {paused ? 'Resume' : 'Pause'}
                </Button>
                {engine === 'private' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full h-9"
                    onClick={() => void shareTab()}
                    disabled={tabOn}
                    title='Works for a call in a browser tab (Meet, Zoom web) — tick "Also share tab audio". The Zoom desktop app isn&apos;t capturable on a Mac; join from the browser or paste its transcript instead.'
                  >
                    <MonitorUp className="size-3.5" />
                    {tabOn ? 'Hearing the call' : 'Add a Meet/Zoom tab'}
                  </Button>
                )}
              </div>
            )}
            {whisperState && engine === 'private' && whisperState.text !== 'Ready' && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" />
                {whisperState.text}
                {whisperState.pct !== null ? ` ${whisperState.pct}%` : ''}
              </span>
            )}
          </div>

          {interim && <p className="text-sm italic text-muted-foreground">{interim}</p>}

          {/* Engine + language: out of the way, but honest */}
          <details className="text-xs group">
            <summary className="cursor-pointer list-none text-muted-foreground hover:text-foreground select-none">
              <span className="underline decoration-dotted underline-offset-2">
                How it listens: {engine === 'instant' ? 'Instant · browser speech service' : 'Private · Whisper on this device'}
                {lang ? ` · ${LANGS.find(l => l.value === lang)?.label}` : ''}
              </span>
            </summary>
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => !recording && setEngine('instant')}
                  disabled={!instantSupported || recording}
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
                  disabled={recording}
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
              <p className="text-[11px] text-muted-foreground">
                {engine === 'instant'
                  ? 'Hears the microphone only — people in the room, not a call playing through speakers. Live and free, but speech is processed by your browser vendor; for sensitive conversations, use Private. The practical choice on a phone.'
                  : 'Nothing leaves this device. The model downloads once (~100 MB) and is cached; transcription trails the conversation by a few seconds. Heavy on a phone. This engine can also hear a call: share the Meet/Zoom tab while recording.'}
              </p>
            </div>
          </details>

          <textarea
            ref={transcriptBoxRef}
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder="The transcript builds here as people talk — or paste one from your phone's voice memos, Zoom, Otter, or anywhere else. Edit freely; it's just text."
            className="w-full min-h-32 sm:min-h-44 rounded-lg border bg-background px-3.5 py-3 text-sm leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          <div className="flex flex-wrap items-center gap-3 text-xs">
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
                    setSources([]);
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

        {/* 1b · Bring what you already have */}
        <section
          className="border rounded-xl p-4 sm:p-5 space-y-4"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          <div>
            <h2 className="font-medium">Or bring a recording, a transcript, or a photo of notes</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              A voice memo from a walk, a transcript from a call, the napkin from the kitchen table.
              Add as many as you like; they stack into the transcript above, in order.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="flex items-center gap-2.5 rounded-lg border px-3.5 py-3 text-sm cursor-pointer hover:bg-muted/40 transition-colors">
              <FileAudio className="size-5 text-primary shrink-0" />
              <span className="leading-tight">
                <span className="font-medium block">Add a recording</span>
                <span className="text-[11px] text-muted-foreground">voice memo, m4a, mp3, webm</span>
              </span>
              <input
                type="file"
                accept="audio/*,video/webm,video/mp4,.m4a,.mp3,.wav,.ogg,.opus,.aac,.webm"
                multiple
                className="hidden"
                onChange={e => {
                  for (const f of [...(e.target.files ?? [])]) void addRecording(f);
                  e.target.value = '';
                }}
              />
            </label>
            <label className="flex items-center gap-2.5 rounded-lg border px-3.5 py-3 text-sm cursor-pointer hover:bg-muted/40 transition-colors">
              <FileText className="size-5 text-primary shrink-0" />
              <span className="leading-tight">
                <span className="font-medium block">Add a transcript</span>
                <span className="text-[11px] text-muted-foreground">txt, md, docx, pdf, vtt, srt</span>
              </span>
              <input
                type="file"
                accept={TRANSCRIPT_ACCEPT}
                multiple
                className="hidden"
                onChange={e => {
                  for (const f of [...(e.target.files ?? [])]) void addTranscript(f);
                  e.target.value = '';
                }}
              />
            </label>
            <label
              className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-3 text-sm transition-colors ${
                photos.length >= MAX_PHOTOS ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/40'
              }`}
            >
              <ImagePlus className="size-5 text-primary shrink-0" />
              <span className="leading-tight">
                <span className="font-medium block">Add a photo of notes</span>
                <span className="text-[11px] text-muted-foreground">napkin, whiteboard, notebook</span>
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                disabled={photos.length >= MAX_PHOTOS}
                className="hidden"
                onChange={e => {
                  void addPhotos([...(e.target.files ?? [])]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {/* Where recordings get transcribed */}
          {remoteConfigured && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-muted-foreground self-center">Transcribe recordings:</span>
                <button
                  onClick={() => setUploadEngine('server')}
                  className={`px-3 py-1.5 rounded-full border transition-colors ${
                    uploadEngine === 'server'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Send to be transcribed
                </button>
                <button
                  onClick={() => setUploadEngine('device')}
                  className={`px-3 py-1.5 rounded-full border transition-colors ${
                    uploadEngine === 'device'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  On this device
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {uploadEngine === 'server'
                  ? remoteAvailable
                    ? 'Fast, and it hears who is speaking. The recording goes to a transcription service through RTP’s server and is not kept. The right choice on a phone or for anything longer than a few minutes.'
                    : 'Fast, and it hears who is speaking. The recording goes to a transcription service through RTP’s server and is not kept. Sign in (top right) to use it with community access, or add an OpenAI key in Settings.'
                  : 'Nothing leaves this device. Slow on phones and long recordings: about as long as the recording itself, sometimes longer. Fine for a short clip on a laptop.'}
              </p>
            </div>
          )}

          {sources.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {sources.map(s => (
                <li key={s.id} className="flex items-start gap-2 rounded-md border px-3 py-2">
                  {s.kind === 'recording' ? (
                    <FileAudio className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                  ) : (
                    <FileText className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate">{s.name}</div>
                    <div
                      className={`text-[11px] inline-flex items-center gap-1 ${
                        s.status === 'error' ? 'text-destructive' : 'text-muted-foreground'
                      }`}
                    >
                      {s.status === 'working' && <Loader2 className="size-3 animate-spin" />}
                      {s.detail}
                    </div>
                  </div>
                  {s.status !== 'working' && (
                    <button
                      onClick={() => removeSource(s)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${s.name}`}
                      title={s.status === 'done' ? 'Remove from the transcript' : 'Dismiss'}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photos.map((url, i) => (
                <div key={i} className="relative">
                  <img
                    src={url}
                    alt={`Notes photo ${i + 1}`}
                    className="size-20 object-cover rounded-md border"
                  />
                  <button
                    onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-background border shadow flex items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label="Remove photo"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              <p className="w-full text-[11px] text-muted-foreground">
                Photos go to the model with the transcript when you press Distill, and ride along
                into the Builder.
              </p>
            </div>
          )}

          <WalkCard />
        </section>

        {/* 2 · Distill */}
        <section className="border rounded-xl p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="font-medium">2 · Distill the dream</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The transcript{photos.length ? ' and photos' : ''} go to your builder's model, which
              follows the arc of the conversation — what merged, what got cut, where the group
              landed — and writes the project description.
            </p>
          </div>

          <Input
            value={guidance}
            onChange={e => setGuidance(e.target.value)}
            placeholder='Anything to emphasize? e.g. "go with the tree-planting idea" (optional)'
          />

          <div className="flex items-center gap-3">
            <Button
              onClick={() => runDistill()}
              disabled={distilling || needsKey || !hasAnything}
              className="w-full sm:w-auto h-11 sm:h-9"
            >
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
              <Button onClick={plant} disabled={distilling || planting}>
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
            {plantError && (
              <p className="text-sm text-destructive whitespace-pre-wrap">
                Couldn't plant it: {plantError}
              </p>
            )}

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
