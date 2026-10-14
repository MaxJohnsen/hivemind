// The leak test, for guarantee 2: nothing crosses between clients.
//
// Ana works for Acme and Ben for Beta. Each has a page of knowledge on their
// client's shared side, a private note on it that cites an email and has an
// earlier version, notes in their personal space, a shared and a private
// rule for their client, and a skill. Each tries to read and
// change the other's, in three ways: through Homing, through Homing with
// row-level security off, and straight against the database with Homing's
// filters bypassed. So each layer is shown to refuse on its own.

import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { AccessDenied } from '../src/db.ts';
import { addRule, editRule, removeRule, rulesFor } from '../src/guidance.ts';
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
  type Item,
  type Source,
} from '../src/knowledge.ts';
import { saveSkill, skillsFor } from '../src/skills.ts';
import { addMember, createSpace, listSpaces, peopleNames } from '../src/spaces.ts';
import { admin, as, db, person, refused, type Person } from './helpers.ts';

interface Client {
  name: string;
  person: Person;
  space: string;
  pages: string[];
  items: Item[];
  rules: Item[];
  skill: { pageId: string; name: string };
  source: Source;
}

let acme: Client;
let beta: Client;

before(async () => {
  acme = await client('Acme', 'Ana', {
    shared: 'Acme launches on 1 March',
    draft: 'Ana thinks the launch is on track',
    private: 'Ana thinks the launch will slip',
    email: 'Gunnar says the launch date is not final',
    personal: 'Ana has a dentist appointment on Friday',
    rule: 'Never send Acme prices by email',
    privateRule: 'Ana writes Acme reports in Norwegian',
    skill: 'acme-status-report',
  });
  beta = await client('Beta', 'Ben', {
    shared: 'Beta’s budget is approved',
    draft: 'Ben expects the budget to hold',
    private: 'Ben expects budget cuts in May',
    email: 'Finance wants to revisit the budget',
    personal: 'Ben picks up the kids on Thursdays',
    rule: 'Copy Beta’s CFO on every invoice',
    privateRule: 'Ben keeps Beta updates short',
    skill: 'beta-budget-review',
  });
});

// Both directions, so neither client is special.
const attempts = () => [
  { intruder: beta, target: acme },
  { intruder: acme, target: beta },
];

for (const [layer, sql] of [
  ['through Homing', db],
  ['through Homing, with row-level security off', admin],
] as const) {
  describe(layer, () => {
    test('nobody sees another client’s spaces, pages or items', async () => {
      for (const { intruder, target } of attempts()) {
        await as(intruder.person, async (s) => {
          const spaces = await listSpaces(s);
          assert.ok(!spaces.some((space) => space.id === target.space));
          for (const space of [target.space, target.person.personalSpaceId]) {
            assert.equal((await listPages(s, space)).length, 0);
          }
          for (const page of target.pages) assert.equal(await readPage(s, page), undefined);
          for (const item of target.items) assert.equal(await readItem(s, item.id), undefined);
          assert.equal((await peopleNames(s, [target.person.id])).size, 0);
        }, sql);
      }
    });

    test('nobody finds another client’s knowledge in search', async () => {
      for (const { intruder, target } of attempts()) {
        const own = [intruder.space, intruder.person.personalSpaceId];
        for (const text of [...bodies(target.items), target.source.excerpt]) {
          const hits = await as(intruder.person, (s) => search(s, text), sql);
          assert.deepEqual(hits.filter((hit) => !own.includes(hit.spaceId)), []);
        }
      }
    });

    test('nobody writes to another client’s space', async () => {
      for (const { intruder, target } of attempts()) {
        const me = intruder.person;
        const [page] = target.pages;
        for (const shared of [true, false]) {
          await assert.rejects(as(me, (s) => writeItem(s, { pageId: page, body: 'Hello', shared }), sql), AccessDenied);
          await assert.rejects(as(me, (s) => createPage(s, { spaceId: target.space, title: 'Hello', shared }), sql), AccessDenied);
          await assert.rejects(as(me, (s) => addSource(s, { spaceId: target.space, excerpt: 'Hello', shared }), sql), AccessDenied);
        }
        // Not even by citing the other client's source in their own notes.
        await assert.rejects(
          as(me, (s) => writeItem(s, { pageId: intruder.pages[0], body: 'Hello', sources: [target.source.id] }), sql),
          AccessDenied,
        );
      }
    });

    test('nobody changes another client’s items', async () => {
      for (const { intruder, target } of attempts()) {
        for (const item of target.items) {
          assert.equal(await as(intruder.person, (s) => updateItem(s, item.id, { body: 'Changed' }), sql), undefined);
          assert.equal(await as(intruder.person, (s) => supersedeItem(s, item.id, { body: 'Changed' }), sql), undefined);
        }
      }
      await assertUntouched();
    });

    test('nobody gives themselves access to another client', async () => {
      for (const { intruder, target } of attempts()) {
        const me = intruder.person;
        await assert.rejects(as(me, (s) => addMember(s, target.space, me.id), sql), refused);
        await assert.rejects(as(me, (s) => createSpace(s, { name: 'Way in', parentId: target.space }), sql), refused);
      }
    });

    test('nobody sees or follows another client’s guidance', async () => {
      for (const { intruder, target } of attempts()) {
        await as(intruder.person, async (s) => {
          assert.deepEqual(bodies(await rulesFor(s, target.space)), []);
          assert.deepEqual(bodies(await rulesFor(s, intruder.space)), bodies(intruder.rules));
          assert.equal((await skillsFor(s, target.space)).length, 0);
          assert.deepEqual((await skillsFor(s, intruder.space)).map((skill) => skill.pageId), [intruder.skill.pageId]);
          assert.equal(await readPage(s, target.skill.pageId), undefined);
          const found = await search(s, target.skill.name.replaceAll('-', ' '));
          assert.ok(found.every((hit) => hit.spaceId === intruder.space || hit.spaceId === intruder.person.personalSpaceId));
          for (const rule of target.rules) {
            assert.equal(await readItem(s, rule.id), undefined);
            const hits = await search(s, rule.body);
            assert.ok(hits.every((hit) => hit.spaceId === intruder.space || hit.spaceId === intruder.person.personalSpaceId));
          }
        }, sql);
      }
    });

    test('nobody changes another client’s guidance', async () => {
      for (const { intruder, target } of attempts()) {
        const me = { ...intruder.person, direct: true as const };
        const rule = { spaceId: target.space, kind: 'requirement', body: 'Hello' } as const;
        for (const shared of [true, false]) {
          await assert.rejects(as(me, (s) => addRule(s, { ...rule, shared }), sql), AccessDenied);
        }
        for (const { id } of target.rules) {
          assert.equal(await as(me, (s) => editRule(s, id, 'Changed'), sql), undefined);
          assert.equal(await as(me, (s) => removeRule(s, id), sql), false);
        }
        const skill = [{ path: 'SKILL.md', body: '---\nname: hello\ndescription: Hello\n---\n' }];
        await assert.rejects(as(me, (s) => saveSkill(s, { spaceId: target.space, files: skill, shared: true }), sql), AccessDenied);
      }
      await assertUntouched();
    });
  });
}

