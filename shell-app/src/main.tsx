import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';
import './auth/authGlobal';
import { registerMFEs, startSingleSpa } from './root-config';


registerMFEs();


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App onSingleSpaReady={startSingleSpa} />
    </BrowserRouter>
  </React.StrictMode>
);
