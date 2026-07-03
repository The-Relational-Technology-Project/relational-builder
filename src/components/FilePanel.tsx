import { useRef, useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { FileTree } from './FileTree';
import { CodeViewer } from './CodeViewer';
import { addPhotoAsset } from '@/project/assets';
import { isImageFile } from '@/lib/image';
import { ImagePlus, Loader2 } from 'lucide-react';

export function FilePanel() {
  const selectedFile = useProjectStore(s => s.selectedFile);
  const setDraftMessage = useChatStore(s => s.setDraftMessage);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
        `I added my own photo as the asset "${asset.name}" (file ${asset.path}). Use it where it fits: include <script src="./${asset.path}"></script> and <img data-asset="${asset.name}" alt="..."> — `,
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
        {notice && <span className="text-xs text-muted-foreground truncate">{notice}</span>}
      </div>
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
