import { useRef, useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { FileTree } from './FileTree';
import { CodeViewer } from './CodeViewer';
import { addPhotoAsset, isPhotoAssetPath, type AddedAsset } from '@/project/assets';
import { artworkAvailable, generateArtwork, addGeneratedAsset } from '@/project/artwork';
import { downloadSourceZip } from '@/project/download-source';
import { detectPreviewKind } from '@/preview/detect';
import { isImageFile } from '@/lib/image';
import { Download, ImagePlus, Loader2, Sparkles } from 'lucide-react';

/**
 * The wiring instructions handed to the AI when an asset lands. Two things a
 * static template got wrong in a real build: it told the AI to add a
 * `<script src>` tag (only right for plain HTML pages — framework apps inline
 * asset modules automatically, and the AI had to spend its reply correcting
 * us), and it said nothing about placeholder slots the build had already left
 * waiting, so a photo named "mural-art" sat beside an empty slot named
 * "mural" until the person reconciled them by hand.
 */
function assetDraftMessage(intro: string, asset: AddedAsset): string {
  const files = useProjectStore.getState().getAllFiles();
  const kind = detectPreviewKind(files);

  // Placeholder slots already in the app with no matching asset behind them
  const assetNames = new Set(
    files
      .filter(f => isPhotoAssetPath(f.path))
      .map(f => f.path.replace(/^\/?assets\//, '').replace(/\.js$/, '')),
  );
  const emptySlots = new Set<string>();
  for (const f of files) {
    if (isPhotoAssetPath(f.path)) continue;
    for (const m of f.content.matchAll(/data-asset=["']([\w-]+)["']/g)) {
      if (!assetNames.has(m[1])) emptySlots.add(m[1]);
    }
  }

  const wiring =
    kind === 'framework'
      ? `add <img data-asset="${asset.name}" alt="..."> where it belongs (no script tag — the builder loads photo assets automatically in this app)`
      : `include <script src="./${asset.path}"></script> and <img data-asset="${asset.name}" alt="...">`;
  const slotNote =
    emptySlots.size > 0
      ? ` The app already has empty photo slots waiting (${[...emptySlots].join(', ')}) — if this photo belongs in one of them, change that slot's data-asset to "${asset.name}" instead of adding a new img.`
      : '';
  return `${intro} Use it where it fits: ${wiring}.${slotNote} — `;
}

export function FilePanel() {
  const selectedFile = useProjectStore(s => s.selectedFile);
  const hasFiles = useProjectStore(s => s.getFileCount() > 0);
  const setDraftMessage = useChatStore(s => s.setDraftMessage);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    const prompt = genPrompt.trim();
    if (!prompt || generating) return;
    setGenerating(true);
    setNotice(null);
    try {
      const dataUrl = await generateArtwork(prompt);
      const asset = await addGeneratedAsset(prompt, dataUrl);
      setNotice(`Added ${asset.path}`);
      setGenPrompt('');
      setGenOpen(false);
      setDraftMessage(
        assetDraftMessage(
          `I generated an image ("${prompt}") as the asset "${asset.name}" (file ${asset.path}).`,
          asset,
        ),
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not generate that image');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownloadZip() {
    if (zipping) return;
    setZipping(true);
    setNotice(null);
    try {
      await downloadSourceZip();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not build the zip');
    } finally {
      setZipping(false);
    }
  }

  async function handleAddPhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file || !isImageFile(file)) return;
    setAdding(true);
    setNotice(null);
    try {
      const asset = await addPhotoAsset(file);
      setNotice(`Added ${asset.path}`);
      // Hand the AI the wiring instructions with one tap
      setDraftMessage(
        assetDraftMessage(
          `I added my own photo as the asset "${asset.name}" (file ${asset.path}).`,
          asset,
        ),
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not add that photo');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={e => {
            handleAddPhoto(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={adding}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Add one of your own photos to the project — real, local images beat any illustration"
        >
          {adding ? <Loader2 className="size-3 animate-spin" /> : <ImagePlus className="size-3" />}
          Add photo
        </button>
        {artworkAvailable() && (
          <button
            onClick={() => setGenOpen(o => !o)}
            disabled={generating}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Generate an image with AI — for flyer art, icons, or imagery when a real photo doesn't exist yet"
          >
            {generating ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
            Generate image
          </button>
        )}
        {hasFiles && (
          <button
            onClick={handleDownloadZip}
            disabled={zipping}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Download the whole codebase as a zip — source files plus a ready-to-run scaffold"
          >
            {zipping ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
            Download zip
          </button>
        )}
        {notice && <span className="text-xs text-muted-foreground truncate">{notice}</span>}
      </div>
      {genOpen && (
        <div className="flex items-center gap-2 px-2 py-1.5 border-b shrink-0">
          <input
            value={genPrompt}
            onChange={e => setGenPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            placeholder="Describe it — “hand-painted lending library sign, coastal fog colors”"
            autoFocus
            disabled={generating}
            className="flex-1 min-w-0 rounded border bg-transparent px-2 py-1 text-xs outline-none focus:border-primary"
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !genPrompt.trim()}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        {/* File tree sidebar */}
        <div className="w-48 shrink-0 border-r overflow-y-auto">
          <FileTree />
        </div>

        {/* Code viewer */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {selectedFile ? (
            <CodeViewer />
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              Select a file to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
