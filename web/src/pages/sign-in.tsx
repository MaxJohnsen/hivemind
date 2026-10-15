import { useEffect, useState } from 'react';
import { browserSupportsWebAuthnAutofill, WebAuthnAbortService } from '@simplewebauthn/browser';
import { api, ApiError, nextPage } from '@/lib/api';
import { aborted, cancelled, signInWithPasskey } from '@/lib/passkeys';
import { SignIn, wrongPassword } from '@/screens/sign-in';

export function SignInPage() {
  const [passwords, setPasswords] = useState(true);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    api<{ passwords: boolean }>('/api/sign-in-options').then((options) => setPasswords(options.passwords), () => {});
  }, []);

  // Offers saved passkeys in the email field, and signs in when one is picked there. Homing
  // gives a passkey five minutes to answer, so the offer starts over before then, and after
  // a passkey that didn't work.
  useEffect(() => {
    let stopped = false;
    let renew: ReturnType<typeof setTimeout> | undefined;
    const offer = async () => {
      if (stopped || !(await browserSupportsWebAuthnAutofill())) return;
      clearTimeout(renew);
      renew = setTimeout(() => {
        WebAuthnAbortService.cancelCeremony();
        offer();
      }, 4 * 60 * 1000);
      try {
        signedIn(await signInWithPasskey({ autofill: true }));
      } catch (error) {
        // Stopped to ask another way, such as "Use your passkey", or to start over.
        if (aborted(error)) return;
        if (!cancelled(error)) setNotice("That passkey didn't work. Try again, or use your password.");
        setTimeout(offer, 1000);
      }
    };
    offer();
    return () => {
      stopped = true;
      clearTimeout(renew);
    };
  }, []);

  return (
    <SignIn
      notice={notice}
      passwords={passwords}
      actions={{
        async passkey() {
          try {
            signedIn(await signInWithPasskey());
          } catch (error) {
            if (cancelled(error)) return undefined;
            return "That passkey didn't work. Try again, or use your password.";
          }
        },
        async password(email, password) {
          try {
            signedIn(await api('/api/auth/sign-in/email', { email, password }));
          } catch (error) {
            if (error instanceof ApiError && error.status === 429) return 'Too many tries. Wait a minute, then try again.';
            return wrongPassword;
          }
        },
      }}
    />
  );
}

function signedIn(result: { url?: string }) {
  location.assign(result.url ?? nextPage());
}
