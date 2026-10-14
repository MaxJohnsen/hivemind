import { cn } from 'cn';

export type RuleKind = 'requirement' | 'preference';

const kindLabel: Record<RuleKind, string> = { requirement: 'Requirement', preference: 'Preference' };

/** The exact change someone is deciding on, word for word and set apart from everything around it. */
export function ProposedChange({ kind, text, settled, className }: { kind: RuleKind; text: string; settled?: boolean; className?: string }) {
  return (
    <figure className={cn('flex flex-col gap-1.5 rounded-lg bg-change px-4 py-3.5', settled && 'bg-muted', className)}>
      <figcaption className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{kindLabel[kind]}</figcaption>
      <blockquote className={cn('text-lg leading-snug font-medium', settled && 'text-muted-foreground')}>{text}</blockquote>
    </figure>
  );
}
