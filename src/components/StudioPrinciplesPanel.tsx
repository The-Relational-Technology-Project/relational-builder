import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { StudioLibraryItem } from '@/cloud/studio-library';

/**
 * The studio's live frame: its principles, always on for member builds.
 * A quiet banner with the names; each expands to its full text on tap.
 */
export function StudioPrinciplesPanel({
  studioLabel, principles,
}: {
  studioLabel: string; principles: StudioLibraryItem[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (principles.length === 0) return null;
  return (
    <section className="rounded-xl border border-dashed px-4 py-3 space-y-2">
      <p className="text-sm">
        <span className="font-medium">{studioLabel}'s principles are live in your builds</span>
        <span className="text-muted-foreground">
          {' '}— they layer on top of the Relational Tech principles in every chat and build while you work as a member.
        </span>
      </p>
      <div className="flex flex-wrap gap-1">
        {principles.map(p => (
          <button
            key={p.id}
            onClick={() => setOpenId(openId === p.id ? null : p.id)}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
              openId === p.id
                ? 'bg-foreground text-background border-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.title}
          </button>
        ))}
      </div>
      {openId && (() => {
        const p = principles.find(x => x.id === openId);
        if (!p) return null;
        return (
          <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm space-y-1">
            <p className="font-medium">{p.title}</p>
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground [&_p]:leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {p.body ?? p.summary ?? ''}
              </ReactMarkdown>
            </div>
          </div>
        );
      })()}
    </section>
  );
}
