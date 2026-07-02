/**
 * Downscale an image file to a chat-friendly data URL.
 * Keeps prompts (and localStorage) small: max 1024px long edge, JPEG.
 * PNGs with transparency stay PNG so mockups on transparent backgrounds survive.
 */
export async function fileToDataUrl(file: File, maxEdge = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const keepPng = file.type === 'image/png';
  return keepPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.8);
}

export function isImageFile(file: File): boolean {
  return /^image\/(png|jpe?g|webp|gif)$/.test(file.type);
}
