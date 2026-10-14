import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Wordmark } from '@/components/wordmark';

export interface ConnectingAssistant {
  name: string;
  /** Where the assistant says it is, from the address of its metadata document. */
  site: string;
}

/** Choosing whether an assistant may use Homing as you. */
export function Connect({
  assistant,
  person,
  decide,
}: {
  assistant: ConnectingAssistant;
  person: string;
  /** Allows or refuses. Resolves to a message to show, or nothing once on the way back to the assistant. */
  decide?: (allow: boolean) => Promise<string | undefined>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  const choose = async (allow: boolean) => {
    if (!decide) return;
    setBusy(true);
    setMessage(await decide(allow));
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
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{assistant.name} wants to use Homing as you</h1>
            <p className="text-[15px] text-muted-foreground">
              Allow it only if you are connecting from <span className="font-medium text-foreground">{assistant.site}</span>.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-lg bg-change p-5 text-[15px]">
            <p>{assistant.name} will be able to find and read everything you can see in Homing, and save what it learns where only you can see it.</p>
            <p>It can't change rules, and it can't share anything with others.</p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" size="lg" className="h-11 text-[15px] sm:px-5" disabled={busy} onClick={() => choose(false)}>Don't allow</Button>
            <Button size="lg" className="h-11 text-[15px] sm:px-5" disabled={busy} onClick={() => choose(true)}>Allow</Button>
          </div>
          {message && <FieldError>{message}</FieldError>}
          <p className="text-xs text-muted-foreground">You can disconnect it at any time from your account.</p>
        </div>
      </main>
    </div>
  );
}
