import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing>
      <App />
    </Landing>
  </StrictMode>,
)
