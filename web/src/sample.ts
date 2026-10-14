import type { RuleKind } from '@/components/proposed-change';

// Sample data until #4 connects these screens to real proposals.
export type Proposal = {
  assistant: string;
  space: string;
  kind: RuleKind;
  text: string;
  alreadyApplies: { kind: RuleKind; text: string; from: string }[];
  precedence: string;
};

export const proposal: Proposal = {
  assistant: 'Claude',
  space: 'Acme',
  kind: 'preference',
  text: 'Write status reports in Norwegian.',
  alreadyApplies: [
    { kind: 'preference', text: 'Write reports in English.', from: 'your personal space' },
    { kind: 'requirement', text: 'Never name other clients in documents for Acme.', from: 'Acme' },
  ],
  precedence: 'The new rule is more specific than your personal one, so it wins in Acme.',
};
