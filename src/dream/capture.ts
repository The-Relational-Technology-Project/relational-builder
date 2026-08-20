/**
 * Local audio capture for Dream Recorder.
 *
 * Everything here stays on the device: the microphone (the "room"), an
 * optional shared browser tab's audio (the "call" — how a laptop hears the
 * far side of a Zoom), a raw-audio backup via MediaRecorder, and — when the
 * on-device transcription engine is active — a rolling stream of 16 kHz PCM
 * chunks per source, ready for Whisper.
 *
 * Keeping the room and the call as *separate* PCM streams is a deliberate
 * choice: it gives the transcript honest speaker attribution at the
 * granularity that matters in practice (who was in the room vs. who was on
 * the call) without any diarization model.
 */

export type CaptureSource = 'room' | 'call';

export interface CaptureChunk {
  source: CaptureSource;
  /** Seconds into the session when this chunk started */
  startSec: number;
  /** Mono PCM at 16 kHz, ready for Whisper */
  samples: Float32Array;
}

export interface CaptureOptions {
  /** Collect PCM chunks for on-device transcription (skip for the instant engine) */
  collectPcm: boolean;
  /** How often to flush a PCM chunk to the transcriber (default 20s) */
  chunkSeconds?: number;
  onChunk?: (chunk: CaptureChunk) => void;
  /** The person stopped sharing the tab from the browser's own UI */
  onTabEnded?: () => void;
}

export interface Capture {
  /** Ask the browser for a tab/screen share and mix its audio in */
  addTabAudio(): Promise<'ok' | 'no-audio' | 'denied'>;
  hasTab(): boolean;
  elapsedSec(): number;
  /** Stop everything; resolves with the raw-audio backup (null if it failed) */
  stop(): Promise<Blob | null>;
}

const TARGET_RATE = 16000;

/** Linear-interpolation downsample — Whisper wants 16 kHz mono */
function downsample(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === TARGET_RATE) return input;
  const ratio = fromRate / TARGET_RATE;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, input.length - 1);
    out[i] = input[lo] + (input[hi] - input[lo]) * (pos - lo);
  }
  return out;
}

/** Accumulates one source's PCM between flushes */
class PcmCollector {
  private buffers: Float32Array[] = [];
  private length = 0;
  chunkStartSec = 0;

  push(data: Float32Array) {
    // The ScriptProcessor reuses its buffer — copy before keeping
    this.buffers.push(new Float32Array(data));
    this.length += data.length;
  }

  /** Roughly how many seconds are buffered (at the context rate) */
  seconds(rate: number): number {
    return this.length / rate;
  }

  drain(): Float32Array {
    const all = new Float32Array(this.length);
    let off = 0;
    for (const b of this.buffers) {
      all.set(b, off);
      off += b.length;
    }
    this.buffers = [];
    this.length = 0;
    return all;
  }
}

export async function startCapture(opts: CaptureOptions): Promise<Capture> {
  const chunkSeconds = opts.chunkSeconds ?? 20;
  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const ctx = new AudioContext();
  const startedAt = performance.now();
  const elapsedSec = () => (performance.now() - startedAt) / 1000;

  // Everything audible gets mixed into one stream for the backup recording
  const mixDest = ctx.createMediaStreamDestination();

  const collectors = new Map<CaptureSource, PcmCollector>();
  const processors: ScriptProcessorNode[] = [];
  const streams: MediaStream[] = [micStream];

  function attach(stream: MediaStream, source: CaptureSource) {
    const node = ctx.createMediaStreamSource(stream);
    node.connect(mixDest);
    if (!opts.collectPcm) return;

    const collector = new PcmCollector();
    collector.chunkStartSec = elapsedSec();
    collectors.set(source, collector);

    // ScriptProcessorNode is deprecated but universally supported and needs
    // no worklet asset plumbing — the right tradeoff for capture at 16 kHz
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = e => collector.push(e.inputBuffer.getChannelData(0));
    node.connect(proc);
    // Chrome only runs a processor that reaches the destination — mute it
    const mute = ctx.createGain();
    mute.gain.value = 0;
    proc.connect(mute);
    mute.connect(ctx.destination);
    processors.push(proc);
  }

  attach(micStream, 'room');

  function flush(source: CaptureSource, minSeconds: number) {
    const collector = collectors.get(source);
    if (!collector || collector.seconds(ctx.sampleRate) < minSeconds) return;
    const startSec = collector.chunkStartSec;
    const raw = collector.drain();
    collector.chunkStartSec = elapsedSec();
    opts.onChunk?.({ source, startSec, samples: downsample(raw, ctx.sampleRate) });
  }

  const flushTimer = opts.collectPcm
    ? window.setInterval(() => {
        for (const source of collectors.keys()) flush(source, chunkSeconds);
      }, 2000)
    : 0;

  // Raw-audio backup — belt and braces for a once-only conversation
  let recorder: MediaRecorder | null = null;
  const recordedParts: Blob[] = [];
  try {
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : undefined;
    recorder = new MediaRecorder(mixDest.stream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = e => {
      if (e.data.size > 0) recordedParts.push(e.data);
    };
    recorder.start(5000);
  } catch {
    recorder = null; // No backup is a degraded session, not a failed one
  }

  let tabStream: MediaStream | null = null;

  return {
    async addTabAudio() {
      try {
        // Video must be requested for the tab picker to appear; the audio
        // track is what we keep. "Also share tab audio" is the checkbox the
        // person must tick in the browser's dialog.
        const display = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        if (display.getAudioTracks().length === 0) {
          display.getTracks().forEach(t => t.stop());
          return 'no-audio';
        }
        tabStream = display;
        streams.push(display);
        attach(display, 'call');
        display.getVideoTracks().forEach(t => {
          t.addEventListener('ended', () => {
            tabStream = null;
            opts.onTabEnded?.();
          });
        });
        return 'ok';
      } catch {
        return 'denied';
      }
    },

    hasTab: () => tabStream !== null,
    elapsedSec,

    async stop() {
      window.clearInterval(flushTimer);
      // Whatever is still buffered becomes the final chunk per source
      for (const source of collectors.keys()) flush(source, 0.5);
      for (const proc of processors) proc.disconnect();

      const backup = await new Promise<Blob | null>(resolve => {
        if (!recorder || recorder.state === 'inactive') {
          resolve(recordedParts.length ? new Blob(recordedParts, { type: 'audio/webm' }) : null);
          return;
        }
        recorder.onstop = () =>
          resolve(recordedParts.length ? new Blob(recordedParts, { type: 'audio/webm' }) : null);
        recorder.stop();
      });

      for (const s of streams) s.getTracks().forEach(t => t.stop());
      await ctx.close().catch(() => undefined);
      return backup;
    },
  };
}

/**
 * Decode a dropped audio file (a phone voice memo, a Zoom recording) into
 * 16 kHz mono PCM for Whisper — entirely on-device.
 */
export async function decodeAudioFile(file: File): Promise<Float32Array> {
  const bytes = await file.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(bytes);
    // Mix down to mono
    const mono = new Float32Array(decoded.length);
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const data = decoded.getChannelData(ch);
      for (let i = 0; i < data.length; i++) mono[i] += data[i] / decoded.numberOfChannels;
    }
    return downsample(mono, decoded.sampleRate);
  } finally {
    await ctx.close().catch(() => undefined);
  }
}
