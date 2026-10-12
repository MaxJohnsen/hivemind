// Guidance (spec §2): rules reach down the tree, come in order from least to
// most specific, and only people change them.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Principal } from '../src/db.ts';
import { addRule, editRule, removeRule, rulesFor } from '../src/guidance.ts';
import { createPage, readItem, search, supersedeItem, writeItem } from '../src/knowledge.ts';
import { addMember, createSpace } from '../src/spaces.ts';
import { admin, as, db, person, refused, type Person } from './helpers.ts';

/**
 * Ana runs Acme with her colleague Cara. Gunnar, from the client, is in a
 * closed workshop below it, and can't open Acme itself.
 */
async function acme() {
  const ana = await person('Ana');
  const cara = await person('Cara');
  const gunnar = await person('Gunnar');
  const { space, workshop } = await as(ana, async (s) => {
    const space = await createSpace(s, { name: 'Acme' });
    await addMember(s, space, cara.id);
    const workshop = await createSpace(s, { name: 'Workshop', parentId: space, closed: true });
    await addMember(s, workshop, gunnar.id);
    return { space, workshop };
  });
  return { ana, cara, gunnar, space, workshop };
}

/** A person editing directly, as in the web app or the command line. */
const direct = (someone: Person) => ({ ...someone, direct: true as const });

async function rulesSeenBy(principal: Principal, spaceId: string, sql = db) {
  return (await as(principal, (s) => rulesFor(s, spaceId), sql)).map((rule) => rule.body);
}

test('a rule reaches the spaces below, even for someone who can’t open the parent', async () => {
  const { ana, gunnar, space, workshop } = await acme();
  await as(direct(ana), async (s) => {
    await addRule(s, { spaceId: space, kind: 'requirement', body: 'Never send prices by email', shared: true });
    const pricing = await createPage(s, { spaceId: space, title: 'Pricing', shared: true });
    await writeItem(s, { pageId: pricing, body: 'Acme pays 1,200 an hour', shared: true });
  });

  // Gunnar gets the rule, without the name of the space it comes from, and
  // none of Acme's knowledge. Hivemind keeps to that without row-level security too.
  for (const sql of [db, admin]) {
    const rules = await as(gunnar, (s) => rulesFor(s, workshop), sql);
    assert.deepEqual(rules.map((rule) => [rule.kind, rule.spaceName, rule.body]), [
      ['requirement', null, 'Never send prices by email'],
    ]);
    assert.equal((await as(gunnar, (s) => search(s, 'Pricing hour'), sql)).length, 0);
  }

  // Straight against the database, the rule is all he can read.
  const rows = await as(gunnar, (s) => s.tx`select body from content`);
  assert.deepEqual(rows.map((row) => row.body), ['Never send prices by email']);

  // And nobody outside the workshop can trace where it sits.
  const ben = await person('Ben');
  assert.equal((await as(ben, (s) => s.tx`select from spaces_above(${workshop})`)).length, 0);
});

test('knowledge never reaches down, even straight against the database', async () => {
  const { ana, space } = await acme();
  const pricing = await as(ana, (s) => createPage(s, { spaceId: space, title: 'Pricing', shared: true }));
  await assert.rejects(
    as(direct(ana), (s) => s.tx`
      insert into content (space_id, page_id, body, reaches_down)
      values (${space}, ${pricing}, 'Acme pays 1,200 an hour', true)
    `),
    refused,
  );
});

test('rules marked only here, and other people’s private rules, stay where they are', async () => {
  const { ana, cara, gunnar, space, workshop } = await acme();
  await as(direct(ana), async (s) => {
    await addRule(s, { spaceId: space, kind: 'preference', body: 'Log hours every Friday', shared: true, onlyHere: true });
    await addRule(s, { spaceId: space, kind: 'preference', body: 'Ana drafts in Norwegian first' });
  });

  for (const sql of [db, admin]) {
    assert.deepEqual(await rulesSeenBy(gunnar, workshop, sql), []);
    assert.deepEqual(await rulesSeenBy(cara, space, sql), ['Log hours every Friday']);
    // Private guidance reaches down for its owner.
    assert.deepEqual(await rulesSeenBy(ana, workshop, sql), ['Ana drafts in Norwegian first']);
  }
  assert.equal((await as(gunnar, (s) => s.tx`select from content`)).length, 0);
});

