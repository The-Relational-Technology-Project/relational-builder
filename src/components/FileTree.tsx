import { useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { deleteProjectFile } from '@/project/delete-file';
import type { TreeNode } from '@/project/virtual-fs';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Trash2, Check, X } from 'lucide-react';

export function FileTree() {
  // Subscribe to version so we re-render on FS changes
  const version = useProjectStore(s => s.version);
  const getTree = useProjectStore(s => s.getTree);
  const selectedFile = useProjectStore(s => s.selectedFile);
  const selectFile = useProjectStore(s => s.selectFile);
  const getFileCount = useProjectStore(s => s.getFileCount);
  /** The one row asking "delete this?" — opening another closes it */
  const [confirming, setConfirming] = useState<string | null>(null);

  // Force usage of version to avoid tree-shaking
  void version;

  const tree = getTree();
  const fileCount = getFileCount();

  if (fileCount === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground text-center">
        No files yet. Start a conversation to generate code.
      </div>
    );
  }

  return (
    <div className="text-sm">
      <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
        Files ({fileCount})
      </div>
      <div className="py-1">
        {tree.children?.map(node => (
          <TreeNodeItem
            key={node.path}
            node={node}
            depth={0}
            selectedFile={selectedFile}
            onSelect={selectFile}
            confirming={confirming}
            onConfirming={setConfirming}
          />
        ))}
      </div>
    </div>
  );
}

function TreeNodeItem({
  node,
  depth,
  selectedFile,
  onSelect,
  confirming,
  onConfirming,
}: {
  node: TreeNode;
  depth: number;
  selectedFile: string | null;
  onSelect: (path: string) => void;
  confirming: string | null;
  onConfirming: (path: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isDir = node.type === 'directory';
  const isSelected = node.path === selectedFile;
  const isConfirming = !isDir && confirming === node.path;

  const handleClick = () => {
    if (isDir) {
      setExpanded(!expanded);
    } else {
      onSelect(node.path);
    }
  };

  // Asking costs one click and answers itself — the file's name is right
  // there in the row, so the question doesn't need to repeat it back
  if (isConfirming) {
    return (
      <div
        className="flex items-center gap-1 w-full px-2 py-0.5 text-xs bg-destructive/10"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="flex-1 min-w-0 truncate text-muted-foreground">Delete {node.name}?</span>
        <button
          onClick={() => {
            deleteProjectFile(node.path);
            onConfirming(null);
          }}
          autoFocus
          onKeyDown={e => e.key === 'Escape' && onConfirming(null)}
          className="shrink-0 rounded p-0.5 text-destructive hover:bg-destructive/20"
          aria-label={`Delete ${node.name}`}
          title="Delete — you can bring it back from version history"
        >
          <Check className="size-3.5" />
        </button>
        <button
          onClick={() => onConfirming(null)}
          onKeyDown={e => e.key === 'Escape' && onConfirming(null)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
          aria-label="Keep this file"
          title="Keep it"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className={`group flex items-center w-full transition-colors ${
          isSelected ? 'bg-muted' : 'hover:bg-muted/50'
        }`}
      >
        <button
          onClick={handleClick}
          className={`flex items-center gap-1 flex-1 min-w-0 text-left px-2 py-0.5 text-xs ${
            isSelected ? 'text-foreground font-medium' : 'text-muted-foreground'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isDir ? (
            <>
              {expanded ? (
                <ChevronDown className="size-3 shrink-0" />
              ) : (
                <ChevronRight className="size-3 shrink-0" />
              )}
              {expanded ? (
                <FolderOpen className="size-3.5 shrink-0 text-blue-400" />
              ) : (
                <Folder className="size-3.5 shrink-0 text-blue-400" />
              )}
            </>
          ) : (
            <>
              <span className="size-3 shrink-0" />
              <File className="size-3.5 shrink-0" />
            </>
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {!isDir && (
          // Hidden until the row is hovered or keyboard-focused, so the tree
          // still reads as a list of files rather than a row of controls —
          // but always visible where there's no hover to reveal it.
          <button
            onClick={() => onConfirming(node.path)}
            className="shrink-0 mr-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            aria-label={`Delete ${node.name}`}
            title={`Delete ${node.name}`}
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
      {isDir && expanded && node.children?.map(child => (
        <TreeNodeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedFile={selectedFile}
          onSelect={onSelect}
          confirming={confirming}
          onConfirming={onConfirming}
        />
      ))}
    </>
  );
}
