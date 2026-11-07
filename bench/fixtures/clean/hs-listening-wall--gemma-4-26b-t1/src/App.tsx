import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppBar, AppBarTitle } from '@/components/ui/app-bar';
import { BottomNav, BottomNavItem } from '@/components/ui/bottom-nav';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { create } from 'zustand';
import { Heart, MessageSquare, ClipboardList, Plus, Home, TrendingUp } from 'lucide-react';
import { useState, useMemo } from 'react';

// --- Types ---
type Response = {
  id: string;
  questionId: string;
  text: string;
  author: string; // "Anonymous" or name
  meTooCount: number;
  timestamp: number;
};

type Question = {
  id: string;
  text: string;
};

type Theme = {
  id: string;
  title: string;
  responses: string[]; // Array of response IDs
};

// --- Store ---
interface WallState {
  questions: Question[];
  responses: Response[];
  themes: Theme[];
  addResponse: (res: Omit<Response, 'id' | 'meTooCount' | 'timestamp'>) => void;
  addMeToo: (id: string) => void;
  addTheme: (theme: Theme) => void;
}

const useWallStore = create<WallState>((set) => ({
  questions: [
    { id: 'q1', text: "How can we better support local independent businesses in the town center?" },
    { id: 'q2', text: "What changes would make our local green spaces feel safer and more welcoming?" },
    { id: 'q3', text: "Where should the council focus its next budget for youth community services?" },
  ],
  responses: [
    { id: 'r1', questionId: 'q1', text: "More regular market days in the square would help visibility.", author: "Sarah", meTooCount: 4, timestamp: Date.now() - 100000 },
    { id: 'r2', questionId: 'q1', text: "Reduced parking fees for shoppers on weekdays.", author: "Anonymous", meTooCount: 2, timestamp: Date.now() - 200000 },
    { id: 'r3', questionId: 'q2', text: "Better lighting along the river path near the bridge.", author: "James", meTooCount: 8, timestamp: Date.now() - 300000 },
    { id: 'r4', questionId: 'q2', text: "More benches placed in the shade of the big oaks.", author: "Anonymous", meTooCount: 1, timestamp: Date.now() - 400000 },
    { id: 'r5', questionId: 'q3', text: "An evening workshop space for creative arts.", author: "Leo", meTooCount: 5, timestamp: Date.now() - 500000 },
    { id: 'r6', questionId: 'q3', text: "More organized sports clubs that are low-cost.", author: "Anonymous", meTooCount: 3, timestamp: Date.now() - 600000 },
  ],
  themes: [],
  addResponse: (res) => set((state) => ({
    responses: [...state.responses, { ...res, id: Math.random().toString(36).substr(2, 9), meTooCount: 0, timestamp: Date.now() }]
  })),
  addMeToo: (id) => set((state) => ({
    responses: state.responses.map(r => r.id === id ? { ...r, meTooCount: r.meTooCount + 1 } : r)
  })),
  addTheme: (theme) => set((state) => ({ themes: [...state.themes, theme] })),
}));

// --- Components ---

const ResponseCard = ({ response, onMeToo }: { response: Response, onMeToo: (id: string) => void }) => (
  <Card className="mb-4 shadow-sm">
    <CardContent className="pt-6">
      <p className="text-base leading-relaxed mb-4">"{response.text}"</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={response.author} />
          <span className="text-sm text-muted-foreground">{response.author}</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 text-muted-foreground hover:text-accent"
          onClick={() => onMeToo(response.id)}
        >
          <Heart className={`w-4 h-4 ${response.meTooCount > 0 ? 'fill-accent text-accent' : ''}`} />
          <span className="text-sm">{response.meTooCount}</span>
        </Button>
      </div>
    </CardContent>
  </Card>
);