test('the rules that apply come from least to most specific', async () => {
  const { ana, space } = await acme();
  const website = await as(ana, (s) => createSpace(s, { name: 'Website', parentId: space }));
  // Added out of order, so the order comes from the tree and not from when.
  await as(direct(ana), async (s) => {
    await addRule(s, { spaceId: website, kind: 'preference', body: 'Ana writes reports in a dry tone' });
    await addRule(s, { spaceId: website, kind: 'preference', body: 'Write reports in Norwegian', shared: true });
    await addRule(s, { spaceId: space, kind: 'requirement', body: 'Never send prices by email', shared: true });
    await addRule(s, { spaceId: space, kind: 'preference', body: 'Write reports in English', shared: true });
    await addRule(s, { spaceId: ana.personalSpaceId, kind: 'preference', body: 'Keep answers short' });
  });

  const rules = await as(ana, (s) => rulesFor(s, website));
  assert.deepEqual(rules.map((rule) => [rule.personal, rule.spaceName, rule.kind, rule.body]), [
    [true, 'Personal', 'preference', 'Keep answers short'],
    [false, 'Acme', 'requirement', 'Never send prices by email'],
    [false, 'Acme', 'preference', 'Write reports in English'],
    [false, 'Website', 'preference', 'Write reports in Norwegian'],
    [false, 'Website', 'preference', 'Ana writes reports in a dry tone'],
  ]);
});

test('only people change guidance, and shared rules only the space’s admins', async () => {
  const { ana, cara, gunnar, space } = await acme();
  const english = { spaceId: space, kind: 'preference', body: 'Write reports in English', shared: true } as const;
  // Ana's agent, even one marked as editing directly, and Ana herself when
  // she isn't editing directly, such as a routine acting for her.
  const notAna = [{ ...ana, agent: 'Claude Code' }, { ...direct(ana), agent: 'Claude Code' }, ana];

  for (const someone of notAna) await assert.rejects(as(someone, (s) => addRule(s, english)), refused);
  // Cara is a member: she can keep rules for herself, but not change the shared ones.
  await assert.rejects(as(direct(cara), (s) => addRule(s, english)), refused);
  await as(direct(cara), (s) => addRule(s, { ...english, body: 'Cara writes in Norwegian', shared: false }));

  const rule = await as(direct(ana), (s) => addRule(s, english));
  for (const someone of [...notAna, direct(cara)]) {
    await assert.rejects(as(someone, (s) => editRule(s, rule.id, 'Write reports in French')), refused);
    await assert.rejects(as(someone, (s) => removeRule(s, rule.id)), refused);
  }
  // Gunnar receives the rule in the workshop, but changes happen in Acme.
  assert.equal(await as(direct(gunnar), (s) => editRule(s, rule.id, 'Write reports in French')), undefined);
  assert.equal(await as(direct(gunnar), (s) => removeRule(s, rule.id)), false);
  assert.deepEqual(await rulesSeenBy(cara, space), ['Write reports in English', 'Cara writes in Norwegian']);
});

test('removing a rule takes it away everywhere it reached, and keeps its history', async () => {
  const { ana, gunnar, space, workshop } = await acme();
  const rule = await as(direct(ana), (s) =>
    addRule(s, { spaceId: space, kind: 'requirement', body: 'Never send prices by email', shared: true }),
  );
  await as(direct(ana), (s) => editRule(s, rule.id, 'Never send prices by email or chat'));
  await as(direct(ana), (s) => removeRule(s, rule.id));

  for (const sql of [db, admin]) {
    assert.deepEqual(await rulesSeenBy(ana, space, sql), []);
    assert.deepEqual(await rulesSeenBy(gunnar, workshop, sql), []);
  }
  const removed = await as(ana, (s) => readItem(s, rule.id));
  assert.equal(removed?.body, 'Never send prices by email or chat');
  assert.deepEqual(removed?.history.map((revision) => revision.body), ['Never send prices by email']);

  // The history stays with Acme. Gunnar never sees earlier versions.
  for (const sql of [db, admin]) {
    assert.equal((await as(gunnar, (s) => readItem(s, rule.id), sql))?.history.length, 0);
  }
});

test('a shared rule can’t be removed or replaced for just one person', async () => {
  const { ana, cara, space } = await acme();
  const rule = await as(direct(ana), (s) =>
    addRule(s, { spaceId: space, kind: 'requirement', body: 'Never send prices by email', shared: true }),
  );

  for (const someone of [ana, cara]) {
    await assert.rejects(
      as(direct(someone), (s) => s.tx`
        insert into content (space_id, page_id, private_to, kind, body, supersedes, reaches_down)
        values (${space}, ${rule.pageId}, ${someone.id}, 'removed', '', ${rule.id}, true)
      `),
      refused,
    );
    await assert.rejects(as(direct(someone), (s) => supersedeItem(s, rule.id, { body: 'Prices may go by email' })), refused);
  }
  assert.deepEqual(await rulesSeenBy(cara, space), ['Never send prices by email']);
});
