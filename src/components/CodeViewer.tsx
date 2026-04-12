import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';
import { useProjectStore } from '@/store/project-store';
import { X } from 'lucide-react';

export function CodeViewer() {
  const selectedFile = useProjectStore(s => s.selectedFile);
  const selectFile = useProjectStore(s => s.selectFile);
  const getFile = useProjectStore(s => s.getFile);
  const version = useProjectStore(s => s.version);

  // Re-read file when version or selection changes
  void version;
  const file = selectedFile ? getFile(selectedFile) : undefined;

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
        Select a file from the tree to view its contents
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30 shrink-0">
        <span className="text-xs font-medium truncate">{file.path}</span>
        <button
          onClick={() => selectFile(null)}
          className="text-muted-foreground hover:text-foreground p-0.5 rounded"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <HighlightedCode code={file.content} language={file.language} />
      </div>
    </div>
  );
}

function HighlightedCode({ code, language }: { code: string; language: string }) {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    codeToHtml(code, {
      lang: language,
      theme: 'github-dark-default',
    })
      .then(result => {
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        if (!cancelled) setHtml('');
      });

    return () => { cancelled = true; };
  }, [code, language]);

  if (!html) {
    return (
      <pre className="bg-zinc-900 text-zinc-100 p-4 text-xs leading-relaxed overflow-x-auto">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="text-xs leading-relaxed [&_pre]:p-4 [&_pre]:m-0"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
