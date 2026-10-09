/// <reference types="vite/client" />
import './index.css';
import './i18n';
import './utils/appAlert';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { startPwaUpdates } from './services/pwaUpdates';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <ErrorBoundary><App /></ErrorBoundary>
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
);

// Service worker istnieje tylko w buildzie produkcyjnym (w `vite dev` go nie ma).
if (import.meta.env.PROD) startPwaUpdates();
