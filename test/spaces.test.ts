import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listItems, writeItem } from '../src/content.ts';
import { AccessDenied } from '../src/db.ts';
import { addMember, createSpace, listSpaces, removeMember } from '../src/spaces.ts';
import { admin, as, db, ids, person } from './helpers.ts';

test('membership flows down to child spaces, but not into closed ones', async () => {
  const ana = await person('Ana');
  const ben = await person('Ben');
  const spaces = await as(ana.principal, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    const website = await createSpace(s, { name: 'Website', parentId: acme });
    const board = await createSpace(s, { name: 'Board', parentId: acme, closed: true });
    await addMember(s, acme, ben.id);
    return { acme, website, board };
  });

  const visible = await as(ben.principal, listSpaces);
  assert.deepEqual(ids(visible), [ben.personalSpaceId, spaces.acme, spaces.website].sort());

  // Closing a space later removes inherited access in the same transaction.
  await admin`update spaces set closed = true where id = ${spaces.website}`;
  const afterClosing = await as(ben.principal, listSpaces);
  assert.deepEqual(ids(afterClosing), [ben.personalSpaceId, spaces.acme].sort());
});

test('a personal tree belongs only to its owner', async () => {
  const ana = await person('Ana');
  const ben = await person('Ben');
  const project = await as(ana.principal, (s) =>
    createSpace(s, { name: 'Side project', parentId: ana.personalSpaceId }),
  );

  assert.deepEqual(ids(await as(ben.principal, listSpaces)), [ben.personalSpaceId]);
  await assert.rejects(
    as(ana.principal, (s) => addMember(s, project, ben.id)),
    { code: '42501' },
  );
  await assert.rejects(
    as(ana.principal, (s) => writeItem(s, { spaceId: project, body: 'Idea', shared: true })),
    AccessDenied,
  );
  await assert.rejects(
    as(ana.principal, (s) => s.tx`insert into content (space_id, body) values (${project}, 'Idea')`),
    { code: '42501' },
  );
  const item = await as(ana.principal, (s) => writeItem(s, { spaceId: project, body: 'Idea' }));
  assert.equal(item.privateTo, ana.id);
});

test('only admins change membership, but anyone can leave', async () => {
  const ana = await person('Ana');
  const ben = await person('Ben');
  const cara = await person('Cara');
  const acme = await as(ana.principal, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    await addMember(s, acme, ben.id);
    return acme;
  });

  await assert.rejects(as(ben.principal, (s) => addMember(s, acme, cara.id)), { code: '42501' });
  await assert.rejects(as(ben.principal, (s) => removeMember(s, acme, ana.id)), { code: '42501' });
  await as(ben.principal, (s) => removeMember(s, acme, ben.id));
  assert.deepEqual(ids(await as(ben.principal, listSpaces)), [ben.personalSpaceId]);
});

test('removing a member takes effect immediately', async () => {
  const ana = await person('Ana');
  const ben = await person('Ben');
  const { acme, website } = await as(ana.principal, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    const website = await createSpace(s, { name: 'Website', parentId: acme });
    await addMember(s, acme, ben.id);
    await writeItem(s, { spaceId: acme, body: 'Launch is 1 March', shared: true });
    await writeItem(s, { spaceId: website, body: 'Use the new logo', shared: true });
    return { acme, website };
  });
  assert.equal((await as(ben.principal, (s) => listItems(s, website))).length, 1);

  await as(ana.principal, (s) => removeMember(s, acme, ben.id));

  await as(ben.principal, async (s) => {
    assert.deepEqual(ids(await listSpaces(s)), [ben.personalSpaceId]);
    assert.equal((await listItems(s, acme)).length, 0);
    assert.equal((await listItems(s, website)).length, 0);
  });
});

test('a space sees only its own shared side', async () => {
  const ana = await person('Ana');
  const { acme, website } = await as(ana.principal, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    const website = await createSpace(s, { name: 'Website', parentId: acme });
    await writeItem(s, { spaceId: acme, body: 'Launch is 1 March', shared: true });
    await writeItem(s, { spaceId: acme, body: 'Ana: budget worries' });
    await writeItem(s, { spaceId: website, body: 'Use the new logo', shared: true });
    return { acme, website };
  });

  await as({ space: acme }, async (s) => {
    assert.deepEqual(ids(await listSpaces(s)), [acme]);
    assert.deepEqual((await listItems(s, acme)).map((item) => item.body), ['Launch is 1 March']);
    assert.equal((await listItems(s, website)).length, 0);
    await assert.rejects(writeItem(s, { spaceId: acme, body: 'A note' }), AccessDenied);
  });
});

test('without a principal, nothing is visible', async () => {
  await person('Ana');
  for (const table of ['people', 'spaces', 'memberships', 'space_access', 'content']) {
    const [row] = await db`select count(*)::int as n from ${db(table)}`;
    assert.equal(row.n, 0, table);
  }
});
