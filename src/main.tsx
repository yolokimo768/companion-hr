import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Application entry point: mounts the root <App /> component into the
// #root element defined in index.html. StrictMode enables extra
// development-only checks (e.g. double-invoking effects) to surface bugs early.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
