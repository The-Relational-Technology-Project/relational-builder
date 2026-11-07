import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Snowflake, Calendar } from 'lucide-react';
import { AppBar, AppBarTitle } from '@/components/ui/app-bar';
import { BottomNav, BottomNavItem } from '@/components/ui/bottom-nav';
import { Avatar } from '@/components/ui/avatar';
import { StatusCard, PostForm, UpdateFeed } from '@/components/FridgeBoard';
import { ShiftBoard } from '@/components/ShiftBoard';
import { useFridge } from '@/store';
import { people, STEWARD, type PersonId } from '@/data/seed';

function PersonaToggle() {
  const me = useFridge((s) => s.me);
  const setMe = useFridge((s) => s.setMe);
  const options: { id: PersonId; label: string }[] = [
    { id: 'you', label: 'You' },
    { id: 'marisol', label: 'Marisol (example)' },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-muted-foreground sm:inline">Acting as</span>
      <div className="flex rounded-full border border-border bg-muted p-1" role="group" aria-label="Acting as">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={me === o.id}
            onClick={() => setMe(o.id)}
            className={`min-h-9 rounded-full px-3 text-sm font-bold transition-colors ${
              me === o.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StewardLine() {
  return (
    <div className="flex items-center gap-3 px-1 text-muted-foreground">
      <Avatar name={people[STEWARD].name} />
      <p className="text-base">
        <span className="font-bold text-foreground">Marisol</span> tends this fridge — she's usually out front Sunday mornings. Say hi.
      </p>
    </div>
  );
}

function FridgePage() {
  return (
    <div className="md:grid md:grid-cols-[1fr_380px] md:gap-8">
      <div className="space-y-5">
        <StatusCard />
        <StewardLine />
        <PostForm />
        <UpdateFeed />
      </div>
      <aside className="hidden md:block">
        <div className="sticky top-24">
          <ShiftBoard />
        </div>
      </aside>
    </div>
  );
}

function Shell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh pb-28 md:pb-12">
      <AppBar>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <AppBarTitle className="font-display text-2xl font-extrabold">Judah St Fridge</AppBarTitle>
            <p className="truncate text-sm text-muted-foreground">Outside the laundromat · Outer Sunset</p>
          </div>
          <PersonaToggle />
        </div>
      </AppBar>
      <main className="mx-auto max-w-5xl px-4 pt-5">
        <Routes>
          <Route path="/" element={<FridgePage />} />
          <Route path="/shifts" element={<ShiftBoard />} />
        </Routes>
      </main>
      <div className="md:hidden">
        <BottomNav>
          <BottomNavItem icon={<Snowflake />} label="Fridge" active={pathname === '/'} onClick={() => navigate('/')} />
          <BottomNavItem icon={<Calendar />} label="Shifts" active={pathname === '/shifts'} onClick={() => navigate('/shifts')} />
        </BottomNav>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}