import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Wordmark } from '@/components/wordmark';
import welcome from '@/assets/welcome.jpg';

/** Signing in, on its own or on the way to connecting an assistant. */
export function SignIn({ connecting, initial = 'choose' }: { connecting?: string; initial?: 'choose' | 'email' | 'wrong' }) {
  const [step, setStep] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setStep('wrong');
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <Wordmark className="self-center text-lg" />
      <img src={welcome} alt="" width={1000} height={667} className="illustration mx-auto w-full max-w-72" />

      <div className="flex flex-col gap-5 rounded-xl border bg-card p-6 sm:p-7">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          {connecting && <p className="text-sm text-muted-foreground">Then you can let {connecting} use Hivemind as you.</p>}
        </div>

        <Button size="lg" className="h-11 w-full text-[15px]">
          <KeyRound data-icon="inline-start" />
          Continue with a passkey
        </Button>

        {step === 'choose' ? (
          <Button variant="outline" size="lg" className="h-11 w-full text-[15px]" onClick={() => setStep('email')}>
            Use email and password
          </Button>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" autoComplete="username webauthn" defaultValue={step === 'wrong' ? 'ana@acme.no' : ''} className="h-11" />
            </Field>
            <Field data-invalid={step === 'wrong' || undefined}>
              <div className="flex items-baseline justify-between gap-3">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <a href="#reset" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Forgot it?</a>
              </div>
              <Input id="password" type="password" autoComplete="current-password" aria-invalid={step === 'wrong' || undefined} className="h-11" />
              {step === 'wrong' && <FieldError>That email and password don't match. Try again, or use a passkey.</FieldError>}
            </Field>
            <Button type="submit" variant="outline" size="lg" className="h-11 w-full text-[15px]">Sign in</Button>
          </form>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-10">Google</Button>
          <Button variant="outline" className="h-10">Microsoft</Button>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">New here? You join through an invite from someone who uses Hivemind.</p>
    </main>
  );
}