describe('straight against the database', () => {
  test('each person reads only their own client’s rows', async () => {
    for (const { name, person, items, rules: ownRules, skill, source } of [acme, beta]) {
      await as(person, async (s) => {
        const texts = await s.tx`select body from content where kind = 'text' order by created_at`;
        const rules = await s.tx`select body from content where kind in ('requirement', 'preference') order by created_at`;
        const titles = await s.tx`select body from content where kind = 'title' order by created_at`;
        const sources = await s.tx`select excerpt from sources`;
        const history = await s.tx`select body from revisions`;
        const citations = await s.tx`select source_id from citations`;
        const pages = await s.tx`select id from pages`;
        const spaces = await s.tx`select name from spaces order by created_at`;
        const people = await s.tx`select name from people`;
        const members = await s.tx`select distinct person_id from memberships`;
        const access = await s.tx`select distinct person_id from space_access`;

        assert.deepEqual(texts.map((row) => row.body), bodies(items));
        assert.deepEqual(rules.map((row) => row.body), bodies(ownRules));
        assert.deepEqual(titles.map((row) => row.body), [`${name} plans`, 'Notes', skill.name]);
        assert.deepEqual(sources.map((row) => row.excerpt), [source.excerpt]);
        assert.equal(history.length, 1);
        assert.deepEqual(citations.map((row) => row.sourceId), [source.id]);
        assert.equal(pages.length, 4);
        assert.deepEqual(spaces.map((row) => row.name), ['Personal', name]);
        assert.deepEqual(people.map((row) => row.name), [person.name]);
        assert.deepEqual(members.map((row) => row.personId), [person.id]);
        assert.deepEqual(access.map((row) => row.personId), [person.id]);
      });
    }
  });

  test('nobody writes to another client’s space', async () => {
    for (const { intruder, target } of attempts()) {
      const me = intruder.person;
      const [page] = target.pages;
      const insert = (privateTo: string | null) =>
        as(me, (s) => s.tx`
          insert into content (space_id, page_id, private_to, body)
          values (${target.space}, ${page}, ${privateTo}, 'Hello')
        `);
      await assert.rejects(insert(null), refused); // the shared side
      await assert.rejects(insert(me.id), refused); // a private side of their own
      await assert.rejects(insert(target.person.id), refused); // the other person's private side

      await assert.rejects(as(me, (s) => s.tx`
        insert into sources (space_id, private_to, excerpt) values (${target.space}, ${me.id}, 'Hello')
      `), refused);
      await assert.rejects(as(me, (s) => s.tx`
        insert into pages (space_id) values (${target.space})
      `), refused);
      await assert.rejects(as(me, (s) => s.tx`
        insert into citations (content_id, source_id) values (${intruder.items[1].id}, ${target.source.id})
      `), refused);

      // Nor a rule on the other client's guidance page, editing directly.
      await assert.rejects(as(me, (s) => s.tx`select guidance_page(${target.space})`), refused);
      const [rule] = target.rules;
      await assert.rejects(as({ ...me, direct: true }, (s) => s.tx`
        insert into content (space_id, page_id, kind, body, reaches_down)
        values (${target.space}, ${rule.pageId}, 'requirement', 'Hello', true)
      `), refused);
    }
  });

  test('nobody changes or deletes another client’s items', async () => {
    for (const { intruder, target } of attempts()) {
      const ids = [...target.items, ...target.rules].map((item) => item.id);
      const changed = await as(intruder.person, (s) => s.tx`
        update content set body = 'Changed' where id in ${s.tx(ids)} returning id
      `);
      assert.equal(changed.length, 0);
      await assert.rejects(as(intruder.person, (s) => s.tx`delete from content where id in ${s.tx(ids)}`), refused);
    }
    await assertUntouched();
  });

  test('nobody gives themselves access to another client', async () => {
    for (const { intruder, target } of attempts()) {
      const me = intruder.person;
      await assert.rejects(as(me, (s) => s.tx`
        insert into memberships (space_id, person_id, role) values (${target.space}, ${me.id}, 'admin')
      `), refused);
      await assert.rejects(as(me, (s) => s.tx`
        insert into space_access (space_id, person_id, admin) values (${target.space}, ${me.id}, true)
      `), refused);
      await assert.rejects(as(me, (s) => s.tx`
        update spaces set parent_id = ${intruder.space} where id = ${target.space}
      `), refused);
    }
  });

  test('nobody can put their own table in place of Homing’s', async () => {
    await assert.rejects(
      as(acme.person, (s) => s.tx`create temp table space_access (person_id uuid, space_id uuid, admin boolean)`),
      refused,
    );
  });

  test('Homing’s role is restricted, and every table it can read is protected', async () => {
    const [role] = await db`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`;
    assert.deepEqual(role, { rolsuper: false, rolbypassrls: false });

    const unprotected = await db`
      select relname from pg_class
      where relkind = 'r'
        and relnamespace = 'public'::regnamespace
        and has_table_privilege(current_user, oid, 'select')
        and not relrowsecurity
    `;
    assert.deepEqual(unprotected.map((row) => row.relname), []);
  });
});

