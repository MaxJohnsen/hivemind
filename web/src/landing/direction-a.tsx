import { copy, Footer, HeroActions, Nav, RuleCard, ShareSteps, SpacesDemo, StartOptions } from '@/landing/parts';
import connected from '@/assets/illustrations/connected.png';
import resting from '@/assets/illustrations/empty.png';
import together from '@/assets/illustrations/signin.png';

/**
 * Two columns: every section is text on one side and a drawing or a demo on the other, in one
 * centered container. The most conventional of the three, and the easiest to read.
 */
export function DirectionA() {
  return (
    <div className="landing bg-background text-foreground">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <Nav />
        <main className="flex flex-col gap-32 pb-32 lg:gap-40 lg:pb-40">
          <section className="grid items-center gap-10 pt-8 lg:grid-cols-12 lg:gap-8 lg:pt-16">
            <div className="flex flex-col gap-6 lg:col-span-7">
              <h1 className="t-display font-semibold" style={{ fontSize: "clamp(2.25rem, 1rem + 3.4vw, 4rem)" }}>A home for everything worth knowing.</h1>
              <p className="t-lead max-w-[34rem]">{copy.lead}</p>
              <p className="t-body max-w-[34rem]">{copy.intro}</p>
              <HeroActions className="mt-2" />
              <p className="t-small text-muted-foreground">{copy.note}</p>
            </div>
            <img src={connected} alt="" width={960} height={640} className="w-full lg:col-span-5" />
          </section>

          <section aria-labelledby="why" className="max-w-[46rem]">
            <h2 id="why" className="t-heading font-semibold">{copy.why.title}</h2>
            <p className="t-lead mt-6">{copy.why.body}</p>
            <p className="t-lead mt-6">{copy.why.close}</p>
          </section>

          <section id="how" aria-labelledby="together" className="grid gap-10 lg:grid-cols-12 lg:gap-8">
            <div className="flex flex-col gap-6 lg:col-span-5">
              <h2 id="together" className="t-heading font-semibold">{copy.together.title}</h2>
              <p className="t-lead">{copy.together.lead}</p>
              <p className="t-body">{copy.together.body}</p>
            </div>
            <SpacesDemo className="lg:col-span-7" />
          </section>

          <section aria-labelledby="sharing" className="flex flex-col gap-12">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
              <img src={together} alt="" width={960} height={640} loading="lazy" className="w-full max-lg:order-last lg:col-span-5" />
              <div className="flex flex-col gap-6 lg:col-span-6 lg:col-start-7">
                <h2 id="sharing" className="t-heading font-semibold">{copy.sharing.title}</h2>
                <p className="t-lead">{copy.sharing.lead}</p>
                <p className="t-body">{copy.sharing.body}</p>
              </div>
            </div>
            <div className="grid items-start gap-4 lg:grid-cols-3">
              <ShareSteps />
              <RuleCard />
            </div>
          </section>

          <section id="start" aria-labelledby="start-title" className="grid items-center gap-10 rounded-[1.75rem] bg-muted px-6 py-14 sm:px-12 lg:grid-cols-12 lg:gap-8 lg:py-20">
            <div className="flex flex-col gap-10 lg:col-span-7">
              <h2 id="start-title" className="t-heading font-semibold">{copy.start.title}</h2>
              <StartOptions />
            </div>
            <img src={resting} alt="" width={960} height={640} loading="lazy" className="w-full lg:col-span-5" />
          </section>
        </main>
      </div>
      <Footer />
    </div>
  );
}
