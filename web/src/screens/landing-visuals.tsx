import type { CSSProperties, ReactNode } from 'react';
import { Wordmark } from '@/components/wordmark';
import street from '@/assets/illustrations/street.webp';
import '@/landing.css';

// Five ways to show how Homing is built, for choosing one for "Bring it all together": many
// spaces, two people, and each person's assistants connected to the spaces they are in.

const colors = {
  '--ana': '#4f6f58',
  '--ana-soft': '#dfe8df',
  '--cara': '#b5734f',
  '--cara-soft': '#f5e0d4',
} as CSSProperties;

const ana = { name: 'Ana', assistants: 'Claude and ChatGPT' };
const cara = { name: 'Cara', assistants: 'ChatGPT and Copilot' };
const anaOnly = ['Kitchen', 'Half marathon', 'Family trip'];
const shared = ['Acme launch', 'Brand refresh'];
const caraOnly = ['Garden', 'Book club'];

/** 1. Two people, their assistants, and a line to every space each one is in. */
export function Web() {
  const all = [...anaOnly, ...shared, ...caraOnly];
  const top = 38;
  const step = 54;
  const y = (i: number) => top + i * step + 20;
  return (
    <svg viewBox="0 0 760 440" role="img" aria-label="Ana’s assistants connect to her spaces and the shared ones; Cara’s connect to hers and the shared ones." className="w-full" style={{ ...colors, fontFamily: 'inherit' }}>
      {all.map((name, i) => {
        const anaIn = i < anaOnly.length + shared.length;
        const caraIn = i >= anaOnly.length;
        return (
          <g key={name}>
            {anaIn && <path d={`M190 220 C 240 220 235 ${y(i)} 285 ${y(i)}`} fill="none" stroke="var(--ana)" strokeWidth="2" />}
            {caraIn && <path d={`M570 220 C 520 220 525 ${y(i)} 475 ${y(i)}`} fill="none" stroke="var(--cara)" strokeWidth="2" />}
            <rect x="285" y={y(i) - 20} width="190" height="40" rx="12" fill={anaIn && caraIn ? '#efeae2' : '#fffdf9'} stroke="#e7e0d5" />
            <text x="380" y={y(i) + 5} textAnchor="middle" fontSize="15" fill="#2b2824">{name}</text>
          </g>
        );
      })}
      <Owner x={20} person={ana} color="var(--ana)" soft="var(--ana-soft)" />
      <Owner x={570} person={cara} color="var(--cara)" soft="var(--cara-soft)" />
    </svg>
  );
}

function Owner({ x, person, color, soft }: { x: number; person: { name: string; assistants: string }; color: string; soft: string }) {
  return (
    <g>
      <rect x={x} y="170" width="170" height="100" rx="16" fill={soft} />
      <text x={x + 18} y="206" fontSize="18" fontWeight="600" fill="#2b2824">{person.name}</text>
      {person.assistants.split(' and ').map((assistant, i) => (
        <g key={assistant}>
          <circle cx={x + 23} cy={229 + i * 22} r="4" fill={color} />
          <text x={x + 34} y={234 + i * 22} fontSize="14" fill="#2b2824">{assistant}</text>
        </g>
      ))}
    </g>
  );
}

/** 2. Each person's spaces as a world of their own; the shared ones are where the worlds overlap. */
export function Overlap() {
  const chip = (name: string, cx: number, cy: number) => (
    <g key={name}>
      <rect x={cx - 66} y={cy - 17} width="132" height="34" rx="17" fill="#fffdf9" />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="15" fill="#2b2824">{name}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 760 440" role="img" aria-label="Two overlapping circles: Ana’s spaces, Cara’s spaces, and the shared spaces in the overlap." className="w-full" style={{ ...colors, fontFamily: 'inherit' }}>
      <circle cx="285" cy="240" r="180" fill="var(--ana-soft)" />
      <circle cx="475" cy="240" r="180" fill="var(--cara-soft)" style={{ mixBlendMode: 'multiply' }} />
      <text x="200" y="118" textAnchor="middle" fontSize="18" fontWeight="600" fill="#2b2824">Ana</text>
      <text x="200" y="140" textAnchor="middle" fontSize="14" fill="var(--ana)">{ana.assistants}</text>
      <text x="560" y="118" textAnchor="middle" fontSize="18" fontWeight="600" fill="#2b2824">Cara</text>
      <text x="560" y="140" textAnchor="middle" fontSize="14" fill="var(--cara)">{cara.assistants}</text>
      {anaOnly.map((name, i) => chip(name, 195, 200 + i * 52))}
      {shared.map((name, i) => chip(name, 380, 222 + i * 52))}
      {caraOnly.map((name, i) => chip(name, 565, 222 + i * 52))}
    </svg>
  );
}

