import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

// =============================================================================
// TRADESUITE PWA — Entry Point
//
// Initialization order:
//   1. Render React tree (providers initialize themselves lazily)
//   2. AuthProvider checks Supabase session
//   3. PowerSyncProvider connects once session is confirmed
//   4. App shell renders with correct module visibility
// =============================================================================

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
