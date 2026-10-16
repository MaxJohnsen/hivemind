import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from 'cn';
import { OnlyYou } from '@/components/only-you';
import { ProposedChange } from '@/components/proposed-change';
import { buttonVariants } from '@/components/ui/button';
import { Mark, Wordmark } from '@/components/wordmark';
import birdStanding from '@/assets/illustrations/bird-standing.jpg';
import connected from '@/assets/illustrations/connected.png';
import resting from '@/assets/illustrations/empty.png';
import together from '@/assets/illustrations/signin.png';
import '@/landing.css';

const github = 'https://github.com/MaxJohnsen/homing';
const docs = `${github}#read-more`;
const selfHost = `${github}/blob/main/docs/deployment.md`;
const hosted = 'https://app.homing.place/sign-in';

/**
 * The landing page: what Homing is, why it exists, and the two ways to start. It reads like a
 * printed feature. Every heading and text column hangs from one axis at five twelfths of the
 * width, the space to its left holds drawings and side notes, and the paper bird carries the
 * page from the masthead to its box at the end.
 */
export function Landing() {
  const root = useMotion();
  return (
    <div ref={root} className="landing bg-background text-foreground">
      <main className="pb-24 sm:pb-40">
        <Masthead />
        <Why />
        <Together />
        <Sharing />
        <Start />
      </main>
      <Footer />
    </div>
  );
}

/** Twelve columns with the page's one pair of margins. The axis is column 6. */
function Grid({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('grid grid-cols-12 gap-x-6 px-5 sm:px-8', className)}>{children}</div>;
}

/** Revealed in turn as its section comes into view. */
function reveal(i: number) {
  return { 'data-reveal': '', style: { '--i': i } as CSSProperties };
}

const primary = cn(buttonVariants(), 'press h-11 px-6 text-[15px]');
const outline = cn(buttonVariants({ variant: 'outline' }), 'press h-11 px-6 text-[15px]');

function Masthead() {
  return (
    <header>
      <Grid className="items-center py-5">
        <a href="/" className="col-span-6 w-fit rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/70 focus-visible:outline-none">
          <Wordmark className="text-lg" />
        </a>
        <nav aria-label="Homing" className="col-span-6 flex items-center justify-end gap-6 text-[15px]">
          <a href="#how" className="link hidden md:inline">How it works</a>
          <a href="#start" className="link hidden md:inline">Self-host</a>
          <a href={github} className="link hidden sm:inline">GitHub</a>
          <a href="#start" className={cn(buttonVariants({ variant: 'outline' }), 'press h-9 px-4 text-[15px]')}>Get started</a>
        </nav>
      </Grid>

      <div className="px-3 sm:px-4">
        <div data-shutter className="shutter flex h-[34svh] min-h-64 items-end justify-center overflow-hidden rounded-[1.75rem] bg-muted sm:min-h-80">
          {/* The bird brings what it learned home to the shelf. */}
          <img src={connected} alt="" width={960} height={640} className="h-[128%] w-auto max-w-none translate-y-[14%]" />
        </div>
      </div>

      <Grid className="pt-8 sm:pt-10">
        <h1 className="t-display col-span-12 font-semibold" {...reveal(0)}>
          A home for everything
          <br className="hidden sm:block" /> worth knowing.
        </h1>
        <p className="t-small col-span-12 mt-8 self-end text-muted-foreground max-md:order-last md:col-span-4 md:mt-0" {...reveal(3)}>
          Open source. Works with the assistants you already use.
        </p>
        <div className="col-span-12 mt-6 flex max-w-2xl flex-col gap-5 md:col-span-7 md:col-start-6 md:mt-8">
          <p className="t-lead" {...reveal(1)}>Your life and work don’t fit into one conversation.</p>
          <p className="t-body max-w-[38ch]" {...reveal(2)}>
            Homing gives your AI assistants a shared place to remember what matters, build on what they learn, and pick up where you left off.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row" {...reveal(3)}>
            <a href="#start" className={primary}>Get started</a>
            <a href="#how" className={outline}>See how it works</a>
          </div>
        </div>
      </Grid>
    </header>
  );
}

function Why() {
  return (
    <section aria-labelledby="why" className="pt-32 sm:pt-48">
      <Grid>
        <div className="col-span-12 md:col-span-10 md:col-start-2 lg:col-span-8 lg:col-start-3">
          <div className="t-lead bg-background text-muted-foreground" {...reveal(0)}>
            {/* The bird as the opening letter, like the portrait at the start of a feature. */}
            <img src={birdStanding} alt="" width={310} height={260} className="on-paper float-left mr-4 mb-1 h-[3.75em] w-auto" />
            <h2 id="why" className="inline font-normal text-foreground">We got tired of starting over.</h2>{' '}
            <p className="inline">
              Every new assistant meant explaining things again. Decisions were buried in chats, knowledge was scattered across apps, and things we’d learned together were easily lost.
            </p>
          </div>
          <p className="t-lead clear-left mt-[1.25em]" {...reveal(1)}>
            We made Homing because we wanted that knowledge to stay useful.
          </p>
        </div>
      </Grid>
    </section>
  );
}