const QuestionView = ({ question, responses, onAdd }: { question: Question, responses: Response[], onAdd: (qId: string) => void }) => {
  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-xl leading-tight">{question.text}</CardTitle>
        </CardHeader>
        <CardFooter>
          <Button onClick={() => onAdd(question.id)} className="w-full gap-2">
            <Plus className="w-4 h-4" /> Pin your answer
          </Button>
        </CardFooter>
      </Card>

      <div className="space-y-4">
        {responses.length === 0 ? (
          <EmptyState 
            icon={<MessageSquare />} 
            title="No answers yet" 
            hint="Be the first to share your thoughts on this question." 
          />
        ) : (
          responses.map(r => (
            <ResponseCard key={r.id} response={r} onMeToo={() => {}} /> // handle in parent
          ))
        )}
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const { questions, responses, themes, addResponse, addMeToo, addTheme } = useWallStore();
  const [activeTab, setActiveTab] = useState('wall');
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [newAuthor, setNewAuthor] = useState('');

  // Persona switcher for demo
  const [isOrganizer, setIsOrganizer] = useState(false);

  // Filter responses for the wall
  const wallResponses = useMemo(() => [...responses].sort((a, b) => b.timestamp - a.timestamp), [responses]);

  const handleAddResponse = (qId: string) => {
    setCurrentQuestionId(qId);
    setIsAdding(true);
  };

  const submitResponse = () => {
    if (!newText || !currentQuestionId) return;
    addResponse({
      questionId: currentQuestionId,
      text: newText,
      author: newAuthor.trim() || "Anonymous"
    });
    setNewText('');
    setNewAuthor('');
    setIsAdding(false);
  };

  return (
    <HashRouter>
      <div className="min-h-screen pb-20 md:pb-0">
        <AppBar>
          <AppBarTitle>Frome Listening Wall</AppBarTitle>
        </AppBar>

        <main className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-semibold">Town Voice</h1>
              <p className="text-muted-foreground">Listening to our community this season.</p>
            </div>
            <Button variant="outline" onClick={() => setIsOrganizer(!isOrganizer)}>
              {isOrganizer ? "Exit Steward Mode" : "Steward Login"}
            </Button>
          </div>

          <Tabs defaultValue="wall" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="wall">The Wall</TabsTrigger>
              <TabsTrigger value="themes">Themes</TabsTrigger>
              <TabsTrigger value="questions">Questions</TabsTrigger>
            </TabsList>

            <TabsContent value="wall" className="space-y-6">
              {/* Summary Card */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-semibold">{questions.length}</p>
                      <p className="text-sm text-muted-foreground">Questions</p>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{responses.length}</p>
                      <p className="text-sm text-muted-foreground">Answers</p>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <p className="text-2xl font-semibold">{themes.length}</p>
                      <p className="text-sm text-muted-foreground">Themes Found</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6">
                {wallResponses.map(r => {
                  const q = questions.find(q => q.id === r.questionId);
                  return (
                    <Card key={r.id} className="group">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                              {q?.text.substring(0, 40)}...
                            </p>
                            <p className="text-lg mb-4">"{r.text}"</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Avatar name={r.author} />
                                <span className="text-sm">{r.author}</span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => addMeToo(r.id)}
                              >
                                <Heart className={`w-4 h-4 mr-1 ${r.meTooCount > 0 ? 'fill-accent text-accent' : ''}`} />
                                {r.meTooCount}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {responses.length === 0 && <EmptyState icon={<MessageSquare />} title="The wall is quiet" hint="Be the first to speak." />}
              </div>
            </TabsContent>

            <TabsContent value="questions" className="space-y-6">
              <div className="grid gap-6">
                {questions.map(q => (
                  <QuestionView 
                    key={q.id} 
                    question={q} 
                    responses={responses.filter(r => r.questionId === q.id)} 
                    onAdd={handleAddResponse}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="themes">
              {isOrganizer ? (
                <div className="space-y-4">
                   <Card>
                    <CardHeader><CardTitle>Create a Theme</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <Input placeholder="Theme Name (e.g. Safety & Lighting)" />
                      <Button className="w-full">Group Responses</Button>
                    </CardContent>
                  </Card>
                  <div className="text-center py-12 text-muted-foreground">
                    Theme grouping tools coming in the next update.
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {themes.length === 0 ? (
                    <EmptyState icon={<TrendingUp />} title="No themes published" hint="As organizers group answers, summaries will appear here." />
                  ) : (
                    themes.map(t => (
                      <Card key={t.id}>
                        <CardHeader><CardTitle>{t.title}</CardTitle></CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">{t.responses.length} responses captured in this theme.</p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>

        {/* Pinning Dialog */}
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Pin your answer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Your thoughts</label>
                <Textarea 
                  placeholder="What would you like to say?" 
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Name (optional)</label>
                <Input 
                  placeholder="First name or Anonymous" 
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button onClick={submitResponse}>Post to Wall</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <BottomNav className="md:hidden">
          <BottomNavItem icon={<Home />} label="Wall" active={activeTab === 'wall'} onClick={() => setActiveTab('wall')} />
          <BottomNavItem icon={<TrendingUp />} label="Themes" active={activeTab === 'themes'} onClick={() => setActiveTab('themes')} />
          <BottomNavItem icon={<ClipboardList />} label="Questions" active={activeTab === 'questions'} onClick={() => setActiveTab('questions')} />
        </BottomNav>
      </div>
    </HashRouter>
  );
}