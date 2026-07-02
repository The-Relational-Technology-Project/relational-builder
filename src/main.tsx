import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Landing } from './components/Landing.tsx'
import { initTheme } from './theme.ts'
import { useChatStore } from './store/chat-store.ts'

initTheme()

// Dev-only handle for driving/inspecting chat state from the console
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__rbChat = useChatStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing>
      <App />
    </Landing>
  </StrictMode>,
)
