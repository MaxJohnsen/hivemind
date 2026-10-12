import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addMember, createSpace, listSpaces } from '../src/spaces.ts';
import { as, person } from './helpers.ts';

test('concurrent membership changes keep access consistent', async () => {
  const ana = await person('Ana');
  const acme = await as(ana.principal, (s) => createSpace(s, { name: 'Acme' }));
  const website = await as(ana.principal, (s) => createSpace(s, { name: 'Website', parentId: acme }));
  const people = await Promise.all(Array.from({ length: 20 }, (_, i) => person(`Person ${i}`)));

  const results = await Promise.allSettled(
    people.map((p, i) => as(ana.principal, (s) => addMember(s, i % 2 ? acme : website, p.id))),
  );
  assert.deepEqual(results.filter((result) => result.status === 'rejected'), []);

  for (const [i, p] of people.entries()) {
    const visible = (await as(p.principal, listSpaces)).map((space) => space.id);
    assert.ok(visible.includes(website), `person ${i} lost access to Website`);
    assert.equal(visible.includes(acme), i % 2 === 1);
  }
});
