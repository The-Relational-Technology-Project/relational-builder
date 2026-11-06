import type { ComponentProps, MouseEvent } from 'react';
import type { Components } from 'react-markdown';
import { BookOpen, ExternalLink, Library, ScrollText, Wrench } from 'lucide-react';
import { isExternalHref, parseEntryHref, type EntryRef } from '@/knowledge/entry-links';
import type { RefSource } from '@/knowledge/gallery-references';

/**
 * Links in rendered markdown, wherever it renders (chat replies, gallery
 * bodies): a link to a gallery entry opens the entry's card in place, and a
 * link to the outside world opens in a new tab with a small mark that says
 * so. The person sees where a reply got something the moment they read it,
 * instead of in a footer below.
 */

const SOURCE_ICON: Record<RefSource, typeof BookOpen> = {
  commons: BookOpen,
  studio: Library,
  kb_tool: Wrench,
  kb_story: ScrollText,
};

const SOURCE_TITLE: Record<RefSource, string> = {
  commons: 'Open in the Commons Gallery',
  studio: "Open in your studio's library",
  kb_tool: 'Open this tool in the gallery',
  kb_story: 'Open this story in the gallery',
};

type AnchorProps = ComponentProps<'a'> & { node?: unknown };

/**
 * The `a` renderer for ReactMarkdown. `onOpenEntry` decides what opening an
 * entry means here: the chat sends the person to the gallery, the gallery
 * swaps the open card.
 */
export function entryLinkComponents(onOpenEntry: (ref: EntryRef) => void): Components {
  function EntryAnchor({ href, children, ...rest }: AnchorProps) {
    // react-markdown passes the hast node along; it is not an attribute
    delete (rest as { node?: unknown }).node;
    const entry = parseEntryHref(href);
    if (entry) {
      const Icon = SOURCE_ICON[entry.source];
      const open = (e: MouseEvent<HTMLAnchorElement>) => {
        // Plain click opens in place; a modifier click keeps the browser's
        // own "open in a new tab" since the address is real
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onOpenEntry(entry);
      };
      return (
        <a
          {...rest}
          href={href}
          onClick={open}
          title={SOURCE_TITLE[entry.source]}
          className="entry-link inline-flex items-baseline gap-0.5 font-medium text-primary no-underline decoration-dotted underline-offset-2 hover:underline"
        >
          <Icon className="size-3 shrink-0 self-center opacity-70" aria-hidden />
          <span>{children}</span>
        </a>
      );
    }
    if (isExternalHref(href)) {
      return (
        <a
          {...rest}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-baseline gap-0.5 underline decoration-dotted underline-offset-2 hover:text-primary"
        >
          <span>{children}</span>
          <ExternalLink className="size-2.5 shrink-0 self-center opacity-60" aria-hidden />
        </a>
      );
    }
    return <a {...rest} href={href}>{children}</a>;
  }
  return { a: EntryAnchor };
}
