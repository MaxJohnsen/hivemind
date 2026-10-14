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

// A longer rule, to check that every screen shows it in full and stays readable.
export const longProposal: Proposal = {
  ...proposal,
  kind: 'requirement',
  text: [
    'Weekly status reports for Acme follow this structure:',
    '',
    '1. What was done this week, in at most three points.',
    '2. What happens next week, each with a date.',
    '3. Risks, each with an owner and what we are doing about it.',
    '',
    'Write them in Norwegian, keep them under one page, and send them to Gunnar before 15:00 on Fridays.',
  ].join('\n'),
  precedence: 'Requirements always apply. If two requirements conflict, the assistant stops and tells you.',
};