// Ana's Homing: work, home and the rest of life, each in its own space.
type Card = { id: string; text: ReactNode; by: string };
type Space = { name: string; who: ReactNode; cards: Card[] };

const spaces: Space[] = [
  {
    name: 'Acme launch',
    who: 'With Cara',
    cards: [
      { id: 'launch', text: <>Launch moved to <s className="text-muted-foreground">2 November</s> 14 November</>, by: 'Updated by Copilot on Monday' },
      { id: 'press', text: 'Cara owns the press list', by: 'Saved by Claude on 3 October' },
    ],
  },
  {
    name: 'Kitchen',
    who: 'With Jon',
    cards: [
      { id: 'tiles', text: 'Sage green tiles, 10 × 10 cm', by: 'Saved by Claude on 28 September' },
      { id: 'electrician', text: 'Electrician comes 3 November, before the tiling', by: 'Saved by ChatGPT on 9 October' },
    ],
  },
  {
    name: 'Half marathon',
    who: <OnlyYou />,
    cards: [
      { id: 'sunday', text: 'Long runs on Sundays, 18 km this week', by: 'Saved by ChatGPT yesterday' },
      { id: 'race', text: 'Race day is 8 March', by: 'Saved by Claude in August' },
    ],
  },
  {
    name: 'Personal',
    who: <OnlyYou />,
    cards: [
      { id: 'mornings', text: 'Mornings are for deep work', by: 'Saved by Claude in July' },
      { id: 'plain', text: 'Write to me in plain words', by: 'A rule you added' },
    ],
  },
];

const questions = [
  {
    ask: 'When is the Acme launch?',
    assistant: 'Copilot',
    answer: '14 November. It moved from 2 November on Monday, and Cara has the press list.',
    uses: ['launch', 'press'],
  },
  {
    ask: 'Which tiles did we pick?',
    assistant: 'Claude',
    answer: 'The sage green ones, 10 × 10 cm. The electrician comes on 3 November, so tiling can start after that.',
    uses: ['tiles', 'electrician'],
  },
  {
    ask: 'How far is Sunday’s run?',
    assistant: 'ChatGPT',
    answer: '18 km at an easy pace. You keep your long runs for Sundays, and race day is 8 March.',
    uses: ['sunday', 'race'],
  },
];

