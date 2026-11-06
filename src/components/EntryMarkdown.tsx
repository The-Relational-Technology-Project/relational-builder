import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { linkifyEntries, type EntryLinkTarget, type EntryRef } from '@/knowledge/entry-links';
import { entryLinkComponents } from '@/components/entry-link-components';
import { useUIStore } from '@/store/ui-store';

/**
 * Markdown with gallery entries linked in place: first mentions of the given
 * entries become links (see linkifyEntries), and every link renders through
 * entryLinkComponents. Without `onOpenEntry`, an entry link sends the person
 * to the gallery via the UI store.
 */
export function EntryMarkdown({
  children,
  entries,
  onOpenEntry,
  className,
  components,
}: {
  children: string;
  entries?: EntryLinkTarget[];
  onOpenEntry?: (ref: EntryRef) => void;
  className?: string;
  /** Extra ReactMarkdown renderers, merged under the link renderer */
  components?: Components;
}) {
  const text = useMemo(
    () => (entries && entries.length > 0 ? linkifyEntries(children, entries).text : children),
    [children, entries],
  );
  const open = onOpenEntry ?? defaultOpenEntry;
  const merged = useMemo(() => ({ ...components, ...entryLinkComponents(open) }), [components, open]);
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={merged}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function defaultOpenEntry(ref: EntryRef): void {
  useUIStore.getState().openGalleryEntry(ref.source, ref.id);
}
