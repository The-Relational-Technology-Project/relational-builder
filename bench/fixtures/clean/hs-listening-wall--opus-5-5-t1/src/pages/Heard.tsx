import { BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { useWall, meTooCount } from '@/store';
import { questions, steward } from '@/data/questions';

export default function Heard() {
  const answers = useWall((s) => s.answers);
  const themes = useWall((s) => s.themes);
  const pubs = useWall((s) => s.pubs);
  const published = questions.filter((q) => pubs[q.id]?.published);

  if (published.length === 0) {
    return <EmptyState icon={<BookOpen />} title="Nothing published yet" hint="Once the notes are read and grouped, what we heard will appear here." />;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Avatar name={steward.name} />
        <span>Gathered by {steward.name} <span className="opacity-75">(example)</span> from the notes on the wall.</span>
      </div>

      {published.map((q) => {
        const notes = answers.filter((a) => a.questionId === q.id);
        const qThemes = themes.filter((t) => t.questionId === q.id);
        const loose = notes.filter((a) => !a.themeId).length;
        return (
          <article key={q.id} className="flex flex-col gap-4">
            <h2 className="font-display text-3xl font-semibold leading-tight md:text-4xl">{q.text}</h2>
            {pubs[q.id].summary && <p className="text-base">{pubs[q.id].summary}</p>}
            <div className="grid gap-4 md:grid-cols-2">
              {qThemes.map((t) => {
                const inTheme = notes.filter((a) => a.themeId === t.id);
                if (inTheme.length === 0) return null;
                const voices = inTheme.reduce((sum, a) => sum + 1 + meTooCount(a), 0);
                return (
                  <Card key={t.id} className="note bg-card">
                    <CardContent className="flex flex-col gap-3 p-5">
                      <h3 className="text-lg font-semibold">{t.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {inTheme.length} {inTheme.length === 1 ? 'note' : 'notes'}, {voices} voices including me-toos
                      </p>
                      {inTheme.slice(0, 2).map((a) => (
                        <blockquote key={a.id} className="border-l-2 border-border pl-3">
                          “{a.text}” <span className="text-sm text-muted-foreground">— {a.name ?? 'Anonymous'}</span>
                        </blockquote>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {loose > 0 && (
              <p className="text-sm text-muted-foreground">
                And {loose} more {loose === 1 ? 'note' : 'notes'} still being read — every one counts.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}