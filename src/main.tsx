import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.DEV) {
  // Testdaten im Entwicklungsmodus: window.depriSeed() / window.depriClear()
  import('./lib/seed').then((m) => {
    Object.assign(window, { depriSeed: m.seed, depriClear: m.clearAll })
  })
}
