import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImagePlus, ArrowRight } from 'lucide-react';
import { isImageFile } from '@/lib/image';

/**
 * The swap-photo overlay: the pointed-at picture on the left, the new one
 * on the right (drop it or pick it), one Save. The parent decides whether
 * the swap can land directly in source; this component only collects the
 * photo. "Ask AI instead" carries the chosen photo along so nothing is
 * re-uploaded.
 */
export function SwapPhotoOverlay({
  currentUrl,
  alt,
  onSave,
  onAskAi,
  onClose,
}: {
  /** What the image looks like right now (for the "before" thumb) */
  currentUrl: string;
  alt?: string;
  onSave: (file: File) => void;
  onAskAi: (file: File | null) => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Object URLs live exactly as long as the overlay needs them
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function choose(f: File | undefined | null) {
    if (!f || !isImageFile(f)) return;
    setFile(f);
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }

  return (
    <div
      className="absolute inset-0 z-20 bg-black/20 flex items-start justify-center pt-10"
      onClick={onClose}
    >
      <div
        className="bg-background border rounded-xl shadow-lg p-3 w-[min(30rem,92%)] space-y-2.5"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-xs font-medium">Swap this photo</p>

        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="rounded-lg border bg-muted/30 aspect-video overflow-hidden flex items-center justify-center">
              {currentUrl ? (
                <img src={currentUrl} alt={alt || 'Current photo'} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[11px] text-muted-foreground">Current photo</span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground text-center">Now</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={e => { choose(e.target.files?.[0]); e.target.value = ''; }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                choose(e.dataTransfer.files?.[0]);
              }}
              className={`w-full rounded-lg border aspect-video overflow-hidden flex flex-col items-center justify-center gap-1 transition-colors ${
                dragOver ? 'border-primary border-2 border-dashed bg-primary/10' : 'hover:bg-accent/50'
              }`}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="New photo" className="h-full w-full object-cover" />
              ) : (
                <>
                  <ImagePlus className="size-4 text-muted-foreground" />
                  <span className="px-2 text-[11px] text-muted-foreground">
                    Drop a photo or click to choose
                  </span>
                </>
              )}
            </button>
            <p className="mt-1 text-[11px] text-muted-foreground text-center">New</p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Changes just this picture — instant, no AI. Undo lives where it always does.
        </p>
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => onAskAi(file)}
          >
            Ask AI instead
          </Button>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!file}
              onClick={() => file && onSave(file)}
            >
              Swap photo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
