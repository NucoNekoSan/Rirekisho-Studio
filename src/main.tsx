import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ReloadPrompt } from './components/ReloadPrompt.tsx'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LandingPage } from './LandingPage.tsx'
import { LegalPage } from './LegalPage.tsx'
import { siteBasePath } from './lib/sitePath.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={siteBasePath}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<App />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ReloadPrompt />
    </BrowserRouter>
  </StrictMode>,
)
