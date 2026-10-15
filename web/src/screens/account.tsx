import { useState } from 'react';
import { Check, CircleCheck, Copy, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Wordmark } from '@/components/wordmark';
import empty from '@/assets/illustrations/empty.png';

export interface Passkey {
  id: string;
  /** Where it was made, such as "Mac". */
  name: string | null;
  createdAt: string;
}

export interface ConnectedAssistant {
  clientId: string;
  name: string;
  connectedAt: string;
}

export interface AccountData {
  name: string;
  email: string;
  instanceAdmin: boolean;
  passkeys: Passkey[];
  assistants: ConnectedAssistant[];
  /** The address assistants connect to. */
  mcpUrl: string;
}

/** What the account page does. Each resolves to a message to show, or nothing when it worked. */
export interface AccountActions {
  disconnect(clientId: string): Promise<string | undefined>;
  addPasskey(): Promise<string | undefined>;
  removePasskey(id: string): Promise<string | undefined>;
  signInAgain(): Promise<void>;
  signOut(): Promise<void>;
}

/** Your account: the assistants that use Homing as you, and how you sign in. */
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
              <p className="text-[15px] text-muted-foreground">Your account is ready. Next, connect your assistant.</p>
            </div>
          </div>
        ) : (
          <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
        )}

        <Assistants account={account} actions={actions} />
        <SignInMethods account={account} actions={actions} />

        <div>
          <Button variant="outline" size="lg" className="h-11 text-[15px] sm:px-5" onClick={() => actions?.signOut()}>Sign out</Button>
        </div>
      </main>
    </div>
  );
}

const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

function Assistants({ account, actions }: { account: AccountData; actions?: AccountActions }) {
  const [disconnecting, setDisconnecting] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  const disconnect = async (clientId: string) => {
    if (!actions) return;
    setBusy(true);
    const problem = await actions.disconnect(clientId);
    setMessage(problem);
    if (!problem) setDisconnecting(undefined);
    setBusy(false);
  };

  return (
    <section aria-labelledby="assistants-heading" className="flex flex-col gap-5 rounded-xl border bg-card p-6 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 id="assistants-heading" className="text-lg font-semibold tracking-tight">Assistants</h2>
        <p className="text-[15px] text-muted-foreground">They use Homing as you, with what you can see.</p>
      </div>

      {account.assistants.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-muted px-4 pt-2 pb-5 text-center">
          <img src={empty} alt="" width={960} height={640} className="w-48" />
          <p className="text-[15px] font-medium">No assistants yet</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {account.assistants.map((assistant) => (
            <li key={assistant.clientId} className="flex flex-col gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-medium">{assistant.name}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    From {siteOf(assistant.clientId)}, connected {date.format(new Date(assistant.connectedAt))}
                  </span>
                </div>
                {disconnecting !== assistant.clientId && (
                  <Button variant="outline" size="sm" onClick={() => setDisconnecting(assistant.clientId)}>Disconnect</Button>
                )}
              </div>
              {disconnecting === assistant.clientId && (
                <div className="flex flex-col gap-3 rounded-lg bg-muted p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm">{assistant.name} stops working with Homing right away. You can connect it again later.</p>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDisconnecting(undefined)}>Keep it</Button>
                    <Button variant="destructive" size="sm" disabled={busy} onClick={() => disconnect(assistant.clientId)}>Disconnect</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {message && <FieldError>{message}</FieldError>}

      <div className="flex flex-col gap-2">
        <p className="text-[15px]">
          {account.assistants.length === 0 ? 'To connect Claude, ChatGPT or another assistant' : 'To connect another assistant'}, add
          Homing to it as a connector with this address, then sign in and allow it.
        </p>
        <CopyAddress value={account.mcpUrl} />
      </div>
    </section>
  );
}

function CopyAddress({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background py-1.5 pr-1.5 pl-4">
      <code className="min-w-0 flex-1 truncate text-sm">{value}</code>
      <Button variant="outline" size="sm" onClick={copy} aria-live="polite">
        {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

function siteOf(clientId: string): string {
  try {
    return new URL(clientId).hostname;
  } catch {
    return clientId;
  }
}

function SignInMethods({ account, actions }: { account: AccountData; actions?: AccountActions }) {
  const [message, setMessage] = useState<string>();
  const [staleSession, setStaleSession] = useState(false);
  const [removing, setRemoving] = useState<string>();
  const [busy, setBusy] = useState(false);

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
