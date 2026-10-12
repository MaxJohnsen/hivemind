import type { Session, Sql } from './db.ts';

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
  return s.tx<Space[]>`
    select id, name, parent_id, closed, private_to
    from spaces
    where id in (${accessibleSpaces(s)})
    order by created_at
  `;
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
