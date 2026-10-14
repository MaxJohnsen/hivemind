import { cn } from 'cn';

/** The name, with a small peach dot. There is no logo yet. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span aria-hidden="true" className="size-2.5 rounded-full bg-wash" />
      Hivemind
    </span>
  );
}
