import { useState } from 'react';
import { CircleCheck, CircleSlash } from 'lucide-react';
import { AlreadyApplies } from '@/components/already-applies';
import { ProposedChange } from '@/components/proposed-change';
import { RuleReach } from '@/components/rule-reach';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/wordmark';
import type { Proposal } from '@/sample';

type State = 'open' | 'added' | 'declined';

/** The confirmation page an assistant links to when it can't show a card. */
export function Confirm({ proposal, initial = 'open' }: { proposal: Proposal; initial?: State }) {
  const [state, setState] = useState<State>(initial);
  const [onlyHere, setOnlyHere] = useState(false);

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-5">
        <Wordmark />
        <span className="text-sm text-muted-foreground">Ana Berg</span>
      </header>

      <main className="mx-auto w-full max-w-xl px-4 pb-16">
        <div className="flex flex-col gap-6 rounded-xl border bg-card p-6 sm:p-8">
          {state === 'open' ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">{proposal.assistant} wants to add a rule to {proposal.space}</h1>
              <ProposedChange kind={proposal.kind} text={proposal.text} />
              <RuleReach id="only-here" space={proposal.space} onlyHere={onlyHere} onOnlyHereChange={setOnlyHere} />
              <AlreadyApplies rules={proposal.alreadyApplies} precedence={proposal.precedence} />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" size="lg" className="h-11 text-[15px] sm:px-5" onClick={() => setState('declined')}>Don't add</Button>
                <Button size="lg" className="h-11 text-[15px] sm:px-5" onClick={() => setState('added')}>Add rule</Button>
              </div>
              <p className="text-xs text-muted-foreground">Only you can approve this. {proposal.assistant} can't do it for you.</p>
            </>
          ) : (
            <div className="flex flex-col gap-5" role="status">
              <div className="flex items-start gap-3">
                {state === 'added'
                  ? <CircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-primary" />
                  : <CircleSlash aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-muted-foreground" />}
                <div className="flex flex-col gap-1">
                  <h1 className="text-xl font-semibold tracking-tight">
                    {state === 'added' ? `Rule added to ${proposal.space}` : 'Not added'}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {state === 'added'
                      ? `${proposal.assistant} follows it from the next message. You can close this page.`
                      : 'Nothing changed. You can close this page.'}
                  </p>
                </div>
              </div>
              <ProposedChange kind={proposal.kind} text={proposal.text} settled />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
