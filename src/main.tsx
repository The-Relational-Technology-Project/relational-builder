import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Landing } from './components/Landing.tsx'
import { initTheme } from './theme.ts'
import { useChatStore } from './store/chat-store.ts'
import { useProjectStore } from './store/project-store.ts'

initTheme()

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
