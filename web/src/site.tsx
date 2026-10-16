import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Landing } from '@/screens/landing';
import './styles.css';

// homing.place: the landing page on its own, built by `npm run build:site`.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
