import type { ReactNode } from 'react';
import { copy, Footer, HeroActions, Nav, RuleCard, ShareSteps, SpacesDemo, StartOptions } from '@/landing/parts';
import birdHanding from '@/assets/illustrations/bird-handing.jpg';
import birdFlying from '@/assets/illustrations/bird-flying.png';
import resting from '@/assets/illustrations/empty.png';
import together from '@/assets/illustrations/signin.png';

/**
 * Product first: the live demo is the hero, so the first thing a visitor does is try it. After
 * that every section is a row, its heading in the left third and its content in the right two
 * thirds. Drawings are small and sit beside the headings.
 */
export function DirectionC() {
  return (
    <div className="landing bg-background text-foreground">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <Nav />
        <main className="flex flex-col gap-32 pb-32 lg:gap-40 lg:pb-40">
          <section className="grid items-center gap-12 pt-8 lg:grid-cols-12 lg:gap-10 lg:pt-14">
            <div className="flex flex-col gap-6 lg:col-span-5">
              <h1 className="t-display font-semibold" style={{ fontSize: 'clamp(2.25rem, 1rem + 2.6vw, 3.5rem)' }}>
                A home for everything worth knowing.
              </h1>
              <p className="t-lead">{copy.lead}</p>
              <p className="t-body">{copy.intro}</p>
              <HeroActions className="mt-2" />
              <p className="t-small text-muted-foreground">{copy.note}</p>
            </div>
            <div className="relative lg:col-span-7">
              {/* The bird brings a card to the demo, as it does on the sign-in page. */}
              <img src={birdFlying} alt="" width={579} height={464} className="pointer-events-none absolute -top-20 -right-2 z-10 w-32 sm:-top-24 sm:w-40" />
              <SpacesDemo />
            </div>
          </section>

          <Row id="why" title={copy.why.title} drawing={<img src={birdHanding} alt="" width={520} height={330} loading="lazy" className="on-paper mt-8 w-56" />}>
            <p className="t-lead">{copy.why.body}</p>
            <p className="t-lead">{copy.why.close}</p>
          </Row>

          <Row id="together" anchor="how" title={copy.together.title}>
            <p className="t-lead">{copy.together.lead}</p>
            <p className="t-body max-w-[38rem]">{copy.together.body}</p>
          </Row>

          <Row id="sharing" title={copy.sharing.title} drawing={<img src={together} alt="" width={960} height={640} loading="lazy" className="mt-8 w-full max-w-xs" />}>
            <p className="t-lead">{copy.sharing.lead}</p>
            <p className="t-body max-w-[38rem]">{copy.sharing.body}</p>
            <div className="mt-6 grid items-start gap-4 md:grid-cols-2">
              <ShareSteps />
            </div>
          </Row>

          <Row id="rules" title={copy.sharing.rules}>
            <p className="t-body max-w-[38rem]">{copy.sharing.rulesBody}</p>
            <RuleCard className="mt-4 max-w-xl" />
          </Row>

          <section id="start" aria-labelledby="start-title" className="grid gap-10 rounded-[1.75rem] bg-muted px-6 py-14 sm:px-12 lg:grid-cols-12 lg:gap-10 lg:py-20">
            <div className="flex flex-col gap-6 lg:col-span-4">
              <h2 id="start-title" className="t-heading font-semibold">{copy.start.title}</h2>
              <img src={resting} alt="" width={960} height={640} loading="lazy" className="w-full max-w-xs" />
            </div>
            <StartOptions className="lg:col-span-8 lg:pt-3" />
          </section>
        </main>
      </div>
      <Footer />
    </div>
  );
}

/** A row: the heading, and an optional drawing, in the left third; the content in the rest. */
function Row({ id, anchor, title, drawing, children }: { id: string; anchor?: string; title: string; drawing?: ReactNode; children: ReactNode }) {
  return (
    <section id={anchor} aria-labelledby={id} className="grid gap-6 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-4">
        <h2 id={id} className="t-heading font-semibold">{title}</h2>
        {drawing && <div className="max-lg:hidden">{drawing}</div>}
      </div>
      <div className="flex flex-col gap-5 lg:col-span-8 lg:pt-3">{children}</div>
    </section>
  );
}
