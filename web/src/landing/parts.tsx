import { useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { ProposedChange } from '@/components/proposed-change';
import { buttonVariants } from '@/components/ui/button';
import { Wordmark } from '@/components/wordmark';
import '@/landing.css';

// What every landing page direction shares: its words, its links and its product fragments.
// The directions differ only in how they lay these out.

export const links = {
  github: 'https://github.com/MaxJohnsen/homing',
  docs: 'https://github.com/MaxJohnsen/homing#read-more',
  selfHost: 'https://github.com/MaxJohnsen/homing/blob/main/docs/deployment.md',
  signIn: 'https://app.homing.place/sign-in',
};

export const copy = {
  title: 'A home for everything worth knowing.',
  lead: 'Your life and work don’t fit into one conversation.',
  intro: 'Homing gives your AI assistants a shared place to remember what matters, build on what they learn, and pick up where you left off.',
  note: 'Open source, and designed for Claude, ChatGPT, Copilot and more.',
  why: {
    title: 'We got tired of starting over.',
    body: 'Every new assistant meant explaining things again. Decisions were buried in chats, knowledge was scattered across apps, and things we’d learned together were easily lost.',
    close: 'We made Homing because we wanted that knowledge to stay useful.',
  },
  together: {
    title: 'Bring it all together.',
    lead: 'Keep what matters about your projects, work and everyday life in one place.',
    body: 'Each project and part of your life gets its own space. Come back weeks later without explaining everything again, switch assistants without losing the context, and let Homing help keep it all up to date.',
  },
  sharing: {
    title: 'Let others build on it, too.',
    lead: 'Some things are more useful when other people know them too.',
    body: 'Share a project decision with a colleague and their assistant, and everyone works from the same understanding. Everything else stays private.',
    rules: 'Rules change only when you say so.',
    rulesBody: 'Assistants can suggest how they should work in a space. Nothing changes until you approve it.',
  },
  start: { title: 'Make yourself at home.' },
  footer: 'Built in the open, for everyone.',
};

export const primary = cn(buttonVariants(), 'press h-11 px-6 text-[15px]');
export const outline = cn(buttonVariants({ variant: 'outline' }), 'press h-11 px-6 text-[15px]');

/** The top bar: the mark and name, and a few links. */
export function Nav({ className }: { className?: string }) {
  return (
    <header className={cn('flex items-center justify-between py-5', className)}>
      <a href="/" className="rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/70 focus-visible:outline-none">
        <Wordmark className="text-lg" />
      </a>
      <nav aria-label="Homing" className="flex items-center gap-6 text-[15px]">
        <a href="#how" className="link hidden sm:inline">How it works</a>
        <a href={links.github} className="link hidden sm:inline">GitHub</a>
        <a href={links.signIn} className="link">Sign in</a>
      </nav>
    </header>
  );
}

export function HeroActions({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row', className)}>
      <a href="#start" className={primary}>Get started</a>
      <a href="#how" className={outline}>See how it works</a>
    </div>
  );
}

// Ana's Homing: three spaces, each with a couple of things her assistants have learned.
const spaces = [
  { id: 'acme', name: 'Acme launch', notes: ['Launch is November 14', 'Cara owns the press list'] },
  { id: 'kitchen', name: 'Kitchen', notes: ['Sage green tiles, 10 × 10 cm', 'Electrician comes November 3'] },
  { id: 'race', name: 'Half marathon', notes: ['Race day is March 8', 'Long runs on Sundays'] },
];

const asks = [
  { assistant: 'Claude', question: 'When is the Acme launch?', answer: 'November 14, and Cara owns the press list.', uses: 'acme' },
  { assistant: 'ChatGPT', question: 'Which tiles did we pick?', answer: 'The sage green ones, 10 × 10 cm. The electrician comes November 3, so tiling starts after that.', uses: 'kitchen' },
  { assistant: 'Copilot', question: 'When is my race?', answer: 'March 8. Your long runs are on Sundays.', uses: 'race' },
];

/**
 * The one thing to try: ask from any assistant and see the space its answer came from. Every
 * assistant answers from the same place.
 */
export function SpacesDemo({ className, compact }: { className?: string; compact?: boolean }) {
  const [asked, setAsked] = useState(0);
  const ask = asks[asked];
  return (
    <figure className={cn('flex flex-col gap-3', className)}>
      <div data-ui className="flex flex-col gap-5 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] font-semibold">Ana’s Homing</p>
          <div role="group" aria-label="Ask from" className="flex rounded-full bg-muted p-1">
            {asks.map((item, i) => (
              <button
                key={item.assistant}
                type="button"
                aria-pressed={i === asked}
                onClick={() => setAsked(i)}
                className={cn(
                  'press rounded-full px-3.5 py-1.5 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/70 focus-visible:outline-none',
                  i === asked ? 'bg-card text-foreground ring-1 ring-input' : 'text-foreground/70 hover:text-foreground',
                )}
              >
                <span className="max-sm:sr-only">Ask </span>{item.assistant}
              </button>
            ))}
          </div>
        </div>

        <div key={asked} aria-live="polite" className="arrive flex flex-col gap-3">
          <p className="max-w-[85%] self-end rounded-2xl bg-muted px-4 py-2.5 text-[15px]">{ask.question}</p>
          <div className="flex max-w-[90%] flex-col gap-1">
            <p className="text-sm font-semibold">{ask.assistant}</p>
            <p className="text-[15px] leading-relaxed">{ask.answer}</p>
          </div>
        </div>

        <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-3')}>
          {spaces.map((space) => {
            const used = space.id === ask.uses;
            return (
              <div
                key={space.id}
                className={cn(
                  'kept flex flex-col gap-1.5 rounded-xl bg-background p-3',
                  used ? 'ring-2 ring-primary' : 'opacity-55',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{space.name}</p>
                  {used && <span className="text-xs font-medium text-primary">Used</span>}
                </div>
                {space.notes.map((note) => (
                  <p key={note} className="text-sm leading-snug">{note}</p>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <figcaption className="t-small text-muted-foreground">Every assistant answers from the same place.</figcaption>
    </figure>
  );
}

/** A conversation in an assistant: the person on the right, the assistant on the left. */
function Chat({ where, children }: { where: string; children: ReactNode }) {
  return (
    <div data-ui className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <p className="text-sm text-muted-foreground">{where}</p>
      {children}
    </div>
  );
}

function Said({ children }: { children: ReactNode }) {
  return <p className="max-w-[85%] self-end rounded-2xl bg-muted px-4 py-2.5 text-[15px]">{children}</p>;
}

function Replied({ assistant, children }: { assistant: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-semibold">{assistant}</p>
      <div className="text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}

/** Ana shares a decision, and Cara's assistant knows it. */
export function ShareSteps() {
  return (
    <>
      <Chat where="Ana, in Claude">
        <Said>The Acme launch moved to November 14.</Said>
        <Replied assistant="Claude">
          <p>Saved for you. Share it with Acme launch? Cara will see it.</p>
          <div className="mt-3 flex gap-2">
            <span className={cn(buttonVariants({ size: 'sm' }), 'px-4')}>Share</span>
            <span className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'px-4')}>Keep private</span>
          </div>
        </Replied>
      </Chat>
      <Chat where="Cara, in ChatGPT">
        <Said>When do we launch?</Said>
        <Replied assistant="ChatGPT">
          <p>November 14. Ana shared the new date on Monday.</p>
        </Replied>
      </Chat>
    </>
  );
}

/** An assistant suggests a rule, and only a person can add it. */
export function RuleCard({ className }: { className?: string }) {
  return (
    <div data-ui className={cn('flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5', className)}>
      <p className="text-lg font-semibold">Claude suggests a rule for Acme launch</p>
      <ProposedChange kind="requirement" label="Rule" text="Send status updates on Fridays." />
      <p className="text-sm text-muted-foreground">Only you can approve this.</p>
      <div className="flex gap-2">
        <span className={cn(buttonVariants({ size: 'sm' }), 'px-4')}>Add rule</span>
        <span className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'px-4')}>Don’t add</span>
      </div>
    </div>
  );
}

/** The two ways to start. Running it yourself comes first while Homing online is invite-only. */
export function StartOptions({ className }: { className?: string }) {
  return (
    <div className={cn('grid gap-10 self-start sm:grid-cols-2 sm:gap-8', className)}>
      <div className="flex flex-col gap-2">
        <h3 className="t-body font-semibold">Host Homing yourself</h3>
        <p className="t-body">Homing is open source. Run it on your own server.</p>
        <a href={links.selfHost} className={cn(primary, 'mt-auto w-full sm:w-fit')}>Read the setup guide</a>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="t-body font-semibold">Use Homing online</h3>
        <p className="t-body">Homing online is invite-only while we build it.</p>
        <a href={links.signIn} className={cn(outline, 'mt-auto w-full sm:w-fit')}>Sign in</a>
      </div>
    </div>
  );
}

/** A quiet close: the name, a line and the links. */
export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn('bg-foreground text-background [--mark-dark:#a9c2ad] [--mark-light:#d3e0d4]', className)}>
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-5 py-16 sm:px-8 sm:py-20">
        <Wordmark className="text-3xl" />
        <p className="t-lead">{copy.footer}</p>
        <div className="t-small flex flex-wrap items-center justify-between gap-4">
          <ul className="flex gap-6">
            <li><a href={links.github} className="link focus-visible:ring-[3px] focus-visible:ring-background/60 focus-visible:outline-none">GitHub</a></li>
            <li><a href={links.docs} className="link focus-visible:ring-[3px] focus-visible:ring-background/60 focus-visible:outline-none">Documentation</a></li>
          </ul>
          <p className="opacity-70">© 2026 Max Aasbø. Licensed under AGPL-3.0.</p>
        </div>
      </div>
    </footer>
  );
}
