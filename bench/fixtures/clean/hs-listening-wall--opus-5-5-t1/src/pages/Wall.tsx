import { useState, type FormEvent } from 'react';
import { MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { NoteCard } from '@/components/NoteCard';
import { useWall } from '@/store';
import { questions, steward } from '@/data/questions';

const MAX = 280;

function PinForm({ questionId }: { questionId: string }) {
  const pin = useWall((s) => s.pin);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [done, setDone] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    pin(questionId, text, name);
    setText('');
    setDone(true);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="answer">Your answer</Label>
        <Textarea
          id="answer"
          rows={3}
          maxLength={MAX}
          value={text}
          onChange={(e) => { setText(e.target.value); setDone(false); }}
          placeholder="A sentence or two is plenty"
        />
        <span className="self-end text-sm text-muted-foreground">{MAX - text.length} left</span>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="name">First name, or leave blank to stay anonymous</Label>
        <Input id="name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!text.trim()}>Pin it to the wall</Button>
        {done && <span className="text-sm text-muted-foreground" role="status">Pinned — thank you.</span>}
      </div>
    </form>
  );
}

export default function Wall() {
  const answers = useWall((s) => s.answers);
  const [qId, setQId] = useState(questions[0].id);
  const q = questions.find((x) => x.id === qId)!;
  const notes = answers.filter((a) => a.questionId === qId).sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Questions">
        {questions.map((x, i) => {
          const n = answers.filter((a) => a.questionId === x.id).length;
          const on = x.id === qId;
          return (
            <button
              key={x.id}
              role="tab"
              aria-selected={on}
              onClick={() => setQId(x.id)}
              className={`min-h-14 rounded-[var(--radius)] border px-3 py-2 text-left text-sm ${
                on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary'
              }`}
            >
              <span className="block font-semibold">{i + 1}. {x.short}</span>
              <span className={on ? 'opacity-90' : 'text-muted-foreground'}>{n} {n === 1 ? 'note' : 'notes'}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,360px)_1fr] md:items-start">
        <Card className="bg-card md:sticky md:top-24">
          <CardContent className="flex flex-col gap-4 p-5">
            <h1 className="font-display text-3xl font-semibold leading-tight md:text-4xl">{q.text}</h1>
            <PinForm questionId={qId} />
            <div className="flex items-center gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
              <Avatar name={steward.name} />
              <span>{steward.name} <span className="opacity-75">(example)</span> {steward.line}.</span>
            </div>
          </CardContent>
        </Card>

        <section aria-label="Notes on the wall">
          {notes.length === 0 ? (
            <EmptyState icon={<MessageCircle />} title="Nothing pinned here yet" hint="Yours could be the first note on this question." />
          ) : (
            <div className="columns-1 gap-4 lg:columns-2">
              {notes.map((a) => <NoteCard key={a.id} answer={a} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}