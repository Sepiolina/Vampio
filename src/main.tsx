import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { I18nProvider } from './i18n';
import { UserRoleProvider } from './context/UserRoleContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import './index.css';

// Initialize Tauri detection immediately on window/globalThis
if (typeof window !== 'undefined') {
  if ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__) {
    (window as any).isTauri = true;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <UserRoleProvider>
        <WorkspaceProvider>
          <App />
        </WorkspaceProvider>
      </UserRoleProvider>
    </I18nProvider>
  </StrictMode>,
);


