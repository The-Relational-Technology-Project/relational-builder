import { useState, type FormEvent } from 'react';
import { List, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/ui/empty-state';
import { NoteCard } from '@/components/NoteCard';
import { useWall } from '@/store';
import { questions } from '@/data/questions';

export default function Sort() {
  const persona = useWall((s) => s.persona);
  const setPersona = useWall((s) => s.setPersona);
  const answers = useWall((s) => s.answers);
  const themes = useWall((s) => s.themes);
  const pubs = useWall((s) => s.pubs);
  const addTheme = useWall((s) => s.addTheme);
  const removeTheme = useWall((s) => s.removeTheme);
  const assign = useWall((s) => s.assign);
  const setPub = useWall((s) => s.setPub);
  const [qId, setQId] = useState(questions[0].id);
  const [title, setTitle] = useState('');

  if (persona !== 'priya') {
    return (
      <EmptyState
        icon={<List />}
        title="Sorting is for organizers"
        hint="Switch to Priya to group notes into themes and publish what you heard."
        action={<Button onClick={() => setPersona('priya')}>View as Priya</Button>}
      />
    );
  }

  const qThemes = themes.filter((t) => t.questionId === qId);
  const qNotes = answers
    .filter((a) => a.questionId === qId)
    .sort((a, b) => Number(!!a.themeId) - Number(!!b.themeId) || b.at.localeCompare(a.at));
  const unsorted = qNotes.filter((a) => !a.themeId).length;
  const pub = pubs[qId] ?? { published: false, summary: '' };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addTheme(qId, title);
    setTitle('');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 md:max-w-md">
        <Label htmlFor="q">Question</Label>
        <Select id="q" value={qId} onChange={(e) => setQId(e.target.value)}>
          {questions.map((x, i) => <option key={x.id} value={x.id}>{i + 1}. {x.short}</option>)}
        </Select>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,360px)_1fr] md:items-start">
        <div className="flex flex-col gap-4 md:sticky md:top-24">
          <Card className="bg-card">
            <CardHeader><CardTitle className="text-lg">Themes</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {qThemes.length === 0 && <p className="text-sm text-muted-foreground">No themes yet — name the first pattern you notice.</p>}
              {qThemes.map((t) => {
                const n = qNotes.filter((a) => a.themeId === t.id).length;
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2 rounded-[var(--radius)] bg-muted px-3 py-2">
                    <span><span className="font-semibold">{t.title}</span> <span className="text-sm text-muted-foreground">· {n}</span></span>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${t.title}`} onClick={() => removeTheme(t.id)}><X className="size-4" /></Button>
                  </div>
                );
              })}
              <form onSubmit={submit} className="flex gap-2">
                <Input aria-label="New theme" placeholder="New theme" value={title} onChange={(e) => setTitle(e.target.value)} />
                <Button type="submit" variant="secondary" disabled={!title.trim()}>Add</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader><CardTitle className="text-lg">Publish what we heard</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="summary">In a sentence or two</Label>
                <Textarea id="summary" rows={3} value={pub.summary} onChange={(e) => setPub(qId, { summary: e.target.value })} />
              </div>
              <label className="flex items-center justify-between gap-3">
                <span>{pub.published ? 'Showing on What we heard' : 'Not published yet'}</span>
                <Switch checked={pub.published} onCheckedChange={(v: boolean) => setPub(qId, { published: v })} />
              </label>
            </CardContent>
          </Card>
        </div>

        <section aria-label="Notes to sort" className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{unsorted} of {qNotes.length} notes not yet in a theme</p>
          {qNotes.length === 0 ? (
            <EmptyState icon={<List />} title="No notes on this question yet" hint="They’ll appear here as people pin them." />
          ) : (
            <div className="columns-1 gap-4 lg:columns-2">
              {qNotes.map((a) => (
                <NoteCard
                  key={a.id}
                  answer={a}
                  footer={
                    <Select aria-label="Theme" value={a.themeId ?? ''} onChange={(e) => assign(a.id, e.target.value || null)}>
                      <option value="">No theme yet</option>
                      {qThemes.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </Select>
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}