async function client(
  name: string,
  personName: string,
  notes: {
    shared: string;
    draft: string;
    private: string;
    email: string;
    personal: string;
    rule: string;
    privateRule: string;
    skill: string;
  },
): Promise<Client> {
  const p = await person(personName);
  return as({ ...p, direct: true }, async (s) => {
    const space = await createSpace(s, { name });
    const page = await createPage(s, { spaceId: space, title: `${name} plans`, shared: true });
    const source = await addSource(s, { spaceId: space, reference: 'An email', excerpt: notes.email });
    const shared = await writeItem(s, { pageId: page, body: notes.shared, shared: true });
    const draft = await writeItem(s, { pageId: page, body: notes.draft, sources: [source.id] });
    const changed = await updateItem(s, draft.id, { body: notes.private });
    const personalPage = await createPage(s, { spaceId: p.personalSpaceId, title: 'Notes' });
    const personal = await writeItem(s, { pageId: personalPage, body: notes.personal });
    const rules = [
      await addRule(s, { spaceId: space, kind: 'requirement', body: notes.rule, shared: true }),
      await addRule(s, { spaceId: space, kind: 'preference', body: notes.privateRule }),
    ];
    const skillMd = `---\nname: ${notes.skill}\ndescription: How ${name} wants it done\n---\n\nSteps for ${notes.skill.replaceAll('-', ' ')}\n`;
    const skill = await saveSkill(s, { spaceId: space, files: [{ path: 'SKILL.md', body: skillMd }], shared: true });
    return {
      name,
      person: p,
      space,
      pages: [page, personalPage],
      items: [shared, changed!, personal],
      rules,
      skill: { pageId: skill.pageId, name: skill.name },
      source,
    };
  });
}

/** Every item and rule still says what its owner wrote, and nothing was removed. */
async function assertUntouched() {
  for (const { items, rules } of [acme, beta]) {
    const ids = [...items, ...rules].map((item) => item.id);
    const stored = await admin`
      select body from content
      where id in ${admin(ids)}
        and not exists (select from content removal where removal.supersedes = content.id)
      order by created_at
    `;
    assert.deepEqual(stored.map((row) => row.body), bodies([...items, ...rules]));
  }
}

function bodies(items: readonly { body: string }[]) {
  return items.map((item) => item.body);
}
