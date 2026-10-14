import { ChevronDown } from 'lucide-react';
import type { Proposal } from '@/sample';

/** The rules that already apply where a new one would go, so the person sees what it joins. */
export function AlreadyApplies({ rules, precedence, open }: Pick<Proposal, 'precedence'> & { rules: Proposal['alreadyApplies']; open?: boolean }) {
  if (!rules.length) return null;
  return (
    <details open={open} className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {rules.length === 1 ? '1 rule already applies here' : `${rules.length} rules already apply here`}
        <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <ul className="flex flex-col gap-3 border-t px-4 py-3">
        {rules.map((rule) => (
          <li key={rule.text} className="flex flex-col gap-0.5 text-sm">
            <span>{rule.text}</span>
            <span className="text-xs text-muted-foreground">
              {rule.kind === 'requirement' ? 'Requirement' : 'Preference'}, from {rule.from}
            </span>
          </li>
        ))}
        <li className="text-xs text-muted-foreground">{precedence}</li>
      </ul>
    </details>
  );
}