/** 3. Each person's assistants as a line through their spaces; shared spaces are interchanges. */
export function Metro() {
  const station = (x: number, y: number, color: string) => <circle cx={x} cy={y} r="9" fill="#fffdf9" stroke={color} strokeWidth="4" />;
  const label = (text: string, x: number, y: number) => (
    <text x={x} y={y} textAnchor="middle" fontSize="15" fill="#2b2824">{text}</text>
  );
  return (
    <svg viewBox="0 0 760 380" role="img" aria-label="A metro map: Ana’s line and Cara’s line run through their own spaces and meet at the shared ones." className="w-full" style={{ ...colors, fontFamily: 'inherit' }}>
      <path d="M40 110 H250 C290 110 290 176 330 176 H600 C640 176 640 110 680 110 H730" fill="none" stroke="var(--ana)" strokeWidth="8" strokeLinecap="round" />
      <path d="M40 270 H250 C290 270 290 196 330 196 H600 C640 196 640 270 680 270 H730" fill="none" stroke="var(--cara)" strokeWidth="8" strokeLinecap="round" />
      {station(100, 110, 'var(--ana)')}
      {label('Kitchen', 100, 88)}
      {station(205, 110, 'var(--ana)')}
      {label('Half marathon', 205, 88)}
      {station(700, 110, 'var(--ana)')}
      {label('Family trip', 700, 88)}
      {station(100, 270, 'var(--cara)')}
      {label('Garden', 100, 304)}
      {station(700, 270, 'var(--cara)')}
      {label('Book club', 700, 304)}
      {[
        ['Acme launch', 400],
        ['Brand refresh', 530],
      ].map(([name, x]) => (
        <g key={name}>
          <rect x={Number(x) - 13} y="163" width="26" height="46" rx="13" fill="#fffdf9" stroke="#2b2824" strokeWidth="3" />
          {label(String(name), Number(x), 146)}
        </g>
      ))}
      <g fontSize="14" fill="#2b2824">
        <rect x="40" y="340" width="28" height="8" rx="4" fill="var(--ana)" />
        <text x="78" y="349">Ana’s {ana.assistants}</text>
        <rect x="380" y="340" width="28" height="8" rx="4" fill="var(--cara)" />
        <text x="418" y="349">Cara’s {cara.assistants}</text>
      </g>
    </svg>
  );
}

/** Someone's initial, in their color. */
function Initial({ who, faded }: { who: 'Ana' | 'Cara'; faded?: boolean }) {
  return (
    <span
      title={who}
      className="flex size-6 items-center justify-center rounded-full text-xs font-semibold"
      style={{ ...colors, background: who === 'Ana' ? 'var(--ana-soft)' : 'var(--cara-soft)', opacity: faded ? 0.6 : 1 }}
    >
      {who[0]}
    </span>
  );
}

