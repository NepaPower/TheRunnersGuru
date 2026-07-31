import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import './app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* basename must match vite.config.ts's `base` — otherwise every
        internal navigate() drops the "/TheRunnersGuru/" prefix that
        GitHub Pages project sites are served under, breaking refresh
        and direct links to any screen other than the homepage. */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
