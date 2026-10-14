import { cn } from 'cn';

/**
 * Homing's mark, the folded paper bird, drawn as in docs/design/logo.svg. Its colors come from
 * --mark-light, --mark-dark and --mark-beak, so a dark surface can lighten it.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn('shrink-0', className)} aria-hidden="true">
      <polygon points="44.5,27.4 28.3,79.3 79.7,96.8" fill="var(--mark-light)" />
      <polygon points="45.6,27 83.2,0 64.7,65" fill="var(--mark-dark)" />
      <polygon points="65.2,68 98.9,100 79.7,96.5" fill="var(--mark-dark)" />
      <polygon points="6,42.6 18,27.6 40.6,33.4 32.3,60.8 13.4,48.4" fill="var(--mark-light)" />
      <polygon points="13.8,49.3 32.3,60.8 27.9,77.2" fill="var(--mark-dark)" />
      <polygon points="1.2,57.6 5.3,44.9 11.8,48.2" fill="var(--mark-beak)" />
      <circle cx="17.3" cy="39.6" r="2.4" fill="var(--mark-dark)" />
    </svg>
  );
}

/** The mark and the name, as Homing signs every page. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <Mark className="size-[1.4em]" />
      Homing
    </span>
  );
}
