import type { AccountData } from '@/screens/account';
import type { ProposalData } from '@/lib/proposals';

// Claude proposes a preference for Acme, where two rules already apply.
export const proposal: ProposalData = {
  id: 'sample',
  assistant: 'Claude',
  space: 'Acme',
  personal: false,
  action: 'add',
  kind: 'preference',
  text: 'Write status reports in Norwegian.',
  rule: null,
  shared: true,
  onlyHere: false,
  state: 'open',
  alreadyApplies: [
    { kind: 'preference', text: 'Write reports in English.', from: 'your personal space' },
    { kind: 'requirement', text: 'Never name other clients in documents for Acme.', from: 'Acme' },
  ],
};

// A longer rule, to check that every screen shows it in full and stays readable.
export const longProposal: ProposalData = {
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
};

// A rule only for Ana, in her personal space.
export const personalProposal: ProposalData = {
  ...proposal,
  space: 'Personal',
  personal: true,
  text: 'Keep answers short unless I ask for detail.',
  shared: false,
  alreadyApplies: [],
};

// Claude proposes new wording for one of Acme's rules, and removing another.
export const changeProposal: ProposalData = {
  ...proposal,
  action: 'change',
  text: 'Write status reports in Norwegian, and the summary in English.',
  rule: { text: 'Write status reports in Norwegian.', current: true },
  alreadyApplies: [],
};

export const removeProposal: ProposalData = {
  ...proposal,
  action: 'remove',
  kind: 'requirement',
  text: null,
  rule: { text: 'Never name other clients in documents for Acme.', current: true },
  alreadyApplies: [],
};

// Ana's account, with a passkey on her laptop and one on her phone, and Claude connected.
export const sampleAccount: AccountData = {
  name: 'Ana Berg',
  email: 'ana@acme.no',
  emailVerified: true,
  canEmail: true,
  instanceAdmin: false,
  passwords: true,
  password: false,
  passkeys: [
    { id: 'mac', name: 'Mac', createdAt: '2026-10-14T09:12:00Z' },
    { id: 'iphone', name: 'iPhone', createdAt: '2026-10-15T18:40:00Z' },
  ],
  assistants: [
    { clientId: 'https://claude.ai/oauth/mcp-oauth-client-metadata', name: 'Claude', connectedAt: '2026-10-14T09:20:00Z' },
    { clientId: 'https://chatgpt.com/oauth/client-metadata.json', name: 'ChatGPT', connectedAt: '2026-10-15T08:05:00Z' },
  ],
  mcpUrl: 'https://homing.acme.no/mcp',
};
