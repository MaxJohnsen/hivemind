import { cn } from 'cn';

/** The name, set in the interface font. There is no logo yet. */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cn('font-semibold tracking-tight', className)}>Hivemind</span>;
}
