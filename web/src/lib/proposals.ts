import type { RuleKind } from '@/components/proposed-change';

/** A change an assistant proposed, as the decision page and the card show it. */
export interface ProposalData {
  id: string;
  /** The assistant that proposed it, such as Claude. */
  assistant: string;
  space: string;
  /** Whether the space is the person's personal space, whose rules follow them everywhere. */
  personal: boolean;
  action: 'add' | 'change' | 'remove';
  kind: RuleKind;
  /** The new rule, or the rule's new wording. */
  text: string | null;
  /** The rule a change or removal is about, as it is now, and whether it still applies. */
  rule: { text: string; current: boolean } | null;
  shared: boolean;
  onlyHere: boolean;
  state: 'open' | 'approved' | 'rejected' | 'expired';
  /** The rules that already apply where a new one would go. */
  alreadyApplies: { kind: RuleKind; text: string; from: string }[];
}

/** "Acme", or "your personal space". */
export function placeOf(proposal: Pick<ProposalData, 'space' | 'personal'>): string {
  return proposal.personal ? 'your personal space' : proposal.space;
}

/** How a new rule sits among the ones that already apply. */
export function precedenceOf(proposal: Pick<ProposalData, 'kind' | 'personal'>): string {
  if (proposal.kind === 'requirement') return 'Requirements always apply. If two requirements conflict, the assistant stops and tells you.';
  return proposal.personal
    ? 'A preference set in a space wins over it there, and requirements always apply.'
    : 'It wins over preferences from the spaces above and from your personal space, but never over a requirement.';
}
