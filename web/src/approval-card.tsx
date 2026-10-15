import { useState } from 'react';
import { CircleCheck, CircleSlash } from 'lucide-react';
import { AlreadyApplies } from '@/components/already-applies';
import { ProposedChange } from '@/components/proposed-change';
import { RuleReach } from '@/components/rule-reach';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/wordmark';
import { precedenceOf, type ProposalData } from '@/lib/proposals';

type State = 'open' | 'added' | 'declined';

/** The approval shown inside the conversation. Same parts as the page, sized for a chat. */
export function ApprovalCard({ proposal, initial = 'open' }: { proposal: ProposalData; initial?: State }) {
  const [state, setState] = useState<State>(initial);
  const [onlyHere, setOnlyHere] = useState(false);

  return (
    <section aria-label="Approve a rule" className="flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <Wordmark className="text-sm text-foreground" />
        <span>{state === 'open' ? 'Waiting for you' : state === 'added' ? 'Added' : 'Not added'}</span>
      </div>

      {state === 'open' ? (
        <>
          <p className="text-[15px] font-medium">Add this rule to {proposal.space}?</p>
          <ProposedChange kind={proposal.kind} text={proposal.text!} />
          <RuleReach id="card-only-here" space={proposal.space} onlyHere={onlyHere} onOnlyHereChange={setOnlyHere} />
          <AlreadyApplies rules={proposal.alreadyApplies} precedence={precedenceOf(proposal)} />
          <div className="flex flex-wrap gap-2">
            <Button className="h-10 px-4" onClick={() => setState('added')}>Add rule</Button>
            <Button variant="outline" className="h-10 px-4" onClick={() => setState('declined')}>Don't add</Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3" role="status">
          <p className="flex items-center gap-2 text-[15px] font-medium">
            {state === 'added'
              ? <CircleCheck aria-hidden="true" className="size-5 text-primary" />
              : <CircleSlash aria-hidden="true" className="size-5 text-muted-foreground" />}
            {state === 'added' ? `Added to ${proposal.space}` : 'Not added. Nothing changed.'}
          </p>
          <ProposedChange kind={proposal.kind} text={proposal.text!} settled />
        </div>
      )}
    </section>
  );
}
