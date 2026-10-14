import { useState } from 'react';
import { CircleCheck, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Wordmark } from '@/components/wordmark';

export interface Passkey {
  id: string;
  /** Where it was made, such as "Mac". */
  name: string | null;
  createdAt: string;
}

export interface AccountData {
  name: string;
  email: string;
  instanceAdmin: boolean;
  passkeys: Passkey[];
}

/** What the account page does. Each resolves to a message to show, or nothing when it worked. */
export interface AccountActions {
  addPasskey(): Promise<string | undefined>;
  removePasskey(id: string): Promise<string | undefined>;
  signInAgain(): Promise<void>;
  signOut(): Promise<void>;
}

/** Your account: how you sign in. */
export function Account({ account, welcome, actions }: { account: AccountData; welcome?: boolean; actions?: AccountActions }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-5">
        <a href="/" className="rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/70 focus-visible:outline-none"><Wordmark /></a>
        <span className="text-sm text-muted-foreground">{account.name}</span>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-16">
        {welcome ? (
          <div className="flex items-start gap-3 rounded-xl bg-change p-5" role="status">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-primary" />
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold tracking-tight">Welcome, {account.name.split(' ')[0]}</h1>
              <p className="text-[15px] text-muted-foreground">Your account is ready, and you're signed in.</p>
            </div>
          </div>
        ) : (
          <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
        )}

        <SignInMethods account={account} actions={actions} />

        <div>
          <Button variant="outline" size="lg" className="h-11 text-[15px] sm:px-5" onClick={() => actions?.signOut()}>Sign out</Button>
        </div>
      </main>
    </div>
  );
}

function SignInMethods({ account, actions }: { account: AccountData; actions?: AccountActions }) {
  const [message, setMessage] = useState<string>();
  const [staleSession, setStaleSession] = useState(false);
  const [removing, setRemoving] = useState<string>();
  const [busy, setBusy] = useState(false);
  const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

  const run = async (action: () => Promise<string | undefined>) => {
    setBusy(true);
    setMessage(undefined);
    const problem = await action();
    setStaleSession(problem === signInAgainMessage);
    setMessage(problem);
    setBusy(false);
  };

  return (
    <section aria-labelledby="sign-in-heading" className="flex flex-col gap-5 rounded-xl border bg-card p-6 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 id="sign-in-heading" className="text-lg font-semibold tracking-tight">How you sign in</h2>
        <p className="text-[15px] text-muted-foreground">With your email, {account.email}, and a passkey.</p>
      </div>

      <ul className="flex flex-col divide-y rounded-lg border">
        {account.passkeys.map((passkey) => (
          <li key={passkey.id} className="flex flex-col gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <KeyRound aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium">{passkey.name ? `Passkey on ${passkey.name}` : 'Passkey'}</span>
                <span className="text-sm text-muted-foreground">Added {date.format(new Date(passkey.createdAt))}</span>
              </div>
              {account.passkeys.length > 1 && removing !== passkey.id && (
                <Button variant="outline" size="sm" onClick={() => setRemoving(passkey.id)}>Remove</Button>
              )}
            </div>
            {removing === passkey.id && (
              <div className="flex flex-col gap-3 rounded-lg bg-muted p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">You won't be able to sign in with this passkey any more.</p>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => setRemoving(undefined)}>Keep it</Button>
                  <Button variant="destructive" size="sm" disabled={busy} onClick={() => actions && run(async () => {
                    const problem = await actions.removePasskey(passkey.id);
                    if (!problem) setRemoving(undefined);
                    return problem;
                  })}>Remove passkey</Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        <div>
          <Button variant="outline" size="lg" className="h-11 text-[15px] sm:px-5" disabled={busy} onClick={() => actions && run(actions.addPasskey)}>
            <KeyRound data-icon="inline-start" />Add a passkey
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Add one for each device you use, so losing one doesn't lock you out.</p>
        {message && (
          <div className="flex flex-wrap items-center gap-3">
            <FieldError>{message}</FieldError>
            {staleSession && <Button variant="outline" size="sm" onClick={() => actions?.signInAgain()}>Sign in again</Button>}
          </div>
        )}
      </div>
    </section>
  );
}

/** Shown when adding a passkey needs a fresh sign-in. */
export const signInAgainMessage = 'For your safety, sign in again before adding a passkey.';
