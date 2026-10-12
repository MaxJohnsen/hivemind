// Knowledge (spec §3): sources, pages and items, their history, and search.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addSource,
  createPage,
  listPages,
  readItem,
  readPage,
  search,
  supersedeItem,
  updateItem,
  writeItem,
} from '../src/knowledge.ts';
import { AccessDenied } from '../src/db.ts';
import { addMember, createSpace } from '../src/spaces.ts';
import { admin, as, db, person } from './helpers.ts';

/** Ana works for Acme. Cara is her colleague there. */
async function acme() {
  const ana = await person('Ana');
  const cara = await person('Cara');
  const space = await as(ana, async (s) => {
    const space = await createSpace(s, { name: 'Acme' });
    await addMember(s, space, cara.id);
    return space;
  });
  return { ana, cara, space, claude: { ...ana, agent: 'Claude Code' } };
}

test('an agent saves knowledge on your private side, with where it came from', async () => {
  const { ana, claude, space } = await acme();

  const page = await as(claude, async (s) => {
    const email = await addSource(s, {
      spaceId: space,
      reference: 'Email from Gunnar, 3 October',
      excerpt: 'We are moving the launch to 1 March.',
    });
    const page = await createPage(s, { spaceId: space, title: 'Launch', type: 'project' });
    await writeItem(s, { pageId: page, body: 'Acme launches on 1 March', sources: [email.id] });
    return readPage(s, page);
  });

  assert.equal(page?.title, 'Launch');
  assert.equal(page?.type, 'project');
  const [item] = page?.items ?? [];
  assert.equal(item.body, 'Acme launches on 1 March');
  assert.equal(item.privateTo, ana.id);
  assert.equal(item.writtenBy, ana.id);
  assert.equal(item.agent, 'Claude Code');
  assert.deepEqual(item.sources.map((source) => source.reference), ['Email from Gunnar, 3 October']);
});

test('a private page never shows up for anyone else', async () => {
  const { claude, cara, space } = await acme();
  const page = await as(claude, async (s) => {
    const page = await createPage(s, { spaceId: space, title: 'Gunnar', type: 'person' });
    await writeItem(s, { pageId: page, body: 'Gunnar is hard to reach before ten' });
    return page;
  });

  await as(cara, async (s) => {
    assert.equal(await readPage(s, page), undefined);
    assert.equal((await listPages(s, space)).length, 0);
    assert.equal((await search(s, 'Gunnar')).length, 0);
  });
});

test('a page’s title is shown only to those who can see it', async () => {
  const { claude, cara, space } = await acme();
  const page = await as(claude, async (s) => {
    const page = await createPage(s, { spaceId: space, title: 'Gunnar, slow to answer' });
    await writeItem(s, { pageId: page, body: 'Gunnar is the project manager', shared: true });
    return page;
  });

  // Cara sees the shared item, but not the title Ana gave the page privately.
  // Hivemind hides it on its own too, without row-level security.
  for (const sql of [db, admin]) {
    const seen = await as(cara, (s) => readPage(s, page), sql);
    assert.equal(seen?.title, 'Untitled');
    const [hit] = await as(cara, (s) => search(s, 'project manager'), sql);
    assert.equal(hit.title, null);
  }
});

test('updating an item keeps what it used to say', async () => {
  const { claude } = await acme();
  const { personalSpaceId } = claude;
  const item = await as(claude, async (s) => {
    const page = await createPage(s, { spaceId: personalSpaceId, title: 'Plans' });
    const item = await writeItem(s, { pageId: page, body: 'Run the half marathon in May' });
    await updateItem(s, item.id, { body: 'Run the half marathon in June' });
    return readItem(s, item.id);
  });

  assert.equal(item?.body, 'Run the half marathon in June');
  assert.deepEqual(item?.history.map((revision) => revision.body), ['Run the half marathon in May']);
});

test('superseded knowledge leaves the page, but can still be found', async () => {
  const { claude, space } = await acme();
  const page = await as(claude, async (s) => {
    const page = await createPage(s, { spaceId: space, title: 'Launch' });
    const launch = await writeItem(s, { pageId: page, body: 'Acme launches on 1 February' });
    await supersedeItem(s, launch.id, { body: 'Acme launches on 1 March' });
    return page;
  });

  await as(claude, async (s) => {
    assert.deepEqual((await readPage(s, page))?.items.map((item) => item.body), ['Acme launches on 1 March']);
    const [old] = (await search(s, 'February')).filter((hit) => hit.kind === 'item');
    assert.equal(old.text, 'Acme launches on 1 February');
    assert.equal(old.superseded, true);
  });
});

test('agents never rewrite what people wrote', async () => {
  const { ana, claude, space } = await acme();
  const decision = await as(ana, async (s) => {
    const page = await createPage(s, { spaceId: space, title: 'Pricing' });
    return writeItem(s, { pageId: page, body: 'We never discount more than 10%' });
  });

  await assert.rejects(as(claude, (s) => updateItem(s, decision.id, { body: 'We discount up to 20%' })), AccessDenied);
  await assert.rejects(as(claude, (s) => supersedeItem(s, decision.id, { body: 'We discount up to 20%' })), AccessDenied);

  // Ana can still change it herself.
  const changed = await as(ana, (s) => updateItem(s, decision.id, { body: 'We never discount more than 15%' }));
  assert.equal(changed?.body, 'We never discount more than 15%');
});

test('knowledge without a page stays findable in its source', async () => {
  const { claude, space } = await acme();
  await as(claude, (s) =>
    addSource(s, { spaceId: space, reference: 'Meeting notes', excerpt: 'Ola will own the migration.' }),
  );

  const hits = await as(claude, (s) => search(s, 'who owns the migration'));
  assert.deepEqual(hits.map((hit) => [hit.kind, hit.text]), [['source', 'Ola will own the migration.']]);
});

test('search matches words by how they start', async () => {
  const { claude, space } = await acme();
  const { page, item } = await as(claude, async (s) => {
    const page = await createPage(s, { spaceId: space, title: 'Launch' });
    const item = await writeItem(s, { pageId: page, body: 'Acme launches on 1 March' });
    return { page, item };
  });

  const hits = await as(claude, (s) => search(s, 'launch'));
  assert.deepEqual(hits.map((hit) => [hit.kind, hit.id, hit.text]), [
    ['page', page, 'Launch'],
    ['item', item.id, 'Acme launches on 1 March'],
  ]);
});

test('searching a space includes the spaces below it, and nothing beside it', async () => {
  const { claude, space } = await acme();
  await as(claude, async (s) => {
    const website = await createSpace(s, { name: 'Website', parentId: space });
    const beta = await createSpace(s, { name: 'Beta' });
    for (const [spaceId, body] of [
      [website, 'The website launches with the new logo'],
      [beta, 'Beta launches in the autumn'],
    ]) {
      const page = await createPage(s, { spaceId, title: 'Notes' });
      await writeItem(s, { pageId: page, body });
    }
  });

  const hits = await as(claude, (s) => search(s, 'launches', { spaceId: space }));
  assert.deepEqual(hits.map((hit) => hit.text), ['The website launches with the new logo']);
});
