import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { GoogleLogo, MicrosoftLogo } from '@/components/provider-logos';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Wordmark } from '@/components/wordmark';
import bird from '@/assets/illustrations/bird.jpg';
import scene from '@/assets/illustrations/signin.jpg';

export type SignInStep = 'email' | 'passkey' | 'password' | 'wrong';

const email = 'ana@acme.no';

/**
 * Email first, then the person's passkey or password, the way most large sign-ins work. The email
 * field also offers saved passkeys directly. On a phone only the form shows.
 */
export function SignIn({ connecting, initial = 'email' }: { connecting?: string; initial?: SignInStep }) {
  const [step, setStep] = useState<SignInStep>(initial);
  const next = (to: SignInStep) => (event: FormEvent) => {
    event.preventDefault();
    setStep(to);
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Wordmark className="text-lg" />
        <main className="flex flex-1 items-start pt-10 pb-10 sm:items-center">
          <div className="relative mx-auto flex w-full max-w-sm flex-col gap-7 rounded-2xl border bg-card p-6 sm:p-8">
            <img src={bird} alt="" width={300} height={250} className="illustration pointer-events-none absolute right-6 -top-[71px] w-24" />
            <div className="flex flex-col gap-1.5">
              <h1 className="text-[28px] leading-tight font-semibold tracking-tight">
                {connecting ? `Sign in to connect ${connecting}` : 'Sign in to Hivemind'}
              </h1>
              {connecting && step === 'email' && (
                <p className="text-[15px] text-muted-foreground">Then you choose whether {connecting} may use Hivemind as you.</p>
              )}
            </div>

            {step === 'email' ? (
              <>
                <form className="flex flex-col gap-4" onSubmit={next('passkey')} noValidate>
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input id="email" type="email" autoComplete="username webauthn" className="h-11" />
                  </Field>
                  <Button type="submit" size="lg" className="h-11 w-full text-[15px]">Continue</Button>
                </form>
                <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
                  <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
                </div>
                <div className="flex flex-col gap-2.5">
                  <Button variant="outline" size="lg" className="h-11 w-full text-[15px]"><GoogleLogo />Continue with Google</Button>
                  <Button variant="outline" size="lg" className="h-11 w-full text-[15px]"><MicrosoftLogo />Continue with Microsoft</Button>
                </div>
                <p className="text-sm text-muted-foreground">New here? You join through an invite from someone who uses Hivemind.</p>
              </>
            ) : (
              <>
                <p className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-[15px]">
                  <span className="min-w-0 truncate">{email}</span>
                  <button type="button" className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => setStep('email')}>
                    Change
                  </button>
                </p>

                {step === 'passkey' ? (
                  <div className="flex flex-col gap-3">
                    <Button size="lg" className="h-11 w-full text-[15px]"><KeyRound data-icon="inline-start" />Use your passkey</Button>
                    <Button variant="ghost" size="lg" className="h-11 w-full text-[15px] text-muted-foreground" onClick={() => setStep('password')}>
                      Use your password instead
                    </Button>
                  </div>
                ) : (
                  <form className="flex flex-col gap-4" onSubmit={next('wrong')} noValidate>
                    <Field data-invalid={step === 'wrong' || undefined}>
                      <div className="flex items-baseline justify-between gap-3">
                        <FieldLabel htmlFor="password">Password</FieldLabel>
                        <a href="#reset" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Forgot it?</a>
                      </div>
                      <Input id="password" type="password" autoComplete="current-password" aria-invalid={step === 'wrong' || undefined} className="h-11" autoFocus />
                      {step === 'wrong' && <FieldError>That password doesn't match. Try again, or use your passkey.</FieldError>}
                    </Field>
                    <Button type="submit" size="lg" className="h-11 w-full text-[15px]">Sign in</Button>
                  </form>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      <aside className="m-3 hidden flex-col items-center justify-center gap-8 rounded-3xl bg-muted px-12 py-16 lg:flex">
        <img src={scene} alt="" width={1200} height={800} className="illustration w-full max-w-md" />
        <div className="flex max-w-md flex-col gap-3 text-center">
          <p className="text-2xl leading-snug font-semibold tracking-tight text-balance">A home for everything worth knowing.</p>
          <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">
            Hivemind brings together what you and your AI assistants learn, keeps it useful as life and work evolve, and lets you share it with the people who matter.
          </p>
        </div>
      </aside>
    </div>
  );
}
