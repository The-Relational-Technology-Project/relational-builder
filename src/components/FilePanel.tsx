import { useRef, useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { FileTree } from './FileTree';
import { CodeViewer } from './CodeViewer';
import { addPhotoAsset, photoWiringNote, type AddedAsset } from '@/project/assets';
import { artworkAvailable, generateArtwork, addGeneratedAsset } from '@/project/artwork';
import { downloadSourceZip } from '@/project/download-source';
import { isImageFile } from '@/lib/image';
import { addReferenceDoc, isReferenceFile, REFERENCE_ACCEPT, wordCount } from '@/project/references';
import { addDataFile, isDataFile, DATA_ACCEPT, dataLoadHint } from '@/project/data-files';
import { useReferencesStore, referencePath, type ReferenceDoc } from '@/store/references-store';
import { Database, Download, FileText, ImagePlus, Loader2, Sparkles, X } from 'lucide-react';

/** The wiring line drafted into the composer when an asset lands here —
 * the person finishes the sentence with where it goes */
function assetDraftMessage(intro: string, asset: AddedAsset): string {
  return `${intro} ${photoWiringNote(asset, useProjectStore.getState().getAllFiles())} — `;
}

const KIND_LABEL: Record<ReferenceDoc['kind'], string> = {
  pdf: 'PDF',
  docx: 'Word',
  md: 'Markdown',
  txt: 'Text',
};

function referenceMeta(doc: ReferenceDoc): string {
  const bits = [KIND_LABEL[doc.kind]];
  if (doc.pages) bits.push(`${doc.pages} pp`);
  const n = wordCount(doc.text);
  bits.push(n >= 1000 ? `${Math.round(n / 100) / 10}k words` : `${n} words`);
  return bits.join(' · ');
}

export function FilePanel() {
  const selectedFile = useProjectStore(s => s.selectedFile);
  const selectFile = useProjectStore(s => s.selectFile);
  const hasFiles = useProjectStore(s => s.getFileCount() > 0);
  const setDraftMessage = useChatStore(s => s.setDraftMessage);
  const referenceDocs = useReferencesStore(s => s.docs);
  const removeDoc = useReferencesStore(s => s.removeDoc);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [addingReference, setAddingReference] = useState(false);
  const [addingData, setAddingData] = useState(false);
  /** A reference document open in the viewer (a project file click wins) */
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const viewingDoc = referenceDocs.find(d => d.id === viewingDocId) ?? null;
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

  async function handleAddReference(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!isReferenceFile(file)) {
      setNotice('Add a PDF, Word document (.docx), Markdown, or plain text file');
      return;
    }
    setAddingReference(true);
    setNotice(null);
    try {
      const doc = await addReferenceDoc(file);
      setNotice(`Added "${doc.name}" as a reference — the AI can read it now`);
      setViewingDocId(doc.id);
      selectFile(null);
      // Same hand-off as photos: the wiring line is drafted, the person says
      // what the document is for
      setDraftMessage(`I added "${doc.name}" as a reference document (${referencePath(doc)}). Read it and `);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not read that file');
    } finally {
      setAddingReference(false);
    }
  }

  async function handleAddData(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!isDataFile(file)) {
      setNotice('Add a JSON, GeoJSON, or CSV file');
      return;
    }
    setAddingData(true);
    setNotice(null);
    try {
      const added = await addDataFile(file);
      setNotice(
        added.overHostingCap
          ? `Added ${added.path} (${Math.round(added.bytes / 1024)} KB — over Community Hosting's 512 KB per-file limit; Netlify and Vercel publish it fine)`
          : `Added ${added.path}`,
      );
      selectFile(added.path);
      setViewingDocId(null);
      setDraftMessage(
        `I added my data file ${added.path} (${added.summary}). Load it at runtime (${dataLoadHint(added.path)}) rather than retyping any of it, and use it for `,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not add that file');
    } finally {
      setAddingData(false);
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
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Add one of your own photos to the project — real, local images beat any illustration"
        >
          {adding ? <Loader2 className="size-3 animate-spin" /> : <ImagePlus className="size-3" />}
          Add photo
        </button>
        <input
          ref={referenceInputRef}
          type="file"
          accept={REFERENCE_ACCEPT}
          className="hidden"
          onChange={e => {
            handleAddReference(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => referenceInputRef.current?.click()}
          disabled={addingReference}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Add a PDF, Word doc, Markdown or text file for the AI to read while planning and building — it stays out of the app itself"
        >
          {addingReference ? <Loader2 className="size-3 animate-spin" /> : <FileText className="size-3" />}
          Add reference
        </button>
        <input
          ref={dataInputRef}
          type="file"
          accept={DATA_ACCEPT}
          className="hidden"
          onChange={e => {
            handleAddData(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => dataInputRef.current?.click()}
          disabled={addingData}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Add real data the app should use — a JSON, GeoJSON or CSV file. It becomes a /data/ file the app loads; the AI reads its shape, never retypes it"
        >
          {addingData ? <Loader2 className="size-3 animate-spin" /> : <Database className="size-3" />}
          Add data
        </button>
        {artworkAvailable() && (
          <button
            onClick={() => setGenOpen(o => !o)}
            disabled={generating}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
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
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
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
          {referenceDocs.length > 0 && (
            <div className="text-sm border-t">
              <div
                className="px-3 py-2 text-xs font-medium text-muted-foreground border-b"
                title="Documents the AI reads for context — never part of the app, never published"
              >
                References ({referenceDocs.length})
              </div>
              <div className="py-1">
                {referenceDocs.map(doc => (
                  <div
                    key={doc.id}
                    className={`group flex items-center gap-1 pr-1 hover:bg-accent/50 ${
                      viewingDoc?.id === doc.id && !selectedFile ? 'bg-accent' : ''
                    }`}
                  >
                    <button
                      onClick={() => {
                        setViewingDocId(doc.id);
                        selectFile(null);
                      }}
                      className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1 text-left"
                      title={`${doc.name} — ${referenceMeta(doc)}`}
                    >
                      <FileText className="size-3 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs">{doc.name}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">{referenceMeta(doc)}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        removeDoc(doc.id);
                        if (viewingDocId === doc.id) setViewingDocId(null);
                      }}
                      className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
                      title="Remove this reference (the AI stops seeing it; your original file is untouched)"
                      aria-label={`Remove reference ${doc.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Code viewer — or a reference document's extracted text, so a
            person can see exactly what the AI sees */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {selectedFile ? (
            <CodeViewer />
          ) : viewingDoc ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0 text-xs">
                <FileText className="size-3 text-muted-foreground" />
                <span className="font-medium truncate">{viewingDoc.name}</span>
                <span className="text-muted-foreground truncate">{referenceMeta(viewingDoc)}</span>
                <span className="ml-auto text-muted-foreground whitespace-nowrap">
                  What the AI reads{viewingDoc.truncated ? ' (cut at the size cap)' : ''}
                </span>
              </div>
              <pre className="flex-1 min-h-0 overflow-auto px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                {viewingDoc.text}
              </pre>
            </div>
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
