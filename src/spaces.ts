import { personOf, type Session, type Sql } from './db.ts';

export type Role = 'admin' | 'member';

export interface Person {
  id: string;
  personalSpaceId: string;
}

export interface Space {
  id: string;
  name: string;
  parentId: string | null;
  closed: boolean;
  /** Set when the space is in someone's personal tree. */
  privateTo: string | null;
  /** Whether the person can manage the space. */
  admin: boolean;
}

/** Creates a person with their personal space. */
export async function createPerson(sql: Sql, name: string): Promise<Person> {
  const [person] = await sql<Person[]>`
    select person_id as id, personal_space_id from create_person(${name})
  `;
  return person;
}

/** Creates a space, as a new root or under a parent. The creator becomes an admin. */
export async function createSpace(
  s: Session,
  input: { name: string; parentId?: string; closed?: boolean },
): Promise<string> {
  const [{ id }] = await s.tx`
    select create_space(${input.name}, ${input.parentId ?? null}::uuid, ${input.closed ?? false}) as id
  `;
  return id;
}

/** Adds a person to a space, or changes their role. Needs admin rights. */
export async function addMember(s: Session, spaceId: string, personId: string, role: Role = 'member') {
  await s.tx`select add_member(${spaceId}::uuid, ${personId}::uuid, ${role})`;
}

/** Removes a person from a space. Takes effect immediately. */
export async function removeMember(s: Session, spaceId: string, personId: string) {
  await s.tx`select remove_member(${spaceId}::uuid, ${personId}::uuid)`;
}

export async function listSpaces(s: Session): Promise<Space[]> {
  const person = personOf(s.principal) ?? null;
  return s.tx<Space[]>`
    select s.id, s.name, s.parent_id, s.closed, s.private_to, coalesce(a.admin, false) as admin
    from spaces s
    left join space_access a on a.space_id = s.id and a.person_id = ${person}::uuid
    where s.id in (${accessibleSpaces(s)})
    order by s.created_at
  `;
}

/**
 * The names of the people with these ids, as far as the session can see
 * them: itself, and the members of spaces it can access.
 */
export async function peopleNames(s: Session, ids: (string | null)[]): Promise<Map<string, string>> {
  const known = [...new Set(ids.filter((id) => id !== null))];
  if (known.length === 0) return new Map();
  const people = await s.tx<{ id: string; name: string }[]>`
    select id, name from people
    where id in ${s.tx(known)}
      and (id = ${personOf(s.principal) ?? null}::uuid
           or id in (select person_id from memberships where space_id in (${accessibleSpaces(s)})))
  `;
  return new Map(people.map((person) => [person.id, person.name]));
}

/**
 * The spaces the principal can access: a person's through the access table,
 * a space only itself. Hivemind filters with this explicitly, and row-level
 * security applies the same rule underneath.
 */
export function accessibleSpaces(s: Session) {
  return 'person' in s.principal
    ? s.tx`select space_id from space_access where person_id = ${s.principal.person}::uuid`
    : s.tx`select ${s.principal.space}::uuid`;
}
