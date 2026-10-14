import { StrictMode, lazy, Suspense, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { NotFound } from '@/screens/not-found';
import './styles.css';

// Each page loads only what it needs. The development server shows every screen with sample data instead.
const pages: Record<string, ComponentType> = {
  '/sign-in': lazy(() => import('@/pages/sign-in').then((page) => ({ default: page.SignInPage }))),
  '/setup': lazy(() => import('@/pages/join').then((page) => ({ default: page.JoinPage }))),
  '/join': lazy(() => import('@/pages/join').then((page) => ({ default: page.JoinPage }))),
  '/account': lazy(() => import('@/pages/account').then((page) => ({ default: page.AccountPage }))),
  '/connect': lazy(() => import('@/pages/connect').then((page) => ({ default: page.ConnectPage }))),
};

const Page = import.meta.env.DEV
  ? lazy(() => import('@/samples').then((samples) => ({ default: samples.Samples })))
  : (pages[location.pathname.replace(/\/$/, '')] ?? NotFound);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense>
      <Page />
    </Suspense>
  </StrictMode>,
);