function Box({ name, people, children }: { name: string; people: ('Ana' | 'Cara')[]; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-semibold">{name}</p>
        <div className="flex gap-1">
          {people.map((who) => (
            <Initial key={who} who={who} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Inner({ name, people, closed }: { name: string; people: ('Ana' | 'Cara')[]; closed?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-background px-3 py-2.5">
      <p className="text-sm">
        {name}
        {closed && <span className="ml-2 text-xs text-muted-foreground">Closed</span>}
      </p>
      <div className="flex gap-1">
        {people.map((who) => (
          <Initial key={who} who={who} faded />
        ))}
      </div>
    </div>
  );
}

/** 5. Spaces hold other spaces. Inviting Cara to Acme lets her into everything inside, except what's closed. */
export function Nested() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Box name="Ana’s home" people={['Ana']}>
        <Inner name="Kitchen" people={['Ana']} />
        <Inner name="Half marathon" people={['Ana']} />
        <Inner name="Family trip" people={['Ana']} />
      </Box>
      <Box name="Acme" people={['Ana', 'Cara']}>
        <Inner name="Acme launch" people={['Ana', 'Cara']} />
        <Inner name="Brand refresh" people={['Ana', 'Cara']} />
        <Inner name="Budget" people={['Ana']} closed />
      </Box>
      <Box name="Cara’s home" people={['Cara']}>
        <Inner name="Garden" people={['Cara']} />
        <Inner name="Book club" people={['Cara']} />
      </Box>
    </div>
  );
}

/** 4. Each space a house; each person's bird visits the houses they live in, and both meet at the shared ones. */
export function Street() {
  return <img src={street} alt="A lane of small houses. Two paper birds each visit their own houses and meet at the two in the middle." className="w-full" />;
}

const options = [
  {
    key: '1',
    name: 'A web of connections',
    says: 'Two people, each with their assistants, and a line to every space they are in. The two shared spaces get lines from both. The most literal: you can trace exactly who reaches what.',
    caption: 'Ana’s and Cara’s assistants reach their own spaces, and both reach the ones they share.',
    render: () => <Web />,
  },
  {
    key: '2',
    name: 'Two overlapping worlds',
    says: 'Each person’s spaces as a world of their own, and the shared ones where the worlds overlap. The quickest to read, and the least about assistants.',
    caption: 'What you share is where your worlds overlap.',
    render: () => <Overlap />,
  },
  {
    key: '3',
    name: 'A metro map',
    says: 'Each person’s assistants run as a line through their spaces, and the shared spaces are interchanges. Playful and familiar, with assistants in motion.',
    caption: 'Your assistants travel through your spaces. Shared spaces are where lines meet.',
    render: () => <Metro />,
  },
  {
    key: '4',
    name: 'A street of houses',
    says: 'A drawing instead of a diagram: each space is a house, and each person’s bird visits the houses they live in. Both birds meet at the shared ones. The warmest, and it fits the storybook, but it says the least exactly.',
    caption: 'Each space is a house. Your assistant visits all of yours, and the ones you share.',
    render: () => <Street />,
  },
  {
    key: '5',
    name: 'Spaces inside spaces',
    says: 'Spaces hold other spaces. Cara is invited to Acme and reaches everything inside it, except the closed budget. The only one that shows how spaces are organized, and the most like the product.',
    caption: 'Invite someone to a space, and they reach what’s inside it, except what’s closed.',
    render: () => <Nested />,
  },
];

/** The five options, each set as it would sit in its chapter. */
export function LandingVisuals() {
  return (
    <div className="landing bg-background text-foreground">
      <header className="mx-auto flex max-w-[44rem] flex-col gap-3 px-5 pt-10 pb-12 sm:px-8">
        <Wordmark className="text-lg" />
        <h1 className="text-2xl font-semibold">How Homing is built: five ways to show it</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          The same Homing each time: Ana and Cara, each with their own assistants, seven spaces, and two of them shared.
        </p>
      </header>
      <main className="flex flex-col gap-4 pb-4">
        {options.map((option) => (
          <section key={option.key} id={`option-${option.key}`} aria-labelledby={`title-${option.key}`} className="px-2 sm:px-3">
            <div className="rounded-[1.75rem] bg-muted px-5 py-16 sm:px-8 lg:py-20">
              <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <h2 id={`title-${option.key}`} className="text-lg font-semibold">
                    {option.key}. {option.name}
                  </h2>
                  <p className="t-small">{option.says}</p>
                </div>
                <figure className="flex flex-col gap-3">
                  {option.render()}
                  <figcaption className="t-small text-muted-foreground">{option.caption}</figcaption>
                </figure>
              </div>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
