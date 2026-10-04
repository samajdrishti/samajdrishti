import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { RealtimeProvider } from './services/realtime';
import { InspectionProvider } from './context/InspectionContext';
import { LanguageProvider } from './context/LanguageContext';
import './styles.css';
import './ui.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RealtimeProvider>
          <InspectionProvider>
            <LanguageProvider>
              <App />
            </LanguageProvider>
          </InspectionProvider>
        </RealtimeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Register the service worker (PWA install / offline shell)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline shell is a progressive enhancement */
    });
  });
}
