import { useEffect, useState } from 'react';
import { WebAuthnError } from '@simplewebauthn/browser';
import { api, ApiError } from '@/lib/api';
import { cancelled, createPasskey } from '@/lib/passkeys';
import { Account, signInAgainMessage, type AccountData } from '@/screens/account';

export function AccountPage() {
  const [account, setAccount] = useState<AccountData>();
  const [welcome] = useState(() => new URLSearchParams(location.search).has('welcome'));

  const load = () =>
    api<AccountData>('/api/me').then(setAccount, (error) => {
      if (error instanceof ApiError && error.status === 401) location.assign('/sign-in?next=/account');
    });

  useEffect(() => {
    // The welcome shows once, not again after a reload.
    if (welcome) history.replaceState(null, '', '/account');
    load();
  }, [welcome]);

  if (!account) return null;

  return (
    <Account
      account={account}
      welcome={welcome}
      actions={{
        async addPasskey() {
          try {
            await createPasskey();
            await load();
          } catch (error) {
            if (cancelled(error)) return undefined;
            if (error instanceof WebAuthnError && error.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
              return 'This device already has a passkey for Homing.';
            }
            if (error instanceof ApiError && error.code === 'SIGN_IN_AGAIN') return signInAgainMessage;
            return error instanceof Error ? error.message : 'Something went wrong. Try again.';
          }
        },
        async removePasskey(id) {
          try {
            await api('/api/auth/passkey/delete-passkey', { id });
            await load();
          } catch (error) {
            return error instanceof Error ? error.message : 'Something went wrong. Try again.';
          }
        },
        async signInAgain() {
          await api('/api/auth/sign-out', {});
          location.assign('/sign-in?next=/account');
        },
        async signOut() {
          await api('/api/auth/sign-out', {});
          location.assign('/sign-in');
        },
      }}
    />
  );
}
