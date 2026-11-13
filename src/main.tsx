import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './shared/styles/index.css'
import App from './app/App.tsx'
import { routerBasename } from './shared/utils/routerBasename.ts'
import { registerServiceWorker } from './app/registerServiceWorker.ts'
import { installChunkReload } from './app/chunkReload.ts'
import { installErrorReporting } from './app/errorReport.ts'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root not found')
createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename()}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
try { installChunkReload(window, window.sessionStorage) } catch { }
installErrorReporting(window)
void registerServiceWorker({ prod: import.meta.env.PROD, base: import.meta.env.BASE_URL, nav: navigator })
