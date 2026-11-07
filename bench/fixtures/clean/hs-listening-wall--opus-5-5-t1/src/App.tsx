import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, BookOpen, List } from 'lucide-react';
import { AppBar, AppBarTitle } from '@/components/ui/app-bar';
import { BottomNav, BottomNavItem } from '@/components/ui/bottom-nav';
import { useWall, personas } from '@/store';
import Wall from '@/pages/Wall';
import Heard from '@/pages/Heard';
import Sort from '@/pages/Sort';

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const persona = useWall((s) => s.persona);
  const setPersona = useWall((s) => s.setPersona);

  const nav = [
    { to: '/', label: 'The wall', icon: <MessageCircle /> },
    { to: '/heard', label: 'What we heard', icon: <BookOpen /> },
    ...(persona === 'priya' ? [{ to: '/sort', label: 'Sort notes', icon: <List /> }] : []),
  ];

  return (
    <div className="min-h-screen">
      <AppBar>
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-6">
            <AppBarTitle>
              <span className="font-display text-lg font-semibold">Frome Listening Wall</span>
            </AppBarTitle>
            <nav className="hidden gap-1 md:flex">
              {nav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`rounded-[var(--radius)] px-3 py-2 text-sm ${
                    location.pathname === n.to
                      ? 'bg-secondary font-semibold text-secondary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1 rounded-[var(--radius)] bg-muted p-1 text-sm" role="group" aria-label="Viewing as">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => setPersona(p.id)}
                aria-pressed={persona === p.id}
                className={`min-h-9 rounded-[calc(var(--radius)-2px)] px-3 ${
                  persona === p.id ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </AppBar>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:pb-12">
        <Routes>
          <Route path="/" element={<Wall />} />
          <Route path="/heard" element={<Heard />} />
          <Route path="/sort" element={<Sort />} />
        </Routes>
      </main>

      <div className="md:hidden">
        <BottomNav>
          {nav.map((n) => (
            <BottomNavItem
              key={n.to}
              icon={n.icon}
              label={n.label}
              active={location.pathname === n.to}
              onClick={() => navigate(n.to)}
            />
          ))}
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