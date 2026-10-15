import { useState, type ReactNode } from 'react';
import { CircleCheck, CircleSlash, Clock } from 'lucide-react';
import { AlreadyApplies } from '@/components/already-applies';
import { ProposedChange } from '@/components/proposed-change';
import { RuleReach } from '@/components/rule-reach';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Wordmark } from '@/components/wordmark';
import { placeOf, precedenceOf, type ProposalData } from '@/lib/proposals';

/** Approves or rejects, keeping a new rule to its space if asked. Resolves to a message to show, if any. */
export type Decide = (approve: boolean, onlyHere: boolean) => Promise<string | undefined>;

/** The page an assistant links to, where the person decides a change it proposed. */
export function Confirm({ proposal, person, decide, message: initialMessage }: {
  proposal: ProposalData;
  person: string;
  decide?: Decide;
  /** Something to tell the person before they decide. */
  message?: string;
}) {
  const [onlyHere, setOnlyHere] = useState(proposal.onlyHere);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const { assistant, action, kind, rule } = proposal;
  const place = placeOf(proposal);
  const gone = action !== 'add' && !rule?.current;

  const choose = async (approve: boolean) => {
    if (!decide) return;
    setBusy(true);
    setMessage(await decide(approve, onlyHere));
    setBusy(false);
  };

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-5">
        <Wordmark />
        <span className="text-sm text-muted-foreground">{person}</span>
      </header>

      <main className="mx-auto w-full max-w-xl px-4 pb-16">
        <div className="flex flex-col gap-6 rounded-xl border bg-card p-6 sm:p-8">
          {proposal.state === 'open' && !gone ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-balance">
                {action === 'add'
                  ? `${assistant} wants to add a rule to ${place}`
                  : action === 'change'
                    ? `${assistant} wants to change a ${kind} in ${place}`
                    : `${assistant} wants to remove a ${kind} from ${place}`}
              </h1>

              {action === 'add' && (
                <>
                  <ProposedChange kind={kind} text={proposal.text!} onlyYou={!proposal.shared} />
                  <RuleReach
                    id="only-here"
                    space={proposal.space}
                    shared={proposal.shared}
                    personal={proposal.personal}
                    onlyHere={onlyHere}
                    onOnlyHereChange={setOnlyHere}
                    disabled={busy}
                  />
                  <AlreadyApplies rules={proposal.alreadyApplies} precedence={precedenceOf(proposal)} />
                </>
              )}
              {action === 'change' && (
                <div className="flex flex-col gap-3">
                  <ProposedChange kind={kind} text={rule!.text} label="Now" settled />
                  <ProposedChange kind={kind} text={proposal.text!} label="Changed to" onlyYou={!proposal.shared} />
                </div>
              )}
              {action === 'remove' && <ProposedChange kind={kind} text={rule!.text} onlyYou={!proposal.shared} />}
              {action !== 'add' && (
                <RuleReach
                  id="only-here"
                  space={proposal.space}
                  shared={proposal.shared}
                  personal={proposal.personal}
                  onlyHere={proposal.onlyHere}
                  removing={action === 'remove'}
                />
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" size="lg" className="h-11 text-[15px] sm:px-5" disabled={busy} onClick={() => choose(false)}>
                  {action === 'add' ? 'Don’t add' : action === 'change' ? 'Don’t change' : 'Keep it'}
                </Button>
                <Button size="lg" className="h-11 text-[15px] sm:px-5" disabled={busy} onClick={() => choose(true)}>
                  {action === 'add' ? 'Add rule' : action === 'change' ? 'Change rule' : 'Remove rule'}
                </Button>
              </div>
              {message && <FieldError>{message}</FieldError>}
              <p className="text-xs text-muted-foreground">Only you can approve this. {assistant} can’t do it for you.</p>
            </>
          ) : (
            <Settled proposal={proposal} gone={gone} />
          )}
        </div>
      </main>
    </div>
  );
}

/** A decided, expired or no longer possible change, still showing what it was, greyed. */
function Settled({ proposal, gone }: { proposal: ProposalData; gone: boolean }) {
  const { assistant, action, kind, state, rule } = proposal;
  const place = placeOf(proposal);
  const closing = 'You can close this page.';
  const [icon, heading, text]: [ReactNode, string, string] =
    state === 'approved'
      ? [
          <CircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-primary" />,
          action === 'add' ? `Rule added to ${place}` : action === 'change' ? `Rule changed in ${place}` : `Rule removed from ${place}`,
          `${action === 'remove' ? 'It no longer applies.' : 'It applies from now on.'} ${closing}`,
        ]
      : state === 'rejected'
        ? [
            <CircleSlash aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-muted-foreground" />,
            action === 'add' ? 'Not added' : action === 'change' ? 'Not changed' : 'Not removed',
            `Nothing changed. ${closing}`,
          ]
        : state === 'expired'
          ? [
              <Clock aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-muted-foreground" />,
              'This request expired',
              `Nothing changed. Ask ${assistant} again if you still want it.`,
            ]
          : [
              <CircleSlash aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-muted-foreground" />,
              'This rule no longer applies',
              `It was removed after ${assistant} asked, so there’s nothing to decide. ${closing}`,
            ];
  // What was decided, or the rule as it was, when it went before anyone decided.
  const shown = action === 'remove' || (state === 'open' && gone) ? rule?.text : proposal.text;

  return (
    <div className="flex flex-col gap-5" role="status">
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{heading}</h1>
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
      </div>
      {shown && <ProposedChange kind={kind} text={shown} label={action === 'change' && state === 'approved' ? 'Changed to' : undefined} settled />}
    </div>
  );
}
