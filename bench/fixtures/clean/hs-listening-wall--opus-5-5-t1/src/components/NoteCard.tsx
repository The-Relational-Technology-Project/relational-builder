import type { ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Check, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWall, meTooCount, type Answer } from '@/store';

export function NoteCard({ answer, footer }: { answer: Answer; footer?: ReactNode }) {
  const persona = useWall((s) => s.persona);
  const toggleMeToo = useWall((s) => s.toggleMeToo);
  const mine = answer.metooBy.includes(persona);
  const count = meTooCount(answer);

  return (
    <Card className="note mb-4 break-inside-avoid bg-card">
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="text-base leading-relaxed">“{answer.text}”</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            — {answer.name ?? 'Anonymous'} · {formatDistanceToNow(new Date(answer.at), { addSuffix: true })}
          </span>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={mine}
            onClick={() => toggleMeToo(answer.id)}
            className={mine ? 'border-accent bg-accent text-accent-foreground hover:bg-accent' : ''}
          >
            {mine ? <Check className="size-4" /> : <Plus className="size-4" />}
            Me too{count > 0 ? ` · ${count}` : ''}
          </Button>
        </div>
        {footer}
      </CardContent>
    </Card>
  );
}