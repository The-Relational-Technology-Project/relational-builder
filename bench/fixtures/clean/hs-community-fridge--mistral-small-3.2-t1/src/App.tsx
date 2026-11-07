import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppBar, AppBarTitle } from '@/components/ui/app-bar';
import { BottomNav, BottomNavItem } from '@/components/ui/bottom-nav';
import { House, List, Calendar, Users } from 'lucide-react';
import HomePage from './pages/Home';
import PostsPage from './pages/Posts';
import ShiftsPage from './pages/Shifts';
import AboutPage from './pages/About';

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col">
        <AppBar>
          <AppBarTitle>Judah St Community Fridge</AppBarTitle>
        </AppBar>

        <main className="flex-1 container mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/posts" element={<PostsPage />} />
            <Route path="/shifts" element={<ShiftsPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </main>

        <BottomNav>
          <BottomNavItem to="/" icon={<House />}>
            Home
          </BottomNavItem>
          <BottomNavItem to="/posts" icon={<List />}>
            Posts
          </BottomNavItem>
          <BottomNavItem to="/shifts" icon={<Calendar />}>
            Shifts
          </BottomNavItem>
          <BottomNavItem to="/about" icon={<Users />}>
            About
          </BottomNavItem>
        </BottomNav>
      </div>
    </HashRouter>
  );
}