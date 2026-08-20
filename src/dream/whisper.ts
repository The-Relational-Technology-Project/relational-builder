/**
 * On-device transcription via Whisper (transformers.js).
 *
 * The private engine: audio never leaves the machine. The model (~80–200 MB
 * depending on backend) downloads once on first use and is cached by the
 * browser after that. WebGPU when available, WASM otherwise.
 *
 * transformers.js is a heavy dependency, so it's only ever loaded through
 * the dynamic import below — choosing the instant engine costs nothing.
 */

export interface WhisperProgress {
  /** Human-readable stage: "downloading model", "warming up", "ready" */
  text: string;
  /** 0–100 while downloading, null when indeterminate */
  pct: number | null;
}

export type Transcriber = (samples: Float32Array, language?: string) => Promise<string>;

const MODEL_ID = 'onnx-community/whisper-base';

let loading: Promise<Transcriber> | null = null;

/** Whether the transcriber is already loaded (or loading) this session */
export function whisperStarted(): boolean {
  return loading !== null;
}

export function loadWhisper(onProgress?: (p: WhisperProgress) => void): Promise<Transcriber> {
  if (loading) return loading;

  loading = (async () => {
    onProgress?.({ text: 'Loading transcription engine…', pct: null });
    const { pipeline } = await import('@huggingface/transformers');

    // Track download progress across the model's several files
    const fileProgress = new Map<string, { loaded: number; total: number }>();
    const progress_callback = (info: {
      status: string;
      file?: string;
      loaded?: number;
      total?: number;
    }) => {
      if (info.status === 'progress' && info.file && info.total) {
        fileProgress.set(info.file, { loaded: info.loaded ?? 0, total: info.total });
        let loaded = 0;
        let total = 0;
        for (const f of fileProgress.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        onProgress?.({
          text: 'Downloading the on-device model (one time)…',
          pct: total > 0 ? Math.round((loaded / total) * 100) : null,
        });
      }
    };

    // The library's own pipeline type is a union too complex for tsc
    // (TS2590), so the call surface we actually use is typed narrowly here.
    type AsrOutput = { text: string } | { text: string }[];
    type AsrPipeline = (
      audio: Float32Array,
      options?: Record<string, unknown>,
    ) => Promise<AsrOutput>;

    // WebGPU is dramatically faster; fall back to WASM quietly
    let pipe: AsrPipeline;
    try {
      pipe = (await pipeline('automatic-speech-recognition', MODEL_ID, {
        device: 'webgpu',
        dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
        progress_callback,
      })) as unknown as AsrPipeline;
    } catch {
      onProgress?.({ text: 'Setting up (no GPU — using the slower path)…', pct: null });
      pipe = (await pipeline('automatic-speech-recognition', MODEL_ID, {
        device: 'wasm',
        dtype: 'q8',
        progress_callback,
      })) as unknown as AsrPipeline;
    }

    onProgress?.({ text: 'Ready', pct: null });

    // Serialize calls — one Whisper job at a time keeps memory and the GPU sane
    let chain: Promise<unknown> = Promise.resolve();
    const transcribe: Transcriber = (samples, language) => {
      const run = chain.then(async () => {
        const out = await pipe(samples, {
          chunk_length_s: 30,
          stride_length_s: 5,
          ...(language ? { language, task: 'transcribe' as const } : {}),
        });
        const one = Array.isArray(out) ? out.map(o => o.text).join(' ') : out.text;
        return (one ?? '').trim();
      });
      chain = run.catch(() => undefined);
      return run;
    };
    return transcribe;
  })();

  loading.catch(() => {
    loading = null; // A failed load shouldn't poison every later attempt
  });
  return loading;
}
