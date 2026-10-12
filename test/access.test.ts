// Spaces and access (spec §1): who can see which spaces and items.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listItems, writeItem } from '../src/content.ts';
import { AccessDenied, type Principal } from '../src/db.ts';
import { addMember, createSpace, listSpaces, removeMember } from '../src/spaces.ts';
import { admin, as, db, person, refused } from './helpers.ts';

async function spacesSeenBy(principal: Principal) {
  return (await as(principal, listSpaces)).map((space) => space.name);
}

async function itemsSeenBy(principal: Principal, spaceId: string, sql = db) {
  return (await as(principal, (s) => listItems(s, spaceId), sql)).map((item) => item.body);
}

test('membership flows down to child spaces, except into closed ones', async () => {
  const ana = await person('Ana');
  const ben = await person('Ben');
  const website = await as(ana, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    await createSpace(s, { name: 'Board', parentId: acme, closed: true });
    await addMember(s, acme, ben.id);
    return createSpace(s, { name: 'Website', parentId: acme });
  });

  assert.deepEqual(await spacesSeenBy(ben), ['Personal', 'Acme', 'Website']);

  // Access follows any change to the tree. Hivemind can't close a space yet,
  // so the admin role does it here.
  await admin`update spaces set closed = true where id = ${website}`;
  assert.deepEqual(await spacesSeenBy(ben), ['Personal', 'Acme']);
});

test('colleagues share the shared side, but not each other’s private side', async () => {
  const ana = await person('Ana');
  const cara = await person('Cara');
  const acme = await as(ana, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    await addMember(s, acme, cara.id);
    await writeItem(s, { spaceId: acme, body: 'Acme launches on 1 March', shared: true });
    await writeItem(s, { spaceId: acme, body: 'Ana thinks the launch will slip' });
    return acme;
  });
  await as(cara, (s) => writeItem(s, { spaceId: acme, body: 'Cara is on leave in March' }));

  assert.deepEqual(await itemsSeenBy(ana, acme), ['Acme launches on 1 March', 'Ana thinks the launch will slip']);
  assert.deepEqual(await itemsSeenBy(cara, acme), ['Acme launches on 1 March', 'Cara is on leave in March']);

  // Hivemind hides Ana's side on its own too, without row-level security.
  assert.deepEqual(await itemsSeenBy(cara, acme, admin), ['Acme launches on 1 March', 'Cara is on leave in March']);
});

test('your personal tree is yours alone', async () => {
  const ana = await person('Ana');
  const ben = await person('Ben');
  const sideProject = await as(ana, (s) =>
    createSpace(s, { name: 'Side project', parentId: ana.personalSpaceId }),
  );

  assert.deepEqual(await spacesSeenBy(ben), ['Personal']);
  await assert.rejects(as(ana, (s) => addMember(s, sideProject, ben.id)), refused);

  // It has no shared side, so making it collaborative later can't expose anything.
  await assert.rejects(
    as(ana, (s) => writeItem(s, { spaceId: sideProject, body: 'An idea', shared: true })),
    AccessDenied,
  );
  await assert.rejects(
    as(ana, (s) => s.tx`insert into content (space_id, body) values (${sideProject}, 'An idea')`),
    refused,
  );
});

test('only admins change membership, but anyone can leave', async () => {
  const ana = await person('Ana');
  const ben = await person('Ben');
  const cara = await person('Cara');
  const acme = await as(ana, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    await addMember(s, acme, ben.id);
    return acme;
  });

  await assert.rejects(as(ben, (s) => addMember(s, acme, cara.id)), refused);
  await assert.rejects(as(ben, (s) => removeMember(s, acme, ana.id)), refused);

  await as(ben, (s) => removeMember(s, acme, ben.id));
  assert.deepEqual(await spacesSeenBy(ben), ['Personal']);
});

test('removing a member takes effect immediately, in child spaces too', async () => {
  const ana = await person('Ana');
  const ben = await person('Ben');
  const { acme, website } = await as(ana, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    const website = await createSpace(s, { name: 'Website', parentId: acme });
    await addMember(s, acme, ben.id);
    await writeItem(s, { spaceId: website, body: 'The website uses the new logo', shared: true });
    return { acme, website };
  });
  assert.deepEqual(await itemsSeenBy(ben, website), ['The website uses the new logo']);

  await as(ana, (s) => removeMember(s, acme, ben.id));

  assert.deepEqual(await spacesSeenBy(ben), ['Personal']);
  assert.deepEqual(await itemsSeenBy(ben, website), []);
});

test('a space sees only its own shared side', async () => {
  const ana = await person('Ana');
  const { acme, website } = await as(ana, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    const website = await createSpace(s, { name: 'Website', parentId: acme });
    await writeItem(s, { spaceId: acme, body: 'Acme launches on 1 March', shared: true });
    await writeItem(s, { spaceId: acme, body: 'Ana thinks the launch will slip' });
    await writeItem(s, { spaceId: website, body: 'The website uses the new logo', shared: true });
    return { acme, website };
  });

  assert.deepEqual(await spacesSeenBy({ space: acme }), ['Acme']);
  assert.deepEqual(await itemsSeenBy({ space: acme }, acme), ['Acme launches on 1 March']);
  assert.deepEqual(await itemsSeenBy({ space: acme }, website), []);
  await assert.rejects(
    as({ space: acme }, (s) => writeItem(s, { spaceId: acme, body: 'A private note' })),
    AccessDenied,
  );
});

test('an item never moves to another space or side', async () => {
  const ana = await person('Ana');
  const { acme, launch, doubt } = await as(ana, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    const launch = await writeItem(s, { spaceId: acme, body: 'Acme launches on 1 March', shared: true });
    const doubt = await writeItem(s, { spaceId: acme, body: 'Ana thinks the launch will slip' });
    return { acme, launch, doubt };
  });

  // Publishing creates a new shared item instead, so nothing is shared by accident.
  await assert.rejects(as(ana, (s) => s.tx`update content set private_to = null where id = ${doubt.id}`), refused);
  await assert.rejects(as(ana, (s) => s.tx`update content set private_to = ${ana.id} where id = ${launch.id}`), refused);
  await assert.rejects(
    as(ana, (s) => s.tx`update content set space_id = ${ana.personalSpaceId} where id = ${launch.id}`),
    refused,
  );
  assert.deepEqual(await itemsSeenBy(ana, acme), ['Acme launches on 1 March', 'Ana thinks the launch will slip']);
});

test('without a principal, nothing is visible', async () => {
  await person('Ana');
  for (const table of ['people', 'spaces', 'memberships', 'space_access', 'content']) {
    const [{ count }] = await db`select count(*)::int from ${db(table)}`;
    assert.equal(count, 0, table);
  }
});

test('membership changes made at the same time all take effect', async () => {
  const ana = await person('Ana');
  const { acme, website } = await as(ana, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    const website = await createSpace(s, { name: 'Website', parentId: acme });
    return { acme, website };
  });
  const team = await Promise.all(Array.from({ length: 20 }, (_, i) => person(`Colleague ${i + 1}`)));

  // Half join Acme and half only its website, all at once.
  const joins = await Promise.allSettled(
    team.map((colleague, i) => as(ana, (s) => addMember(s, i % 2 ? acme : website, colleague.id))),
  );
  assert.deepEqual(joins.filter((join) => join.status === 'rejected'), []);

  const [{ count }] = await admin`
    select count(*)::int from space_access
    where space_id = ${website} and person_id in ${admin(team.map((colleague) => colleague.id))}
  `;
  assert.equal(count, team.length);
});
