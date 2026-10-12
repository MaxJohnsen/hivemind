// The leak test, for guarantee 2: nothing crosses between clients.
//
// Ana works for Acme and Ben for Beta. Each has knowledge on their client's
// shared side, private notes there, and notes in their personal space. Each
// tries to read and change the other's, in three ways: through Hivemind,
// through Hivemind with row-level security off, and straight against the
// database with Hivemind's filters bypassed. So each layer is shown to
// refuse on its own.

import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { listItems, readItem, updateItem, writeItem, type Item } from '../src/content.ts';
import { AccessDenied } from '../src/db.ts';
import { addMember, createSpace, listSpaces } from '../src/spaces.ts';
import { admin, as, db, person, refused, type Person } from './helpers.ts';

interface Client {
  name: string;
  person: Person;
  space: string;
  items: Item[];
}

let acme: Client;
let beta: Client;

before(async () => {
  acme = await client('Acme', 'Ana', {
    shared: 'Acme launches on 1 March',
    private: 'Ana thinks the launch will slip',
    personal: 'Ana has a dentist appointment on Friday',
  });
  beta = await client('Beta', 'Ben', {
    shared: 'Beta’s budget is approved',
    private: 'Ben expects budget cuts in May',
    personal: 'Ben picks up the kids on Thursdays',
  });
});

// Both directions, so neither client is special.
const attempts = () => [
  { intruder: beta, target: acme },
  { intruder: acme, target: beta },
];

for (const [layer, sql] of [
  ['through Hivemind', db],
  ['through Hivemind, with row-level security off', admin],
] as const) {
  describe(layer, () => {
    test('nobody sees another client’s spaces or items', async () => {
      for (const { intruder, target } of attempts()) {
        await as(intruder.person, async (s) => {
          const spaces = await listSpaces(s);
          assert.ok(!spaces.some((space) => space.id === target.space));
          assert.deepEqual(bodies(await listItems(s, target.space)), []);
          assert.deepEqual(bodies(await listItems(s, target.person.personalSpaceId)), []);
          for (const item of target.items) assert.equal(await readItem(s, item.id), undefined);
        }, sql);
      }
    });

    test('nobody writes to another client’s space', async () => {
      for (const { intruder, target } of attempts()) {
        const write = (shared: boolean) =>
          as(intruder.person, (s) => writeItem(s, { spaceId: target.space, body: 'Hello', shared }), sql);
        await assert.rejects(write(true), AccessDenied);
        await assert.rejects(write(false), AccessDenied);
      }
    });

    test('nobody changes another client’s items', async () => {
      for (const { intruder, target } of attempts()) {
        for (const item of target.items) {
          assert.equal(await as(intruder.person, (s) => updateItem(s, item.id, 'Changed'), sql), undefined);
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
  });
}

describe('straight against the database', () => {
  test('each person reads only their own client’s rows', async () => {
    for (const { name, person, items } of [acme, beta]) {
      await as(person, async (s) => {
        const content = await s.tx`select body from content order by created_at`;
        const spaces = await s.tx`select name from spaces order by created_at`;
        const people = await s.tx`select name from people`;
        const members = await s.tx`select distinct person_id from memberships`;
        const access = await s.tx`select distinct person_id from space_access`;

        assert.deepEqual(content.map((row) => row.body), bodies(items));
        assert.deepEqual(spaces.map((row) => row.name), ['Personal', name]);
        assert.deepEqual(people.map((row) => row.name), [person.name]);
        assert.deepEqual(members.map((row) => row.personId), [person.id]);
        assert.deepEqual(access.map((row) => row.personId), [person.id]);
      });
    }
  });

  test('nobody writes to another client’s space', async () => {
    for (const { intruder, target } of attempts()) {
      const insert = (privateTo: string | null) =>
        as(intruder.person, (s) => s.tx`
          insert into content (space_id, private_to, body) values (${target.space}, ${privateTo}, 'Hello')
        `);
      await assert.rejects(insert(null), refused); // the shared side
      await assert.rejects(insert(intruder.person.id), refused); // a private side of their own
      await assert.rejects(insert(target.person.id), refused); // the other person's private side
    }
  });

  test('nobody changes or deletes another client’s items', async () => {
    for (const { intruder, target } of attempts()) {
      const ids = target.items.map((item) => item.id);
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

  test('nobody can put their own table in place of Hivemind’s', async () => {
    await assert.rejects(
      as(acme.person, (s) => s.tx`create temp table space_access (person_id uuid, space_id uuid, admin boolean)`),
      refused,
    );
  });

  test('Hivemind’s role is restricted, and every table it can read is protected', async () => {
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
  notes: { shared: string; private: string; personal: string },
): Promise<Client> {
  const p = await person(personName);
  return as(p, async (s) => {
    const space = await createSpace(s, { name });
    const items = [
      await writeItem(s, { spaceId: space, body: notes.shared, shared: true }),
      await writeItem(s, { spaceId: space, body: notes.private }),
      await writeItem(s, { spaceId: p.personalSpaceId, body: notes.personal }),
    ];
    return { name, person: p, space, items };
  });
}

/** Every item still says what its owner wrote. */
async function assertUntouched() {
  for (const { items } of [acme, beta]) {
    const stored = await admin`
      select body from content where id in ${admin(items.map((item) => item.id))} order by created_at
    `;
    assert.deepEqual(stored.map((row) => row.body), bodies(items));
  }
}

function bodies(items: readonly { body: string }[]) {
  return items.map((item) => item.body);
}
