import { useEffect, useState } from 'react';
import { WebAuthnError } from '@simplewebauthn/browser';
import { api, ApiError } from '@/lib/api';
import { cancelled, createPasskey } from '@/lib/passkeys';
import { Account, signInAgainMessage, type AccountData, type AccountNotice, type InviteMade } from '@/screens/account';

export function AccountPage() {
  const [account, setAccount] = useState<AccountData>();
  // Shown once, after joining, recovering or verifying an email, and not again after a reload.
  const [notice] = useState<AccountNotice | undefined>(() => {
    const params = new URLSearchParams(location.search);
    return (['welcome', 'recovered', 'verified'] as const).find((name) => params.has(name));
  });

  const load = () =>
    api<AccountData>('/api/me').then(setAccount, (error) => {
      if (error instanceof ApiError && error.status === 401) location.assign('/sign-in?next=/account');
    });

  useEffect(() => {
    if (notice) history.replaceState(null, '', '/account');
    load();
  }, [notice]);

  if (!account) return null;

  return (
    <Account
      account={account}
      notice={notice}
      actions={{
        async disconnect(clientId) {
          try {
            await api('/api/assistants/disconnect', { clientId });
            await load();
          } catch (error) {
            return error instanceof Error ? error.message : 'Something went wrong. Try again.';
          }
        },
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
        async setPassword(password, current) {
          try {
            if (current === undefined) await api('/api/account/password', { password });
            else await api('/api/auth/change-password', { newPassword: password, currentPassword: current });
            await load();
          } catch (error) {
            if (error instanceof ApiError && ['SIGN_IN_AGAIN', 'SESSION_NOT_FRESH'].includes(error.code ?? '')) return signInAgainMessage;
            if (error instanceof ApiError && error.code === 'INVALID_PASSWORD') return "That's not your current password.";
            return error instanceof Error ? error.message : 'Something went wrong. Try again.';
          }
        },
        async verifyEmail() {
          try {
            await api('/api/auth/send-verification-email', { email: account.email, callbackURL: '/account?verified' });
          } catch (error) {
            return error instanceof Error ? error.message : 'Something went wrong. Try again.';
          }
        },
        async invite(email) {
          try {
            return await api<InviteMade>('/api/invites', { email });
          } catch (error) {
            return { problem: error instanceof Error ? error.message : 'Something went wrong. Try again.' };
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
