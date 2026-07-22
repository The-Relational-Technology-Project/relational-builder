/**
 * Downscale an image file to a chat-friendly data URL.
 * Keeps prompts (and localStorage) small: max 1024px long edge, JPEG.
 * PNGs that actually use transparency stay PNG so mockups on transparent
 * backgrounds survive — opaque PNGs (screenshots, exported photos) take
 * JPEG compression like everything else.
 */
export async function fileToDataUrl(file: File, maxEdge = 1024, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const keepPng = file.type === 'image/png' && hasTransparency(ctx, width, height);
  return keepPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
}

/** Whether any pixel actually uses the alpha channel. Screenshots arrive as
 * PNG but are almost always fully opaque — encoding those as lossless PNG
 * makes them several times larger than they need to be. */
function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

export function isImageFile(file: File): boolean {
  return /^image\/(png|jpe?g|webp|gif)$/.test(file.type);
}
