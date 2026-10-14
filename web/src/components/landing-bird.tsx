import { useLayoutEffect, useRef, useState } from 'react';
import { PaperBird, type BirdPose } from '@/components/paper-bird';

/**
 * The paper bird flies in from the right and lands on the top edge of its parent, which must be
 * positioned. With reduced motion it is simply there.
 */
export function LandingBird() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [pose, setPose] = useState<BirdPose>(reduced ? 'perched' : 'flying');

  useLayoutEffect(() => {
    const bird = ref.current;
    if (reduced || !bird) return;
    const end = bird.getBoundingClientRect();
    const dx = window.innerWidth + 40 - end.left;
    const dy = window.innerHeight * 0.4 - end.top;
    const flight = bird.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) rotate(-4deg)` },
        { transform: `translate(${dx * 0.62}px, ${dy * 0.45 - 40}px) rotate(-8deg)`, offset: 0.4 },
        { transform: `translate(${dx * 0.22}px, -70px) rotate(4deg)`, offset: 0.78 },
        { transform: 'translate(0, -6px) rotate(2deg)', offset: 0.93 },
        { transform: 'translate(0, 0) rotate(0)' },
      ],
      { duration: 2400, delay: 250, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)', fill: 'backwards' },
    );
    flight.onfinish = () => setPose('perched');
    return () => flight.cancel();
  }, [reduced]);

  return (
    <div ref={ref} aria-hidden="true" className="landing-bird pointer-events-none absolute right-7 -top-[68px] z-50 w-24">
      <PaperBird pose={pose} />
    </div>
  );
}
