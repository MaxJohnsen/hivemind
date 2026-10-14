import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Recover, type Recovery } from '@/screens/recover';

export function RecoverPage() {
  const [recovery, setRecovery] = useState<Recovery>();

  useEffect(() => {
    api<{ recovery: Recovery }>('/api/sign-in-options').then((options) => setRecovery(options.recovery), () => setRecovery('operator'));
  }, []);

  if (!recovery) return null;

  return (
    <Recover
      recovery={recovery}
      send={async (email) => {
        try {
          await api('/api/auth/sign-in/magic-link', { email, callbackURL: '/account?recovered' });
        } catch (error) {
          // The page says the same whether or not the account exists.
          if (error instanceof ApiError && error.status === 429) return 'Too many tries. Wait a minute, then try again.';
        }
      }}
    />
  );
}
