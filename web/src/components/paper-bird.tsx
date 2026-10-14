import { useId } from 'react';
import { cn } from 'cn';

export type BirdPose = 'perched' | 'flying';

/**
 * Hivemind's paper bird, drawn from its character sheet (docs/design/paper-bird.jpg) as flat folds,
 * so its wings can move. It faces left. A light grain keeps it close to the pencil drawings.
 */
export function PaperBird({ pose = 'perched', className }: { pose?: BirdPose; className?: string }) {
  const grain = useId();
  return (
    <svg viewBox="0 0 100 80" className={cn('paper-bird overflow-visible', className)} data-pose={pose} aria-hidden="true">
      <defs>
        <filter id={grain} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.33  0 0 0 0 0.3  0 0 0 0.22 0" result="specks" />
          <feComposite in="specks" in2="SourceGraphic" operator="in" result="grainOnBird" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="grainOnBird" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${grain})`} stroke="#8d9b7b" strokeWidth="0.5" strokeLinejoin="round">
        <g className="far-wing">
          <polygon points="50,47 71,13 77,50" fill="#93a57f" />
        </g>
        <polygon className="tail" points="60,50 98,65 62,61" fill="#a9b892" />
        <g className="legs" stroke="#c98d70">
          <polygon points="40,60 43.5,60 40.5,71" fill="#d99c7e" />
          <polygon points="47,61 50.5,61 48.5,71" fill="#d99c7e" />
        </g>
        <polygon className="breast" points="20,42 34,39 45,58 31,61 23,53" fill="#e8b697" stroke="#d29c7f" />
        <polygon className="body" points="34,39 72,50 56,62 45,58" fill="#bcc7a6" />
        <polygon className="head" points="13,30 31,27 34,39 20,42" fill="#c3cdae" />
        <polygon className="head-fold" points="13,30 31,27 22,35" fill="#aebd98" />
        <polygon className="beak" points="20,36 20.5,42 6,46" fill="#d99c7e" stroke="#c98d70" />
        <circle cx="25.5" cy="34" r="1.6" fill="#2b2824" stroke="none" />
        <g className="near-wing">
          <polygon points="41,47 58,5 61,55" fill="#c3cdae" />
          <polygon points="58,5 80,30 61,55" fill="#a9b892" />
        </g>
      </g>
    </svg>
  );
}
