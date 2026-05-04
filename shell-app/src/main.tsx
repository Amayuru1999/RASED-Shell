import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';
// Import global type augmentation for window.__RAS_AUTH__
import './auth/authGlobal';
import { registerMFEs, startSingleSpa } from './root-config';

// ─── Register MFEs eagerly (routing logic only — no code loaded yet) ──────────
// Single-SPA registers routes here; actual MFE code is lazy-loaded by the
// browser only when activeWhen() returns true. Auth state is passed via customProps.
registerMFEs();

// ─── Render the Shell React app ───────────────────────────────────────────────
// Single-SPA is started inside AuthProvider.onReady to prevent MFEs from
// mounting before auth state resolves (eliminates the race condition).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App onSingleSpaReady={startSingleSpa} />
    </BrowserRouter>
  </React.StrictMode>
);
