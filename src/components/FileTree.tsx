import { useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import type { TreeNode } from '@/project/virtual-fs';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';

export function FileTree() {
  // Subscribe to version so we re-render on FS changes
  const version = useProjectStore(s => s.version);
  const getTree = useProjectStore(s => s.getTree);
  const selectedFile = useProjectStore(s => s.selectedFile);
  const selectFile = useProjectStore(s => s.selectFile);
  const getFileCount = useProjectStore(s => s.getFileCount);

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
}: {
  node: TreeNode;
  depth: number;
  selectedFile: string | null;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isDir = node.type === 'directory';
  const isSelected = node.path === selectedFile;

  const handleClick = () => {
    if (isDir) {
      setExpanded(!expanded);
    } else {
      onSelect(node.path);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1 w-full text-left px-2 py-0.5 text-xs hover:bg-muted/50 transition-colors ${
          isSelected ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground'
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
      {isDir && expanded && node.children?.map(child => (
        <TreeNodeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedFile={selectedFile}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}
