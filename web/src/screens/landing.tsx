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
// Homing online, where people sign in. This page itself is homing.place.
const app = 'https://app.homing.place';

/**
 * The landing page: what Homing is, why it exists, and the two ways to start. It has two lines
 * to align to: the page margin, and an axis at five twelfths of the width. All reading text starts
 * on the axis, the space to its left holds drawings and short notes, and wide things run from
 * margin to margin. The hero headline is the one exception, running from the margin. On a phone
 * the axis becomes the margin.
 */
export function Landing() {
  const root = useMotion();
  return (
    <div ref={root} className="landing bg-background text-foreground">
      <main className="flex flex-col gap-32 pb-32 lg:gap-44 lg:pb-44">
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

/** The page's grid: twelve columns between one pair of margins. */
function Grid({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto grid w-full max-w-[1760px] grid-cols-12 gap-x-6 px-5 sm:px-8', className)}>{children}</div>;
}

/** Where reading text starts: the axis, from column 6 to the margin. */
const axis = 'col-span-12 lg:col-span-7 lg:col-start-6';
/** The space left of the axis, for drawings and short notes. */
const zone = 'col-span-12 lg:col-span-4';

/** A section set on a colored field that runs almost to the edges of the window. */
function Band({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className="px-2 sm:px-3">
      <div className={cn('rounded-[1.75rem]', className)}>{children}</div>
    </div>
  );
}

/** How a section opens, on the axis: its heading, a larger line, then body text. */
function Intro({ id, title, lead, children }: { id: string; title: string; lead: string; children?: ReactNode }) {
  return (
    <div className="flex max-w-[36rem] flex-col gap-5">
      <h2 id={id} className="t-heading font-semibold" {...reveal(0)}>{title}</h2>
      <p className="t-lead" {...reveal(1)}>{lead}</p>
      {children && <div className="t-body flex flex-col gap-4" {...reveal(2)}>{children}</div>}
    </div>
  );
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
          <a href={github} className="link hidden sm:inline">GitHub</a>
          <a href={`${app}/sign-in`} className="link">Sign in</a>
        </nav>
      </Grid>

      <Band>
        <div data-shutter className="shutter flex h-[32svh] min-h-64 items-end justify-center overflow-hidden rounded-[1.75rem] bg-muted sm:min-h-80">
          {/* The bird brings what it learned home to the shelf. */}
          <img src={connected} alt="" width={960} height={640} className="h-[128%] w-auto max-w-none translate-y-[14%]" />
        </div>
      </Band>

      <Grid className="pt-10 lg:pt-12">
        <h1 className="t-display col-span-12 font-semibold" {...reveal(0)}>
          A home for everything
          <br className="hidden sm:block" /> worth knowing.
        </h1>
        <p className={cn(zone, 't-small mt-10 text-muted-foreground max-lg:order-last lg:mt-12 lg:self-end')} {...reveal(4)}>
          Open source. Works with the assistants you already use.
        </p>
        <div className={cn(axis, 'mt-8 flex max-w-[36rem] flex-col gap-4 lg:mt-12')}>
          <p className="t-lead" {...reveal(1)}>Your life and work don’t fit into one conversation.</p>
          <p className="t-body" {...reveal(2)}>
            Homing gives your AI assistants a shared place to remember what matters, build on what they learn, and pick up where you left off.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row" {...reveal(3)}>
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
    <section aria-labelledby="why">
      <Grid className="gap-y-8">
        <div className={cn(zone, 'max-lg:hidden')}>
          <img src={birdStanding} alt="" width={310} height={260} className="on-paper ml-auto w-40" {...reveal(0)} />
        </div>
        <div className={axis}>
          <Intro id="why" title="We got tired of starting over." lead="Every new assistant meant explaining things again. Decisions were buried in chats, knowledge was scattered across apps, and things we’d learned together were easily lost.">
            <p>We made Homing because we wanted that knowledge to stay useful.</p>
          </Intro>
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
    <section id="how" aria-labelledby="together">
      <Band className="bg-muted py-20 lg:py-32">
        <Grid className="gap-y-16">
          <div className={axis}>
            <Intro id="together" title="Bring it all together." lead="Keep what matters about your projects, work and everyday life in one place.">
              <p>
                Come back to something weeks later without explaining everything again. Switch assistants without losing the context. Let Homing help keep what you’ve learned organized and up to date.
              </p>
            </Intro>
          </div>

          {/* The one thing to try: ask, and see which of Ana's cards the answer came from. */}
          <div className={cn(zone, 'flex flex-col gap-4')} {...reveal(0)}>
            <p className="t-small text-muted-foreground">Ask from any assistant.</p>
            <div className="flex flex-wrap gap-2 lg:flex-col lg:items-start">
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
          <div data-ui aria-live="polite" className={cn(axis, '-mt-10 lg:mt-0 lg:pt-9')} {...reveal(1)}>
            <div key={asked} className="arrive flex max-w-[36rem] flex-col gap-2 rounded-2xl bg-card px-5 py-4">
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
            className="col-span-12 -mx-5 -mt-6 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4"
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
      </Band>
    </section>
  );
}

/** One step of sharing: what someone says, then what comes back. */
function Exchange({ step, who, said, children }: { step: string; who: string; said: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-3">
      <p className="t-body font-semibold" {...reveal(0)}>{step}</p>
      <div className="rounded-2xl bg-muted px-5 py-4" {...reveal(1)}>
        <p className="text-sm text-muted-foreground">{who}</p>
        <p className="mt-1 text-[15px] leading-relaxed">{said}</p>
      </div>
      <div data-ui className="sm:ml-10" {...reveal(2)}>
        {children}
      </div>
    </li>
  );
}

function Sharing() {
  return (
    <section aria-labelledby="sharing">
      <Grid className="gap-y-10">
        <div className={zone}>
          {/* Two people at the same shelf, beside the story as it scrolls. */}
          <img src={together} alt="" width={960} height={640} loading="lazy" className="mx-auto w-full max-w-sm lg:sticky lg:top-16 lg:max-w-none" {...reveal(0)} />
        </div>
        <div className={axis}>
          <Intro id="sharing" title="Let others build on it, too." lead="Some things are more useful when other people know them too.">
            <p>
              Share a project decision with a colleague and their assistant. Keep everyone working from the same understanding, while the things you want to keep private stay yours.
            </p>
            <p>You choose what to share, and changes to your rules need your approval.</p>
          </Intro>

          <ol className="mt-16 flex max-w-[36rem] flex-col gap-16">
            <Exchange step="First, you share a decision." who="Ana, in Claude" said="Let the Acme team know the launch moved to 14 November.">
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

            <Exchange step="Then Cara’s assistant knows it too." who="Cara, in ChatGPT" said="When do we launch?">
              <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">ChatGPT</span>
                  <span aria-hidden="true">·</span>
                  from Homing
                </p>
                <p className="text-[15px] leading-relaxed">14 November. Ana shared the new date on Monday.</p>
                <p className="text-sm text-muted-foreground">Ana’s kitchen and her training stay with Ana.</p>
              </div>
            </Exchange>

            <Exchange step="Rules change only when you say so." who="Claude, to Ana" said="You’ve asked for Friday updates three times now. Should that be a rule for Acme?">
              <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
                <p className="text-lg font-semibold tracking-tight">Claude wants to add a rule to Acme launch</p>
                <ProposedChange kind="requirement" text="Send Acme status updates on Fridays." />
                <p className="text-sm text-muted-foreground">It applies to everyone’s assistant in Acme launch. Nothing changes until you approve.</p>
                <div className="flex gap-2">
                  <span className={cn(buttonVariants({ size: 'sm' }), 'px-4')}>Approve rule</span>
                  <span className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'px-4')}>Decline</span>
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
    <section id="start" aria-labelledby="start-title">
      <Band className="relative overflow-hidden bg-accent">
        <Grid className="relative z-10 gap-y-12 py-20 lg:min-h-[80svh] lg:content-center lg:py-32">
          <div className={cn(axis, 'flex flex-col gap-12')}>
            <h2 id="start-title" className="t-heading font-semibold" {...reveal(0)}>Make yourself at home.</h2>
            <div className="grid gap-12 sm:grid-cols-2 sm:gap-8">
              <div className="flex flex-col gap-2" {...reveal(1)}>
                <h3 className="t-body font-semibold">Use Homing online</h3>
                <p className="t-body">Get started without setting up a server.</p>
                <a href={`${app}/sign-in`} className={cn(primary, 'mt-4 w-full sm:w-fit')}>Get started free</a>
              </div>
              <div className="flex flex-col gap-2" {...reveal(2)}>
                <h3 className="t-body font-semibold">Host Homing yourself</h3>
                <p className="t-body">Homing is open source. Run it on your own infrastructure.</p>
                <a href={selfHost} className={cn(outline, 'mt-4 w-full sm:w-fit')}>Self-host Homing</a>
              </div>
            </div>
          </div>
        </Grid>
        {/* The bird, home at last, asleep in its box. On a desktop the band's edges crop it. */}
        <img
          src={resting}
          alt=""
          width={960}
          height={640}
          loading="lazy"
          className="pointer-events-none mx-auto -mt-16 -mb-6 w-[110%] max-w-none lg:absolute lg:bottom-[-12%] lg:left-[-6%] lg:m-0 lg:w-[46%]"
        />
      </Band>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-foreground text-background [--mark-dark:#a9c2ad] [--mark-light:#d3e0d4]">
      <Grid className="gap-y-6 pt-16 lg:pt-20">
        <p className={cn(zone, 't-lead')}>Built in the open, for everyone.</p>
        <ul className={cn(axis, 't-small flex gap-6 lg:pt-1')}>
          <li><a href={github} className="link">GitHub</a></li>
          <li><a href={docs} className="link">Documentation</a></li>
          <li><a href="#why" className="link">About</a></li>
        </ul>
      </Grid>
      <Grid className="gap-y-4 pt-28 pb-8 lg:pt-40">
        {/* The name returns across the width of the page. */}
        <p aria-hidden="true" className="col-span-12 flex items-center gap-[0.12em] text-[clamp(4rem,19vw,22rem)] leading-none font-semibold tracking-[-0.05em]">
          <Mark className="size-[0.72em]" />
          Homing
        </p>
        <p className="t-small col-span-12 opacity-70">© 2026 Max Aasbø. Homing is licensed under AGPL-3.0.</p>
      </Grid>
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
      { rootMargin: '0px' },
    );
    parts.forEach((part) => observer.observe(part));
    return () => observer.disconnect();
  }, []);
  return root;
}
