import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Landing } from './components/Landing.tsx'
import { initTheme } from './theme.ts'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing>
      <App />
    </Landing>
  </StrictMode>,
)
