import { useEffect, useState } from 'react';
import { WebAuthnError } from '@simplewebauthn/browser';
import { api, ApiError } from '@/lib/api';
import { cancelled, createPasskey } from '@/lib/passkeys';
import { Join, type JoinProblem, type JoinState } from '@/screens/join';

export function JoinPage() {
  // The setup link and invites keep their token in the fragment, which never leaves the browser.
  const token = location.hash.slice(1);
  const kind = location.pathname === '/setup' ? 'setup' : 'invite';
  const [state, setState] = useState<JoinState>({ step: 'checking' });

  useEffect(() => {
    (async () => {
      if (!token) return setState({ step: 'expired', kind });
      const me = await api<{ email: string }>('/api/me').catch(() => undefined);
      if (me) return setState({ step: 'signed-in', email: me.email });
      const invite = await api<{ instanceAdmin: boolean }>('/api/invite', { token }).catch(() => undefined);
      setState(invite ? { step: 'form', kind: invite.instanceAdmin ? 'setup' : 'invite' } : { step: 'expired', kind });
    })();
  }, [token, kind]);

  return (
    <Join
      state={state}
      actions={{
        async join(name, email): Promise<JoinProblem | undefined> {
          try {
            const { ticket } = await api<{ ticket: string }>('/api/join', { token, name, email });
            await createPasskey(ticket);
            location.assign('/account?welcome');
          } catch (error) {
            if (cancelled(error)) return { message: "No passkey was made, so there's no account yet. Try again when you're ready." };
            if (error instanceof WebAuthnError) return { message: "This device couldn't make a passkey. Try another browser or device." };
            if (error instanceof ApiError && error.status === 410) setState({ step: 'expired', kind });
            if (error instanceof ApiError) return { field: error.field as JoinProblem['field'], message: error.message };
            return { message: 'Something went wrong. Try again.' };
          }
        },
        async signOut() {
          await api('/api/auth/sign-out', {});
          location.reload();
        },
      }}
    />
  );
}
