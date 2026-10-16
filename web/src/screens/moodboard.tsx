import { useState } from 'react';
import { Wordmark } from '@/components/wordmark';
import birdFlying from '@/assets/illustrations/bird-flying.png';
import birdHanding from '@/assets/illustrations/bird-handing.jpg';
import birdStanding from '@/assets/illustrations/bird-standing.jpg';
import connected from '@/assets/illustrations/connected.png';
import resting from '@/assets/illustrations/empty.png';
import together from '@/assets/illustrations/signin.png';
import welcome from '@/assets/illustrations/welcome.png';

const directions = [
  {
    path: '/moodboard/a',
    name: 'Two columns',
    about: 'Text on one side, a drawing or the demo on the other, in one centered container. The most conventional and the easiest to read. Drawings sit large and uncropped beside the text.',
  },
  {
    path: '/moodboard/b',
    name: 'Storybook',
    about: 'One calm column read like a picture book. Each section opens with a large drawing, and the bird carries the story to its box at the end. The most personal, and the longest scroll.',
  },
  {
    path: '/moodboard/c',
    name: 'Product first',
    about: 'The live demo is the hero, so the first thing you do is try it. Then rows: heading on the left, content on the right. Drawings become small accents. The most app-like.',
  },
];

const style =
  'Soft colored-pencil drawing with gentle visible pencil texture, rounded friendly shapes, a muted pastel palette of sage green, soft peach and warm gray, light and airy. Plenty of empty space, nothing cropped. Pure flat white background. No text, no logos, no screens.';

const toDraw = [
  {
    name: 'A wide opening',
    why: 'The current opening scene is 3:2, so a wide band crops it. A wide drawing fills the top of the page without cropping.',
    scene: 'The paper bird from the reference sheet flies from left to right across a wide empty space, carrying a blank index card toward a small wooden shelf of boxes at the far right. A very wide 3:1 composition.',
  },
  {
    name: 'Everything in one place',
    why: 'For "Bring it all together": work and everyday life side by side.',
    scene: 'A person at a kitchen table with a cup of tea. On a shelf behind them, three small boxes: one with a green tile sample, one with running shoes, one with a work folder. The paper bird brings an index card from one of the boxes to the person.',
  },
  {
    name: 'Shared, and private',
    why: 'For sharing: one card travels to a colleague, and the notebook stays put. It uses the design’s "only yours" object.',
    scene: 'Two people at two separate desks in a bright room. The paper bird flies between them carrying one index card. On the first desk a closed notebook stays where it is.',
  },
  {
    name: 'A rule on the wall',
    why: 'For rules changing only with approval, drawn as the design’s pinned note.',
    scene: 'A note pinned to a wall above a desk. A person reads it with a pencil in hand, deciding. The paper bird waits on the desk beside them.',
  },
];

/** Landing page directions and illustration options, side by side, for choosing. */
export function Moodboard() {
  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-20 px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-col gap-4">
        <Wordmark className="text-lg" />
        <h1 className="text-2xl font-semibold">Landing page directions</h1>
        <p className="max-w-[42rem] text-[15px] leading-relaxed text-muted-foreground">
          Three ways to lay out the same page, with the same words and the same simpler demos. Open one to scroll it at full size, then pick the drawings below.
        </p>
      </header>

      <section aria-labelledby="layouts" className="flex flex-col gap-6">
        <h2 id="layouts" className="text-lg font-semibold">Layouts</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {directions.map((item, i) => (
            <article key={item.path} className="flex flex-col gap-4">
              <a href={item.path} className="group block overflow-hidden rounded-2xl border bg-card focus-visible:ring-[3px] focus-visible:ring-ring/70 focus-visible:outline-none">
                <div className="relative h-[520px] overflow-hidden">
                  <iframe
                    title={`${item.name}, a preview`}
                    src={item.path}
                    tabIndex={-1}
                    className="pointer-events-none absolute top-0 left-0 h-[1857px] w-[1440px] origin-top-left scale-[0.28] border-0"
                  />
                </div>
              </a>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-lg font-semibold">
                  {String.fromCharCode(65 + i)}. {item.name}
                </h3>
                <p className="text-[15px] leading-relaxed">{item.about}</p>
                <a href={item.path} className="text-[15px] font-medium text-primary underline-offset-4 hover:underline">Open {item.name}</a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="drawings" className="flex flex-col gap-10">
        <div className="flex flex-col gap-2">
          <h2 id="drawings" className="text-lg font-semibold">Drawings</h2>
          <p className="max-w-[42rem] text-[15px] leading-relaxed text-muted-foreground">What we have, in two families, and what we would draw next. Every new drawing is made with the bird’s character sheet as a reference.</p>
        </div>

        <Family
          name="Scenes with people"
          about="Carry the idea best: a person, the shelf of spaces, the bird bringing a card. They are wide and airy, so in a layout they read small, and they must never be cropped."
          images={[connected, welcome, together]}
        />
        <Family
          name="The bird on its own"
          about="From the character sheet and the sign-in page. Simpler, and they hold up small, as accents beside a heading or on a demo."
          images={[birdFlying, birdHanding, resting, birdStanding]}
          paper
        />

        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold">To draw next</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {toDraw.map((item) => (
              <Prompt key={item.name} {...item} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Family({ name, about, images, paper }: { name: string; about: string; images: string[]; paper?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold">{name}</h3>
        <p className="max-w-[42rem] text-[15px] leading-relaxed">{about}</p>
      </div>
      <div className={`grid gap-4 ${images.length > 3 ? 'grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {images.map((src) => (
          <div key={src} className="flex aspect-[3/2] items-center justify-center rounded-2xl bg-card p-4">
            <img src={src} alt="" className={`max-h-full max-w-full object-contain ${paper ? 'mix-blend-multiply' : ''}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Prompt({ name, why, scene }: { name: string; why: string; scene: string }) {
  const [copied, setCopied] = useState(false);
  const prompt = `${scene}\n\n${style}`;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
      <p className="text-[15px] font-semibold">{name}</p>
      <p className="text-sm text-muted-foreground">{why}</p>
      <p className="rounded-lg bg-muted px-4 py-3 text-sm leading-relaxed whitespace-pre-line">{prompt}</p>
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(prompt).then(() => setCopied(true))}
        className="w-fit rounded-full border bg-card px-4 py-1.5 text-sm hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/70 focus-visible:outline-none"
      >
        {copied ? 'Copied' : 'Copy prompt'}
      </button>
    </div>
  );
}
