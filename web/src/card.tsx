import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApprovalCard } from '@/approval-card';
import { demoHosts, hostBackground } from '@/demo-hosts';
import { longProposal, proposal } from '@/sample';
import './card.css';

// Until #4 connects the card to MCP Apps, ?host= previews it with a host's approximate styles
// and ?sample=long with a longer rule.
const params = new URLSearchParams(location.search);
const host = params.get('host') ?? '';
const demo = demoHosts[host];
if (demo) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(demo.variables)) root.style.setProperty(name, value);
  root.dataset.theme = demo.theme;
  document.body.style.background = hostBackground[host];
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="p-3">
      <ApprovalCard proposal={params.get('sample') === 'long' ? longProposal : proposal} />
    </div>
  </StrictMode>,
);
