// After signing in, Homing goes back to the page you came from, and never to
// another site, however the address is written.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { samePage } from '../web/src/lib/api.ts';

const origin = 'https://homing.example.com';

test('after signing in, you go back to a page of Homing’s own', () => {
  assert.equal(samePage('/account', origin, '/account'), '/account');
  assert.equal(samePage('/confirm/abc?x=1#top', origin, '/account'), '/confirm/abc?x=1#top');
  assert.equal(samePage(null, origin, '/account'), '/account');
});

test('an address that leads to another site is ignored', () => {
  for (const next of ['https://evil.com', '//evil.com', '/\\evil.com', '/\t/evil.com', '/%5Cevil.com', 'javascript:alert(1)', '\\/evil.com']) {
    const page = samePage(next, origin, '/account');
    assert.equal(new URL(page, origin).origin, origin, next);
  }
});
