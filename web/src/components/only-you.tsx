import { cn } from 'cn';

/** Marks what only the viewer can see. The label is always there; the color only supports it. */
export function OnlyYou({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full bg-private px-2 py-0.5 text-xs font-medium text-private-foreground', className)}>
      Only you
    </span>
  );
}
