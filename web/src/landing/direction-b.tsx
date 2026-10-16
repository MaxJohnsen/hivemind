import type { ReactNode } from 'react';
import { cn } from 'cn';
import { copy, Footer, HeroActions, Nav, RuleCard, ShareSteps, SpacesDemo, StartOptions } from '@/landing/parts';
import connected from '@/assets/illustrations/connected.png';
import resting from '@/assets/illustrations/empty.png';
import onePlace from '@/assets/illustrations/one-place.webp';
import rules from '@/assets/illustrations/rules.webp';
import sharing from '@/assets/illustrations/sharing.webp';
import startingOver from '@/assets/illustrations/starting-over.webp';

/**
 * Storybook: read top to bottom like a picture book. The cover is centered, with the opening
 * drawing above the title. Each chapter after it reads in one left-aligned column, opens with a
 * drawing sized by what it has to say, and alternates between linen and a soft band, like turning
 * a page. Demos are plates that break out wider than the text. The ending mirrors the cover.
 */
export function DirectionB() {
  return (
    <div className="landing bg-background text-foreground">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <Nav />
      </div>
      <main className="flex flex-col gap-6 pb-6">
        <section className="mx-auto flex max-w-[48rem] flex-col items-center px-5 pt-4 pb-24 text-center sm:px-8 lg:pb-32">
          <img src={connected} alt="" width={960} height={640} className="w-full max-w-[34rem]" />
          <h1 className="t-display mt-6 font-semibold" style={{ fontSize: 'clamp(2.25rem, 1rem + 3.2vw, 4rem)' }}>
            A home for everything worth knowing.
          </h1>
          <p className="t-lead mt-6 max-w-[34rem]">{copy.lead}</p>
          <p className="t-body mt-4 max-w-[34rem]">{copy.intro}</p>
          <HeroActions className="mt-8 w-full justify-center" />
          <p className="t-small mt-5 text-muted-foreground">{copy.note}</p>
        </section>

        <Chapter id="why" title={copy.why.title} drawing={<Drawing src={startingOver} width={960} height={960} className="w-full max-w-[22rem]" />}>
          <p className="t-lead">{copy.why.body}</p>
          <p className="t-lead">{copy.why.close}</p>
        </Chapter>

        <Chapter
          id="together"
          anchor="how"
          band
          title={copy.together.title}
          wide={<Drawing src={onePlace} width={1600} height={680} className="w-full" />}
          plate={<SpacesDemo />}
        >
          <p className="t-lead">{copy.together.lead}</p>
          <p className="t-body">{copy.together.body}</p>
        </Chapter>

        <Chapter
          id="sharing"
          title={copy.sharing.title}
          drawing={<Drawing src={sharing} width={1200} height={795} className="w-full" />}
          plate={
            <div className="grid items-start gap-4 md:grid-cols-2">
              <ShareSteps />
            </div>
          }
        >
          <p className="t-lead">{copy.sharing.lead}</p>
          <p className="t-body">{copy.sharing.body}</p>
        </Chapter>

        <Chapter
          id="rules"
          band
          title={copy.sharing.rules}
          drawing={<Drawing src={rules} width={960} height={960} className="w-full max-w-[22rem]" />}
          plate={<RuleCard className="mx-auto max-w-xl" />}
        >
          <p className="t-body">{copy.sharing.rulesBody}</p>
        </Chapter>

        <section id="start" aria-labelledby="start-title" className="mx-auto flex max-w-[48rem] flex-col items-center px-5 pt-24 pb-28 text-center sm:px-8 lg:pt-32 lg:pb-36">
          <img src={resting} alt="" width={960} height={640} loading="lazy" className="w-full max-w-[22rem]" />
          <h2 id="start-title" className="t-heading mt-2 font-semibold">{copy.start.title}</h2>
          <StartOptions className="mt-10 w-full max-w-[36rem] text-left" />
        </section>
      </main>
      <Footer />
    </div>
  );
}

/**
 * A chapter: its drawing, then its heading and text in one reading column, then an optional
 * plate that runs wider. A wide drawing runs at plate width above the column. A band chapter
 * sits on the soft ground.
 */
function Chapter({ id, anchor, band, title, drawing, wide, plate, children }: { id: string; anchor?: string; band?: boolean; title: string; drawing?: ReactNode; wide?: ReactNode; plate?: ReactNode; children: ReactNode }) {
  return (
    <section id={anchor} aria-labelledby={id} className="px-2 sm:px-3">
      <div className={cn('rounded-[1.75rem] px-5 py-24 sm:px-8 lg:py-32', band && 'bg-muted')}>
        {wide && <div className="mx-auto mb-10 max-w-[60rem]">{wide}</div>}
        <div className="mx-auto flex max-w-[44rem] flex-col gap-6">
          {drawing}
          <h2 id={id} className="t-heading font-semibold">{title}</h2>
          {children}
        </div>
        {plate && <div className="mx-auto mt-14 max-w-[60rem]">{plate}</div>}
      </div>
    </section>
  );
}

/** A drawing, shipped on a transparent ground so it sits on linen or a band alike. */
function Drawing({ src, width, height, className }: { src: string; width: number; height: number; className?: string }) {
  return <img src={src} alt="" width={width} height={height} loading="lazy" className={className} />;
}
