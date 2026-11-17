import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './index.css';
import App from './App.tsx';
import { initAccount } from '@/features/account';
import { initEditor } from '@/features/diagram';

initEditor();
initAccount();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
