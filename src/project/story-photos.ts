import { builderClient, cloudEnabled } from '@/cloud/builder-client';
import { storyPhotos, stripPhotoEmbeds } from '@/project/draft-story';

/**
 * Photos traveling with a commons story.
 *
 * The commons pipeline carries markdown text, so a story's embedded photos
 * are hosted on the Builder backend's public storage (via the story-photos
 * edge function) at the moment of contribution, and the `photo:N` markers
 * become real image URLs. Consent-first: only photos actually embedded in
 * the story body are uploaded — a notepad photo the builder left out of
 * the story never leaves the device.
 */

const EMBED_RE = /!\[([^\]]*)\]\(photo:(\d+)\)/g;

/** Which photo numbers the story body actually embeds */
export function embeddedPhotoNumbers(body: string): number[] {
  const seen = new Set<number>();
  for (const m of body.matchAll(EMBED_RE)) {
    const n = Number(m[2]);
    if (storyPhotos()[n - 1]) seen.add(n);
  }
  return [...seen].sort((a, b) => a - b);
}

/** Whether this session can host photos (signed-in builder on a cloud build) */
export async function canSharePhotos(): Promise<boolean> {
  if (!cloudEnabled || !builderClient) return false;
  const { data } = await builderClient.auth.getSession();
  return Boolean(data.session?.access_token);
}

/**
 * Prepare a story body for the commons: upload the embedded photos and swap
 * their markers for hosted URLs. Throws when hosting fails — the consent
 * checkbox promised photos, so silently dropping them is not an option;
 * the builder sees the error and can retry or uncheck.
 */
export async function bodyWithHostedPhotos(body: string): Promise<string> {
  const numbers = embeddedPhotoNumbers(body);
  if (numbers.length === 0) return stripPhotoEmbeds(body);

  if (!cloudEnabled || !builderClient) throw new Error('Sign in to share photos with a story');
  const { data } = await builderClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to share photos with a story');

  const all = storyPhotos();
  const res = await fetch(
    `${import.meta.env.VITE_BUILDER_SUPABASE_URL}/functions/v1/story-photos`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        photos: numbers.map(n => ({ data: all[n - 1].image, caption: all[n - 1].caption })),
      }),
    },
  );
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(payload.urls)) {
    throw new Error(payload.error ?? 'Could not host the story photos — try again');
  }

  const urlByNumber = new Map<number, string>(numbers.map((n, i) => [n, payload.urls[i]]));
  return body.replace(EMBED_RE, (whole, caption, num) => {
    const url = urlByNumber.get(Number(num));
    return url ? `![${caption}](${url})` : whole;
  }).trim();
}
