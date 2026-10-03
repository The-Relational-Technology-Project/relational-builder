import { History } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { useHistoryStore } from '@/store/history-store';

/**
 * The header's door to the project's versions. One click shows History in
 * the chat pane's place; another brings the chat back. It sits beside the
 * project's name because the versions are the project's — not the chat's.
 */
export function HistoryToggle() {
  const open = useHistoryStore(s => s.open);
  const toggle = useHistoryStore(s => s.toggle);
  return (
    <button
      onClick={toggle}
      aria-pressed={open}
      title={open ? 'Back to the chat' : 'Version history'}
      className={
        buttonVariants({ variant: open ? 'secondary' : 'ghost', size: 'sm' }) +
        ' h-7 gap-1 text-xs shrink-0'
      }
    >
      <History className="size-3.5" />
      History
    </button>
  );
}
