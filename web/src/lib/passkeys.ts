import { startAuthentication, startRegistration, WebAuthnError } from '@simplewebauthn/browser';
import { api } from '@/lib/api';

/** Signs in with any passkey saved for Homing. With autofill, it waits for one picked in the email field. */
export async function signInWithPasskey(options: { autofill?: boolean } = {}) {
  const optionsJSON = await api<Parameters<typeof startAuthentication>[0]['optionsJSON']>('/api/auth/passkey/generate-authenticate-options');
  const response = await startAuthentication({ optionsJSON, useBrowserAutofill: options.autofill });
  return api<{ url?: string }>('/api/auth/passkey/verify-authentication', { response });
}

/**
 * Creates a passkey: for the account a join ticket creates, which also signs
 * in, or for the account already signed in.
 */
export async function createPasskey(ticket?: string) {
  const query = new URLSearchParams({ name: deviceName() });
  if (ticket) query.set('context', ticket);
  const optionsJSON = await api<Parameters<typeof startRegistration>[0]['optionsJSON']>(`/api/auth/passkey/generate-register-options?${query}`);
  const response = await startRegistration({ optionsJSON });
  return api('/api/auth/passkey/verify-registration', { response, name: deviceName(), createSession: Boolean(ticket) });
}

/** Whether the person closed the passkey dialog, which needs no error message. */
export function cancelled(error: unknown): boolean {
  if (error instanceof WebAuthnError) return error.code === 'ERROR_CEREMONY_ABORTED' || error.name === 'NotAllowedError';
  return error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError');
}

/** A passkey's name says where it was made, such as "Mac", so people can tell them apart. */
function deviceName(): string {
  const agent = navigator.userAgent;
  const known: [RegExp, string][] = [
    [/iPhone/, 'iPhone'],
    [/iPad/, 'iPad'],
    [/Android/, 'Android'],
    [/CrOS/, 'Chromebook'],
    [/Mac OS X|Macintosh/, 'Mac'],
    [/Windows/, 'Windows'],
    [/Linux/, 'Linux'],
  ];
  return known.find(([pattern]) => pattern.test(agent))?.[1] ?? 'This device';
}
