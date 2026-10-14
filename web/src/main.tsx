import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Wordmark } from '@/components/wordmark';
import { proposal } from '@/sample';
import { CardPreview } from '@/screens/card-preview';
import { Confirm } from '@/screens/confirm';
import { SignIn } from '@/screens/sign-in';
import './styles.css';

// Sample screens until #5 and #4 give them real data. Each state has its own address for review.
const screens: Record<string, { label: string; render: () => ReactNode }> = {
  '/sign-in': { label: 'Sign in', render: () => <SignIn /> },
  '/sign-in/connect': { label: 'Sign in to connect Claude', render: () => <SignIn connecting="Claude" /> },
  '/sign-in/email': { label: 'Sign in with email', render: () => <SignIn initial="email" /> },
  '/sign-in/wrong': { label: 'Wrong password', render: () => <SignIn initial="wrong" /> },
  '/confirm': { label: 'Confirm a rule', render: () => <Confirm proposal={proposal} /> },
  '/confirm/added': { label: 'Rule added', render: () => <Confirm proposal={proposal} initial="added" /> },
  '/confirm/declined': { label: 'Rule not added', render: () => <Confirm proposal={proposal} initial="declined" /> },
  '/card-preview': { label: 'Approval card in Claude and ChatGPT', render: () => <CardPreview /> },
};

function Index() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <Wordmark className="text-lg" />
      <h1 className="text-2xl font-semibold tracking-tight">Screens</h1>
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {Object.entries(screens).map(([path, screen]) => (
          <li key={path}>
            <a href={path} className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
              {screen.label}
              <span className="text-xs text-muted-foreground">{path}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}

const screen = screens[location.pathname.replace(/\/$/, '')];

createRoot(document.getElementById('root')!).render(<StrictMode>{screen ? screen.render() : <Index />}</StrictMode>);
