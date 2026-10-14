import { useEffect, useState } from 'react';
import { browserSupportsWebAuthnAutofill } from '@simplewebauthn/browser';
import { api, ApiError, nextPage } from '@/lib/api';
import { cancelled, signInWithPasskey } from '@/lib/passkeys';
import { SignIn, wrongPassword } from '@/screens/sign-in';

export function SignInPage() {
  const [passwords, setPasswords] = useState(true);

  useEffect(() => {
    api<{ passwords: boolean }>('/api/sign-in-options').then((options) => setPasswords(options.passwords), () => {});
    // Offers saved passkeys in the email field, and signs in when one is picked there.
    browserSupportsWebAuthnAutofill().then((supported) => {
      if (supported) signInWithPasskey({ autofill: true }).then(signedIn, () => {});
    });
  }, []);

  return (
    <SignIn
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
