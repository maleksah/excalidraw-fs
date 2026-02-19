import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import "@excalidraw/excalidraw/index.css";
import App from './App.tsx'
import { FileSystemProvider } from './context/FileSystemContext'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// Polyfill process for Excalidraw
(window as any).process = (window as any).process || { env: { NODE_ENV: 'development' } };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <FileSystemProvider>
        <App />
      </FileSystemProvider>
    </ErrorBoundary>
  </StrictMode>,
)
