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
  '/recover': lazy(() => import('@/pages/recover').then((page) => ({ default: page.RecoverPage }))),
  '/proposals/:id': lazy(() => import('@/pages/proposal').then((page) => ({ default: page.ProposalPage }))),
};

// A page's address, without what identifies the thing on it, such as /proposals/<id>.
const path = location.pathname.replace(/\/$/, '').replace(/^(\/proposals)\/[0-9a-f-]{36}$/i, '$1/:id');

const Page = import.meta.env.DEV
  ? lazy(() => import('@/samples').then((samples) => ({ default: samples.Samples })))
  : (pages[path] ?? NotFound);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense>
      <Page />
    </Suspense>
  </StrictMode>,
);
