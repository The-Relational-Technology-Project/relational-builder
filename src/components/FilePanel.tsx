import { useProjectStore } from '@/store/project-store';
import { FileTree } from './FileTree';
import { CodeViewer } from './CodeViewer';

export function FilePanel() {
  const selectedFile = useProjectStore(s => s.selectedFile);

  return (
    <div className="flex h-full">
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
  );
}
