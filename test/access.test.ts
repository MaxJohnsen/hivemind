// Spaces and access (spec §1): who can see which spaces and items.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addSource, createPage, readPage, updateItem, writeItem } from '../src/knowledge.ts';
import { AccessDenied, type Principal } from '../src/db.ts';
import { addMember, createSpace, listSpaces, removeMember } from '../src/spaces.ts';
import { admin, as, db, person, refused } from './helpers.ts';

async function spacesSeenBy(principal: Principal) {
  return (await as(principal, listSpaces)).map((space) => space.name);
}

/** The text a person sees on a page, or nothing if they can't see it. */
async function pageSeenBy(principal: Principal, pageId: string, sql = db) {
  const page = await as(principal, (s) => readPage(s, pageId), sql);
  return page?.items.map((item) => item.body) ?? [];
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
  const launch = await as(ana, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    await addMember(s, acme, cara.id);
    const launch = await createPage(s, { spaceId: acme, title: 'Launch', shared: true });
    await writeItem(s, { pageId: launch, body: 'Acme launches on 1 March', shared: true });
    await writeItem(s, { pageId: launch, body: 'Ana thinks the launch will slip' });
    return launch;
  });
  await as(cara, (s) => writeItem(s, { pageId: launch, body: 'Cara is on leave in March' }));

  assert.deepEqual(await pageSeenBy(ana, launch), ['Acme launches on 1 March', 'Ana thinks the launch will slip']);
  assert.deepEqual(await pageSeenBy(cara, launch), ['Acme launches on 1 March', 'Cara is on leave in March']);

  // Hivemind hides Ana's side on its own too, without row-level security.
  assert.deepEqual(await pageSeenBy(cara, launch, admin), ['Acme launches on 1 March', 'Cara is on leave in March']);
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
  const ideas = await as(ana, (s) => createPage(s, { spaceId: sideProject, title: 'Ideas' }));
  await assert.rejects(
    as(ana, (s) => createPage(s, { spaceId: sideProject, title: 'Plans', shared: true })),
    AccessDenied,
  );
  await assert.rejects(
    as(ana, (s) => writeItem(s, { pageId: ideas, body: 'An idea', shared: true })),
    AccessDenied,
  );
  await assert.rejects(
    as(ana, (s) => s.tx`
      insert into content (space_id, page_id, body) values (${sideProject}, ${ideas}, 'An idea')
    `),
    refused,
  );
});

test('only admins create spaces under a space or change membership, but anyone can leave', async () => {
  const ana = await person('Ana');
  const ben = await person('Ben');
  const cara = await person('Cara');
  const acme = await as(ana, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    await addMember(s, acme, ben.id);
    return acme;
  });

  // A space under Acme receives Acme's shared guidance, so only Acme's admins create one.
  await assert.rejects(as(ben, (s) => createSpace(s, { name: 'Side room', parentId: acme, closed: true })), refused);
  await assert.rejects(as(ben, (s) => addMember(s, acme, cara.id)), refused);
  await assert.rejects(as(ben, (s) => removeMember(s, acme, ana.id)), refused);

  await as(ben, (s) => removeMember(s, acme, ben.id));
  assert.deepEqual(await spacesSeenBy(ben), ['Personal']);
});

test('removing a member takes effect immediately, in child spaces too', async () => {
  const ana = await person('Ana');
  const ben = await person('Ben');
  const { acme, design } = await as(ana, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    const website = await createSpace(s, { name: 'Website', parentId: acme });
    await addMember(s, acme, ben.id);
    const design = await createPage(s, { spaceId: website, title: 'Design', shared: true });
    await writeItem(s, { pageId: design, body: 'The website uses the new logo', shared: true });
    return { acme, design };
  });
  assert.deepEqual(await pageSeenBy(ben, design), ['The website uses the new logo']);

  await as(ana, (s) => removeMember(s, acme, ben.id));

  assert.deepEqual(await spacesSeenBy(ben), ['Personal']);
  assert.deepEqual(await pageSeenBy(ben, design), []);
});

test('a space sees only its own shared side', async () => {
  const ana = await person('Ana');
  const { acme, launch, design } = await as(ana, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    const website = await createSpace(s, { name: 'Website', parentId: acme });
    const launch = await createPage(s, { spaceId: acme, title: 'Launch', shared: true });
    await writeItem(s, { pageId: launch, body: 'Acme launches on 1 March', shared: true });
    await writeItem(s, { pageId: launch, body: 'Ana thinks the launch will slip' });
    const design = await createPage(s, { spaceId: website, title: 'Design', shared: true });
    await writeItem(s, { pageId: design, body: 'The website uses the new logo', shared: true });
    return { acme, launch, design };
  });

  assert.deepEqual(await spacesSeenBy({ space: acme }), ['Acme']);
  assert.deepEqual(await pageSeenBy({ space: acme }, launch), ['Acme launches on 1 March']);
  assert.deepEqual(await pageSeenBy({ space: acme }, design), []);
  await assert.rejects(
    as({ space: acme }, (s) => writeItem(s, { pageId: launch, body: 'A private note' })),
    AccessDenied,
  );
});

test('an item never moves to another space or side', async () => {
  const ana = await person('Ana');
  const { page, launch, doubt } = await as(ana, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    const page = await createPage(s, { spaceId: acme, title: 'Launch', shared: true });
    const launch = await writeItem(s, { pageId: page, body: 'Acme launches on 1 March', shared: true });
    const doubt = await writeItem(s, { pageId: page, body: 'Ana thinks the launch will slip' });
    return { page, launch, doubt };
  });

  // Publishing creates a new shared item instead, so nothing is shared by accident.
  await assert.rejects(as(ana, (s) => s.tx`update content set private_to = null where id = ${doubt.id}`), refused);
  await assert.rejects(as(ana, (s) => s.tx`update content set private_to = ${ana.id} where id = ${launch.id}`), refused);
  await assert.rejects(
    as(ana, (s) => s.tx`update content set space_id = ${ana.personalSpaceId} where id = ${launch.id}`),
    refused,
  );
  assert.deepEqual(await pageSeenBy(ana, page), ['Acme launches on 1 March', 'Ana thinks the launch will slip']);
});

test('without a principal, nothing is visible', async () => {
  const ana = await person('Ana');
  await as(ana, async (s) => {
    const acme = await createSpace(s, { name: 'Acme' });
    const page = await createPage(s, { spaceId: acme, title: 'Launch', shared: true });
    const email = await addSource(s, { spaceId: acme, excerpt: 'We launch on 1 March.', shared: true });
    const item = await writeItem(s, { pageId: page, body: 'Acme launches in March', sources: [email.id], shared: true });
    await updateItem(s, item.id, { body: 'Acme launches on 1 March' });
  });

  const tables = ['people', 'spaces', 'memberships', 'space_access', 'pages', 'content', 'sources', 'citations', 'revisions'];
  for (const table of tables) {
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
