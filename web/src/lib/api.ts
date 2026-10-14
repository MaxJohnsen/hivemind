/** Homing refused a request, with a message that can be shown as it is. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  /** The form field the message is about, if any. */
  readonly field?: string;

  constructor(status: number, body: { message?: string; code?: string; field?: string }) {
    super(body.message ?? 'Something went wrong. Try again.');
    this.status = status;
    this.code = body.code;
    this.field = body.field;
  }
}

/** Calls the server: a GET without a body, a POST with one. */
export async function api<T = Record<string, unknown>>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, body === undefined
    ? { headers: { accept: 'application/json' } }
    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

/** Where to go after signing in: a page of Homing's own, never another site. */
export function nextPage(fallback = '/account'): string {
  const next = new URLSearchParams(location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}
