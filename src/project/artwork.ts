import { addPhotoAsset, type AddedAsset } from '@/project/assets';
import { getCommunitySessionToken } from '@/store/community-store';
import { useProviderStore } from '@/store/provider-store';

/**
 * AI-generated artwork — the assist for when a real photo doesn't exist yet:
 * flyer art, custom icons, imagery a build asks for. Real, local photos still
 * come first (see the design guidance); this fills the gap without stock
 * clip-art.
 *
 * Generation runs through the LLM proxy's `gemini-image` lane: a BYOK Gemini
 * key passes through, community members draw on RTP's server-held key under
 * the same allowlist and daily budget as chat. The result lands in the
 * project as a normal photo asset (assets/<name>.js), so the AI wires it in
 * exactly like a builder's own photo.
 */

const PROXY_URL = import.meta.env.VITE_LLM_PROXY_URL ?? '';

export function artworkAvailable(): boolean {
  return !!PROXY_URL;
}

/** Generate one image from a prompt; resolves to a data URL. */
export async function generateArtwork(prompt: string): Promise<string> {
  if (!PROXY_URL) {
    throw new Error('Image generation needs the LLM proxy (VITE_LLM_PROXY_URL)');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-llm-provider': 'gemini-image',
  };
  const byok = useProviderStore.getState().apiKeys['gemini'];
  if (byok) {
    headers['Authorization'] = `Bearer ${byok}`;
  } else {
    const token = await getCommunitySessionToken();
    if (!token) {
      throw new Error('Sign in to generate images, or add a Gemini API key in Settings');
    }
    headers['x-community-token'] = token;
  }

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : `Image generation failed (${res.status})`,
    );
  }
  if (typeof data.image !== 'string') {
    throw new Error('The model returned no image — try rephrasing the prompt');
  }
  return data.image;
}

/** Turn a generated image into a project asset (compressed, capped) named
 * from the prompt, riding the same pipeline as the builder's own photos. */
export async function addGeneratedAsset(prompt: string, dataUrl: string): Promise<AddedAsset> {
  const blob = await (await fetch(dataUrl)).blob();
  const name =
    prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .split('-')
      .slice(0, 5)
      .join('-') || 'artwork';
  const file = new File([blob], `${name}.png`, { type: blob.type || 'image/png' });
  return addPhotoAsset(file);
}
