// A small browser for end-to-end tests: one cookie jar, its own passkeys,
// and requests that come from Homing's own pages.

import { Authenticator } from './webauthn.ts';

export class Browser {
  readonly url: URL;
  readonly passkeys: Authenticator;
  private readonly cookies = new Map<string, string>();

  constructor(url: URL) {
    this.url = url;
    this.passkeys = new Authenticator(url.origin);
  }

  /** The browser's cookies, as it sends them. */
  cookieHeader(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('origin', this.url.origin);
    if (this.cookies.size) headers.set('cookie', this.cookieHeader());
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    const response = await fetch(new URL(path, this.url), { ...init, headers, redirect: 'manual' });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair, ...attributes] = cookie.split(';');
      const [name, value] = [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)];
      const expired = attributes.some((attribute) => /^\s*max-age=0\s*$/i.test(attribute));
      if (expired || value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return response;
  }

  /** Sends JSON and reads JSON back, with the response's status. */
  async json(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
    const response = await this.fetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : {}) as Record<string, any> };
  }

  /** Accepts an invite with a new passkey, the way the join page does. */
  async join(token: string, person: { name: string; email: string }) {
    const joined = await this.json('/api/join', { token, ...person });
    if (joined.status !== 200) return joined;
    return this.register(joined.body.ticket);
  }

  /** Creates the account a join ticket is for, with a new passkey, and signs in. */
  async register(ticket: string, credentialId?: Buffer) {
    const options = await this.json(`/api/auth/passkey/generate-register-options?context=${encodeURIComponent(ticket)}`);
    if (options.status !== 200) return options;
    return this.json('/api/auth/passkey/verify-registration', { response: this.passkeys.register(options.body, credentialId), createSession: true });
  }

  /** Adds another passkey to the signed-in account. */
  async addPasskey(authenticator = this.passkeys) {
    const options = await this.json('/api/auth/passkey/generate-register-options');
    if (options.status !== 200) return options;
    return this.json('/api/auth/passkey/verify-registration', { response: authenticator.register(options.body) });
  }

  /** Signs in with a passkey, without saying whose account it is. */
  async signIn(authenticator = this.passkeys) {
    const options = await this.json('/api/auth/passkey/generate-authenticate-options');
    return this.json('/api/auth/passkey/verify-authentication', { response: authenticator.authenticate(options.body) });
  }

  async signOut() {
    return this.json('/api/auth/sign-out', {});
  }
}
