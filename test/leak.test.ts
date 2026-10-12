// The leak test (guarantee 2). Two people in different client spaces, each
// with shared and private items, try to read and write across clients. It
// runs through Hivemind, and directly against the database with Hivemind's
// filters bypassed, so the database is shown to refuse on its own. Hivemind's
// checks are also run with row-level security off, so they are shown to
// refuse on their own too.

import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { listItems, readItem, updateItem, writeItem, type Item } from '../src/content.ts';
import { AccessDenied, withPrincipal, type Principal, type Session } from '../src/db.ts';
import { addMember, createSpace, listSpaces } from '../src/spaces.ts';
import { admin, as, db, ids, person } from './helpers.ts';

type Person = Awaited<ReturnType<typeof person>>;

interface Client {
  person: Person;
  space: string;
  items: Item[];
  /** Everyone in the client's space. */
  people: string[];
}

type Statement = (s: Session) => Promise<unknown>;

let acme: Client;
let beta: Client;
let cara: Person;

async function client(name: string, spaceName: string): Promise<Client> {
  const p = await person(name);
  return as(p.principal, async (s) => {
    const space = await createSpace(s, { name: spaceName });
    const items = [
      await writeItem(s, { spaceId: space, body: `${spaceName} launch date`, shared: true }),
      await writeItem(s, { spaceId: space, body: `${name}'s private note on ${spaceName}` }),
      await writeItem(s, { spaceId: p.personalSpaceId, body: `${name}'s dentist appointment` }),
    ];
    return { person: p, space, items, people: [p.id] };
  });
}

before(async () => {
  acme = await client('Ana', 'Acme');
  beta = await client('Ben', 'Beta');
  // Cara works with Ana in Acme, and has a private side there too.
  cara = await person('Cara');
  await as(acme.person.principal, (s) => addMember(s, acme.space, cara.id));
  await as(cara.principal, (s) => writeItem(s, { spaceId: acme.space, body: "Cara's private note" }));
  acme.people.push(cara.id);
});

const pairs = () => [
  { intruder: acme, target: beta },
  { intruder: beta, target: acme },
];

// The admin role isn't subject to row-level security.
const layers = [
  { name: 'through Hivemind', sql: db },
  { name: 'through Hivemind, with row-level security off', sql: admin },
];

for (const layer of layers) {
  const run = <T>(principal: Principal, fn: (s: Session) => Promise<T>) =>
    withPrincipal(layer.sql, principal, fn);

  describe(layer.name, () => {
    test('nobody can read another client', async () => {
      for (const { intruder, target } of pairs()) {
        await run(intruder.person.principal, async (s) => {
          assert.ok(!ids(await listSpaces(s)).includes(target.space));
          assert.equal((await listItems(s, target.space)).length, 0);
          assert.equal((await listItems(s, target.person.personalSpaceId)).length, 0);
          for (const item of target.items) assert.equal(await readItem(s, item.id), undefined);
        });
      }
    });

    test('nobody can write to another client', async () => {
      for (const { intruder, target } of pairs()) {
        const principal = intruder.person.principal;
        for (const shared of [true, false]) {
          await assert.rejects(
            run(principal, (s) => writeItem(s, { spaceId: target.space, body: 'x', shared })),
            AccessDenied,
          );
        }
        await assert.rejects(run(principal, (s) => createSpace(s, { name: 'x', parentId: target.space })), {
          code: '42501',
        });
        await assert.rejects(run(principal, (s) => addMember(s, target.space, intruder.person.id)), {
          code: '42501',
        });
        for (const item of target.items) {
          assert.equal(await run(principal, (s) => updateItem(s, item.id, 'changed')), undefined);
        }
      }
      for (const { person, items } of [acme, beta]) {
        const bodies = await run(person.principal, async (s) => {
          const found = [];
          for (const item of items) found.push((await readItem(s, item.id))?.body);
          return found;
        });
        assert.deepEqual(bodies, items.map((item) => item.body));
      }
    });

    test('colleagues share the shared side, not each other’s private side', async () => {
      const seen = await run(cara.principal, (s) => listItems(s, acme.space));
      assert.deepEqual(
        seen.map((item) => item.body),
        ['Acme launch date', "Cara's private note"],
      );
    });
  });
}

describe('directly against the database', () => {
  test('each person sees only what the access rule allows', async () => {
    for (const client of [acme, beta]) {
      await as(client.person.principal, async (s) => {
        const spaces = [client.space, client.person.personalSpaceId].sort();
        assert.deepEqual(ids(await s.tx`select id from content`), ids(client.items));
        assert.deepEqual(ids(await s.tx`select id from spaces`), spaces);
        assert.deepEqual(ids(await s.tx`select id from people`), [...client.people].sort());
        const members = await s.tx<{ id: string }[]>`select distinct person_id as id from memberships`;
        assert.deepEqual(ids(members), [...client.people].sort());
        const access = await s.tx<{ id: string }[]>`select space_id as id from space_access`;
        assert.deepEqual(ids(access), spaces);
      });
    }
    const caraSees = await as(cara.principal, (s) => s.tx`select body from content order by created_at`);
    assert.deepEqual(
      caraSees.map((row) => row.body),
      ['Acme launch date', "Cara's private note"],
    );
  });

  test('nobody can write to another client', async () => {
    for (const { intruder, target } of pairs()) {
      const principal = intruder.person.principal;
      const me = intruder.person.id;
      const other = target.person.id;

      for (const privateTo of [null, me, other]) {
        await assert.rejects(
          as(principal, (s) => s.tx`
            insert into content (space_id, private_to, body)
            values (${target.space}, ${privateTo}, 'x')
          `),
          { code: '42501' },
        );
      }
      const changed = await as(principal, (s) => s.tx`
        update content set body = 'changed'
        where id in ${s.tx(target.items.map((item) => item.id))}
        returning id
      `);
      assert.equal(changed.length, 0);

      const denied: Statement[] = [
        (s) => s.tx`delete from content`,
        (s) => s.tx`insert into memberships (space_id, person_id, role) values (${target.space}, ${me}, 'admin')`,
        (s) => s.tx`insert into space_access (space_id, person_id, admin) values (${target.space}, ${me}, true)`,
        (s) => s.tx`update spaces set parent_id = ${intruder.space} where id = ${target.space}`,
        (s) => s.tx`update people set name = 'x'`,
      ];
      for (const statement of denied) {
        await assert.rejects(as(principal, statement), { code: '42501' });
      }
    }
  });

  test('items never move between spaces or sides', async () => {
    const [shared, privateItem] = acme.items;
    const changes: Statement[] = [
      (s) => s.tx`update content set private_to = null where id = ${privateItem.id}`,
      (s) => s.tx`update content set private_to = ${acme.person.id} where id = ${shared.id}`,
      (s) => s.tx`update content set space_id = ${acme.person.personalSpaceId} where id = ${shared.id}`,
    ];
    for (const change of changes) {
      await assert.rejects(as(acme.person.principal, change), { code: '42501' });
    }
  });

  test('Hivemind connects as a restricted role, and every table it can read is protected', async () => {
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