function Together() {
  const [asked, setAsked] = useState(0);
  const question = questions[asked];
  const shelf = useRef<HTMLDivElement>(null);

  // On a phone the spaces are a row to swipe through, so bring the one being asked about into view.
  const ask = (i: number) => {
    setAsked(i);
    const row = shelf.current;
    const used = row?.querySelector<HTMLElement>(`[data-card="${questions[i].uses[0]}"]`)?.closest<HTMLElement>('[data-space]');
    if (row && used && row.scrollWidth > row.clientWidth) row.scrollTo({ left: used.offsetLeft - row.offsetLeft, behavior: 'smooth' });
  };
  return (
    <section id="how" aria-labelledby="together" className="mt-32 px-3 sm:mt-48 sm:px-4">
      <div className="rounded-[1.75rem] bg-muted py-20 sm:py-32">
        <Grid>
          <div className="col-span-12 flex flex-col gap-6 md:col-span-7 md:col-start-6">
            <h2 id="together" className="t-heading font-semibold" {...reveal(0)}>Bring it all together.</h2>
            <p className="t-lead max-w-[30ch]" {...reveal(1)}>Keep what matters about your projects, work and everyday life in one place.</p>
            <p className="t-body max-w-[42ch]" {...reveal(2)}>
              Come back to something weeks later without explaining everything again. Switch assistants without losing the context. Let Homing help keep what you’ve learned organized and up to date.
            </p>
          </div>

          {/* The one thing to try: ask, and see which of Ana's cards the answer came from. */}
          <div className="col-span-12 mt-16 flex flex-col gap-4 md:col-span-4 md:mt-24" {...reveal(0)}>
            <p className="t-small text-muted-foreground">Ask from any assistant.</p>
            <div className="flex flex-wrap gap-2 md:flex-col md:items-start">
              {questions.map((item, i) => (
                <button
                  key={item.ask}
                  type="button"
                  aria-pressed={i === asked}
                  onClick={() => ask(i)}
                  className={cn(
                    'press rounded-full border px-4 py-2 text-left text-[15px] focus-visible:ring-[3px] focus-visible:ring-ring/70 focus-visible:outline-none',
                    i === asked ? 'border-primary bg-primary text-primary-foreground' : 'border-input/40 bg-card hover:border-input',
                  )}
                >
                  {item.ask}
                </button>
              ))}
            </div>
          </div>
          <div data-ui aria-live="polite" className="col-span-12 mt-6 self-end md:col-span-7 md:col-start-6 md:mt-24" {...reveal(1)}>
            <div key={asked} className="arrive flex max-w-xl flex-col gap-2 rounded-2xl bg-card px-5 py-4">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{question.assistant}</span>
                <span aria-hidden="true">·</span>
                from Homing
              </p>
              <p className="text-[15px] leading-relaxed">{question.answer}</p>
            </div>
          </div>

          <div
            ref={shelf}
            data-ui
            className="col-span-12 -mx-5 mt-10 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4"
            {...reveal(2)}
          >
            {spaces.map((space) => (
              <div key={space.name} data-space className="flex w-[82%] shrink-0 snap-start flex-col gap-3 rounded-2xl bg-background p-3 sm:w-auto">
                <div className="flex items-center justify-between gap-2 px-1 pt-1">
                  <h3 className="text-[15px] font-semibold">{space.name}</h3>
                  <span className="text-sm text-muted-foreground">{space.who}</span>
                </div>
                {space.cards.map((card) => {
                  const used = question.uses.includes(card.id);
                  return (
                    <div key={card.id} data-card={card.id} className={cn('kept flex flex-col gap-1 rounded-xl border bg-card px-3.5 py-3', used && 'border-primary/50 bg-change')}>
                      <p className="text-[15px] leading-snug">{card.text}</p>
                      <p className="text-sm text-muted-foreground">{card.by}</p>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Grid>
      </div>
    </section>
  );
}

/** One step of sharing: what someone says, then what comes back. */
function Exchange({ step, who, said, children, wide, i }: { step: string; who: string; said: string; children: ReactNode; wide?: boolean; i: number }) {
  return (
    <li className="flex flex-col gap-4">
      <p className="t-body font-semibold" {...reveal(i)}>{step}</p>
      <div className="max-w-[560px] rounded-2xl bg-muted px-5 py-4" {...reveal(i + 1)}>
        <p className="text-sm text-muted-foreground">{who}</p>
        <p className="mt-1 text-[15px] leading-relaxed">{said}</p>
      </div>
      <div data-ui className={cn('sm:ml-14', wide ? 'max-w-[760px]' : 'max-w-[504px]')} {...reveal(i + 2)}>
        {children}
      </div>
    </li>
  );
}

function Sharing() {
  return (
    <section aria-labelledby="sharing" className="pt-32 sm:pt-48">
      <Grid>
        <div className="col-span-12 md:col-span-5">
          {/* Two people at the same shelf. */}
          <img src={together} alt="" width={960} height={640} loading="lazy" className="mx-auto w-full max-w-sm md:sticky md:top-16 md:max-w-none md:-translate-x-6" {...reveal(0)} />
        </div>
        <div className="col-span-12 mt-8 flex flex-col gap-6 md:col-span-7 md:col-start-6 md:mt-0">
          <h2 id="sharing" className="t-heading font-semibold" {...reveal(0)}>Let others build on it, too.</h2>
          <p className="t-lead max-w-[30ch]" {...reveal(1)}>Some things are more useful when other people know them too.</p>
          <p className="t-body max-w-[42ch]" {...reveal(2)}>
            Share a project decision with a colleague and their assistant. Keep everyone working from the same understanding, while the things you want to keep private stay yours.
          </p>
          <p className="t-body max-w-[42ch]" {...reveal(3)}>You choose what to share, and changes to your rules need your approval.</p>

          <ol className="mt-14 flex flex-col gap-20">
            <Exchange i={0} step="First, you share a decision." who="Ana, in Claude" said="Let the Acme team know the launch moved to 14 November.">
              <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
                <div className="flex flex-col gap-1">
                  <p className="text-lg font-semibold tracking-tight">Share this with Acme launch?</p>
                  <p className="text-sm text-muted-foreground">Cara and her assistant will see it.</p>
                </div>
                <ProposedChange kind="preference" label="Knowledge" text="Launch moved to 14 November" />
                <div className="flex gap-2">
                  <span className={cn(buttonVariants({ size: 'sm' }), 'px-4')}>Share</span>
                  <span className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'px-4')}>Keep it to myself</span>
                </div>
              </div>
            </Exchange>

            <Exchange i={0} step="Then Cara’s assistant knows it too." who="Cara, in ChatGPT" said="When do we launch?">
              <div className="flex flex-col gap-3 rounded-2xl bg-card px-5 py-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">ChatGPT</span>
                  <span aria-hidden="true">·</span>
                  from Homing
                </p>
                <p className="text-[15px] leading-relaxed">14 November. Ana shared the new date on Monday.</p>
                <p className="text-sm text-muted-foreground">Ana’s kitchen and her training stay with Ana.</p>
              </div>
            </Exchange>

            <Exchange i={0} wide step="Rules change only when you say so." who="Claude, to Ana" said="You’ve asked for Friday updates three times now. Should that be a rule for Acme?">
              <div className="flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:p-6">
                <p className="text-lg font-semibold tracking-tight">Claude wants to add a rule to Acme launch</p>
                <ProposedChange kind="requirement" text="Send Acme status updates on Fridays." />
                <p className="text-sm text-muted-foreground">It applies to everyone’s assistant in Acme launch. Nothing changes until you approve.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <span className={cn(buttonVariants(), 'h-10 px-5')}>Approve rule</span>
                  <span className={cn(buttonVariants({ variant: 'outline' }), 'h-10 px-5')}>Decline</span>
                </div>
              </div>
            </Exchange>
          </ol>
        </div>
      </Grid>
    </section>
  );
}

function Start() {
  return (
    <section id="start" aria-labelledby="start-title" className="mt-32 px-3 sm:mt-48 sm:px-4">
      <div className="relative flex flex-col overflow-hidden md:min-h-[90svh] rounded-[1.75rem] bg-accent md:flex-row-reverse">
        <Grid className="relative z-10 w-full py-20 md:py-28">
          <div className="col-span-12 flex flex-col gap-12 md:col-span-5 md:col-start-8 md:self-center">
            <h2 id="start-title" className="t-heading font-semibold" {...reveal(0)}>Make yourself at home.</h2>
            <div className="flex flex-col gap-3" {...reveal(1)}>
              <h3 className="t-body font-semibold">Use Homing online</h3>
              <p className="t-body">Get started without setting up a server.</p>
              <a href={hosted} className={cn(primary, 'mt-2 w-full sm:w-fit')}>Get started free</a>
            </div>
            <div className="flex flex-col gap-3" {...reveal(2)}>
              <h3 className="t-body font-semibold">Host Homing yourself</h3>
              <p className="t-body">Homing is open source. Run it on your own infrastructure.</p>
              <a href={selfHost} className={cn(outline, 'mt-2 w-full sm:w-fit')}>Self-host Homing</a>
            </div>
          </div>
        </Grid>
        {/* The bird, home at last, asleep in its box. The section's edges crop it. */}
        <img
          src={resting}
          alt=""
          width={960}
          height={640}
          loading="lazy"
          className="pointer-events-none -mt-16 -mb-8 ml-[-10%] w-[120%] max-w-none md:absolute md:bottom-[-14%] md:left-[-12%] md:m-0 md:w-[78%]"
        />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="flex flex-col gap-32 bg-foreground text-background [--mark-dark:#a9c2ad] [--mark-light:#d3e0d4]">
      <Grid className="gap-y-8 pt-12 sm:pt-16">
        <p className="t-lead col-span-12 md:col-span-5">Built in the open, for everyone.</p>
        <ul className="t-small col-span-12 flex gap-6 md:col-span-7 md:col-start-6 md:pt-2">
          <li><a href={github} className="link">GitHub</a></li>
          <li><a href={docs} className="link">Documentation</a></li>
          <li><a href="#why" className="link">About</a></li>
        </ul>
      </Grid>
      <div className="px-5 pb-6 sm:px-8">
        {/* The name returns across the full width. */}
        <p aria-hidden="true" className="flex items-center gap-[0.12em] text-[clamp(4rem,19.5vw,22rem)] leading-none font-semibold tracking-[-0.05em]">
          <Mark className="size-[0.72em]" />
          Homing
        </p>
        <p className="t-small mt-4 opacity-70">© 2026 Max Aasbø. Homing is licensed under AGPL-3.0.</p>
      </div>
    </footer>
  );
}

/** Opens the masthead and reveals each part of a section once it comes into view. */
function useMotion() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const page = root.current;
    if (!page) return;
    page.classList.add('moving');
    const shutter = page.querySelector('[data-shutter]');
    requestAnimationFrame(() => requestAnimationFrame(() => shutter?.classList.add('is-in')));
    const parts = page.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      parts.forEach((part) => part.classList.add('is-in'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    parts.forEach((part) => observer.observe(part));
    return () => observer.disconnect();
  }, []);
  return root;
}
