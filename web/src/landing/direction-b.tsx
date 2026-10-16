import type { ReactNode } from 'react';
import { copy, Footer, HeroActions, Nav, RuleCard, ShareSteps, SpacesDemo, StartOptions } from '@/landing/parts';
import birdFlying from '@/assets/illustrations/bird-flying.png';
import connected from '@/assets/illustrations/connected.png';
import resting from '@/assets/illustrations/empty.png';
import together from '@/assets/illustrations/signin.png';
import welcome from '@/assets/illustrations/welcome.png';

/**
 * Storybook: one calm column, read top to bottom like a picture book. Each section opens with a
 * large drawing, and the bird carries the story from the first page to its box at the end.
 */
export function DirectionB() {
  return (
    <div className="landing bg-background text-foreground">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <Nav />
      </div>
      <main className="mx-auto flex max-w-[44rem] flex-col gap-36 px-5 pb-36 sm:px-8 lg:gap-44">
        <section className="flex flex-col gap-6 pt-6">
          <Drawing src={connected} eager />
          <h1 className="t-display font-semibold" style={{ fontSize: 'clamp(2.25rem, 1rem + 3vw, 3.75rem)' }}>
            A home for everything worth knowing.
          </h1>
          <p className="t-lead">{copy.lead}</p>
          <p className="t-body">{copy.intro}</p>
          <HeroActions className="mt-2" />
          <p className="t-small text-muted-foreground">{copy.note}</p>
        </section>

        <Chapter id="why" drawing={birdFlying} small title={copy.why.title}>
          <p className="t-lead">{copy.why.body}</p>
          <p className="t-lead">{copy.why.close}</p>
        </Chapter>

        <Chapter id="together" anchor="how" drawing={welcome} title={copy.together.title}>
          <p className="t-lead">{copy.together.lead}</p>
          <p className="t-body">{copy.together.body}</p>
          <SpacesDemo className="mt-6" />
        </Chapter>

        <Chapter id="sharing" drawing={together} title={copy.sharing.title}>
          <p className="t-lead">{copy.sharing.lead}</p>
          <p className="t-body">{copy.sharing.body}</p>
          <div className="mt-6 flex flex-col gap-4">
            <ShareSteps />
          </div>
          <h3 className="t-body mt-10 font-semibold">{copy.sharing.rules}</h3>
          <p className="t-body">{copy.sharing.rulesBody}</p>
          <RuleCard className="mt-2" />
        </Chapter>

        <Chapter id="start-title" anchor="start" drawing={resting} title={copy.start.title}>
          <StartOptions className="mt-2" />
        </Chapter>
      </main>
      <Footer />
    </div>
  );
}

function Drawing({ src, small, eager }: { src: string; small?: boolean; eager?: boolean }) {
  return (
    <img
      src={src}
      alt=""
      width={960}
      height={640}
      loading={eager ? undefined : 'lazy'}
      className={small ? 'w-56 self-center' : 'w-full'}
    />
  );
}

function Chapter({ id, anchor, drawing, small, title, children }: { id: string; anchor?: string; drawing: string; small?: boolean; title: string; children: ReactNode }) {
  return (
    <section id={anchor} aria-labelledby={id} className="flex flex-col gap-6">
      <Drawing src={drawing} small={small} />
      <h2 id={id} className="t-heading font-semibold">{title}</h2>
      {children}
    </section>
  );
}
