import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Landing } from './components/Landing.tsx'
import { initTheme } from './theme.ts'
import { captureInviteFromUrl } from './cloud/invite-link.ts'
import { useChatStore } from './store/chat-store.ts'
import { useProjectStore } from './store/project-store.ts'

initTheme()
// Before anything renders: the invite params have to be stashed and scrubbed
// while they still exist. Signing in bounces through a magic link that returns
// to the bare site root, so the query string does not survive the trip.
captureInviteFromUrl()

// Dev-only handles for driving/inspecting state from the console
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>
  w.__rbChat = useChatStore
  w.__rbProject = useProjectStore
}

// The app itself loads only once someone is through the door — the landing
// page (most first visits) costs its own chunk, not the whole builder
// eslint-disable-next-line react-refresh/only-export-components -- entry file, nothing hot-reloads into it
const App = lazy(() => import('./App.tsx'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing>
      <Suspense fallback={null}>
        <App />
      </Suspense>
    </Landing>
  </StrictMode>,
)
