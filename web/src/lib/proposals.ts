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

/** Whether a change or removal lost its rule before anyone decided. */
export function isGone(proposal: Pick<ProposalData, 'action' | 'rule'>): boolean {
  return proposal.action !== 'add' && !proposal.rule?.current;
}

/** The buttons for deciding it. */
export function buttonsOf(action: ProposalData['action']): { approve: string; reject: string } {
  return action === 'add'
    ? { approve: 'Add rule', reject: 'Don’t add' }
    : action === 'change'
      ? { approve: 'Change rule', reject: 'Don’t change' }
      : { approve: 'Remove rule', reject: 'Keep it' };
}

/** What happened, once it is decided, expired, or no longer possible. Undefined while it waits. */
export function outcomeOf(proposal: ProposalData): { kind: 'approved' | 'rejected' | 'expired' | 'gone'; heading: string; detail: string } | undefined {
  const { action, assistant, state } = proposal;
  const place = placeOf(proposal);
  if (state === 'approved') {
    return {
      kind: 'approved',
      heading: action === 'add' ? `Rule added to ${place}` : action === 'change' ? `Rule changed in ${place}` : `Rule removed from ${place}`,
      detail: action === 'remove' ? 'It no longer applies.' : 'It applies from now on.',
    };
  }
  if (state === 'rejected') {
    return { kind: 'rejected', heading: action === 'add' ? 'Not added' : action === 'change' ? 'Not changed' : 'Not removed', detail: 'Nothing changed.' };
  }
  if (state === 'expired') {
    return { kind: 'expired', heading: 'This request expired', detail: `Nothing changed. Ask ${assistant} again if you still want it.` };
  }
  if (isGone(proposal)) {
    return { kind: 'gone', heading: 'This rule no longer applies', detail: `It was removed after ${assistant} asked, so there’s nothing to decide.` };
  }
  return undefined;
}
