/**
 * BottomNav lives in app-bar.tsx (top bar + bottom tabs travel together);
 * this re-export exists because `@/components/ui/bottom-nav` is the path
 * everyone — humans and models alike — reaches for first.
 */
export { BottomNav, BottomNavItem } from './app-bar';
