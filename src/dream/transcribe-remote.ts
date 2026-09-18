/**
 * Server-side transcription for Dream Recorder uploads.
 *
 * The walk case: a 40-minute voice memo from a phone. On-device Whisper
 * would take longer than the walk and likely crash mobile Safari, so the
 * recording goes to the `transcribe` edge function, which forwards it to a
 * transcription model (speaker labels + timestamps) and returns lines in
 * Dream Recorder's own "[m:ss] Speaker A: …" format. The audio is not
 * stored server-side. The UI says all of this out loud before sending.
 *
 * Credentials mirror the rest of the app: a personal OpenAI key if one is
 * set, otherwise the signed-in community session (metered against the same
 * weekly budget as chat).
 */

import { useProviderStore } from '@/store/provider-store';
import { getCommunitySessionToken, communityAccessActive } from '@/store/community-store';

const PROXY_URL: string = import.meta.env.VITE_LLM_PROXY_URL ?? '';

/** The edge function lives next to the LLM proxy unless told otherwise */
export const TRANSCRIBE_URL: string =
  import.meta.env.VITE_TRANSCRIBE_URL ??
  (PROXY_URL ? PROXY_URL.replace(/\/[^/]+\/?$/, '/transcribe') : '');

/** Whether this deployment has a server-side transcriber at all */
export function remoteTranscriptionConfigured(): boolean {
  return Boolean(TRANSCRIBE_URL);
}

/** Whether this person can use it right now (a key or community access) */
export function remoteTranscriptionAvailable(): boolean {
  if (!TRANSCRIBE_URL) return false;
  return Boolean(useProviderStore.getState().apiKeys['openai']) || communityAccessActive();
}

/** Largest upload the function accepts — matches its MAX_BYTES */
export const REMOTE_MAX_BYTES = 80 * 1024 * 1024;

export interface RemoteProgress {
  /** 'uploading' with pct, then 'transcribing' with pct null */
  stage: 'uploading' | 'transcribing';
  pct: number | null;
}

export interface RemoteResult {
  transcript: string;
  engine: string;
  seconds: number | null;
}

export function transcribeRemote(
  file: File,
  opts: { language?: string; onProgress?: (p: RemoteProgress) => void; signal?: AbortSignal } = {},
): Promise<RemoteResult> {
  return new Promise<RemoteResult>((resolve, reject) => {
    void (async () => {
      if (!TRANSCRIBE_URL) {
        reject(new Error('Server transcription is not set up for this deployment'));
        return;
      }
      if (file.size > REMOTE_MAX_BYTES) {
        reject(
          new Error(
            `That recording is over ${Math.round(REMOTE_MAX_BYTES / 1024 / 1024)} MB — split it in your voice memo app and add the parts one at a time.`,
          ),
        );
        return;
      }

      const headers: Record<string, string> = {};
      const byok = useProviderStore.getState().apiKeys['openai'];
      if (byok) {
        headers['Authorization'] = `Bearer ${byok}`;
      } else {
        const token = await getCommunitySessionToken();
        if (!token) {
          reject(new Error('Sign in (top right) to transcribe with community access, or add an OpenAI API key in Settings.'));
          return;
        }
        headers['x-community-token'] = token;
      }

      const form = new FormData();
      form.append('file', file, file.name);
      if (opts.language) form.append('language', opts.language);

      // XMLHttpRequest, not fetch: upload progress matters when a phone is
      // pushing 20 MB over a neighborhood's worth of bars
      const xhr = new XMLHttpRequest();
      xhr.open('POST', TRANSCRIBE_URL);
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
      xhr.responseType = 'json';
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          opts.onProgress?.({ stage: 'uploading', pct: Math.round((e.loaded / e.total) * 100) });
        }
      };
      xhr.upload.onload = () => opts.onProgress?.({ stage: 'transcribing', pct: null });
      xhr.onerror = () => reject(new Error('The upload failed — check the connection and try again.'));
      xhr.onabort = () => reject(new DOMException('Cancelled', 'AbortError'));
      xhr.onload = () => {
        const data = (xhr.response ?? {}) as { transcript?: string; engine?: string; seconds?: number | null; error?: string };
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(data.error ?? `Transcription failed (${xhr.status})`));
          return;
        }
        if (typeof data.transcript !== 'string') {
          reject(new Error('The transcription came back empty'));
          return;
        }
        resolve({ transcript: data.transcript, engine: data.engine ?? 'server', seconds: data.seconds ?? null });
      };
      opts.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
      opts.onProgress?.({ stage: 'uploading', pct: 0 });
      xhr.send(form);
    })();
  });
}
