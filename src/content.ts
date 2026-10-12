import { AccessDenied, personOf, type Session } from './db.ts';
import { accessibleSpaces } from './spaces.ts';

export interface Item {
  id: string;
  spaceId: string;
  /** The person whose private side the item is on, or null when shared. */
  privateTo: string | null;
  body: string;
}

/** Writes an item. It is private unless shared is set. */
export async function writeItem(
  s: Session,
  input: { spaceId: string; body: string; shared?: boolean },
): Promise<Item> {
  const privateTo = input.shared ? null : personOf(s.principal);
  if (privateTo === undefined) throw new AccessDenied('a space has no private side');

  const [space] = await s.tx<{ personal: boolean }[]>`
    select private_to is not null as personal
    from spaces
    where id = ${input.spaceId}::uuid and id in (${accessibleSpaces(s)})
  `;
  if (!space) throw new AccessDenied('no access to this space');
  if (space.personal && input.shared) {
    throw new AccessDenied('spaces in a personal tree have no shared side');
  }

  const [item] = await s.tx<Item[]>`
    insert into content (space_id, private_to, body)
    values (${input.spaceId}::uuid, ${privateTo}::uuid, ${input.body})
    returning id, space_id, private_to, body
  `;
  return item;
}

export async function readItem(s: Session, id: string): Promise<Item | undefined> {
  const [item] = await s.tx<Item[]>`
    select id, space_id, private_to, body from content
    where id = ${id}::uuid and ${visible(s)}
  `;
  return item;
}

export async function listItems(s: Session, spaceId: string): Promise<Item[]> {
  return s.tx<Item[]>`
    select id, space_id, private_to, body from content
    where space_id = ${spaceId}::uuid and ${visible(s)}
    order by created_at
  `;
}

/** Changes an item's text. Returns nothing if the item isn't visible. */
export async function updateItem(s: Session, id: string, body: string): Promise<Item | undefined> {
  const [item] = await s.tx<Item[]>`
    update content set body = ${body}, updated_at = now()
    where id = ${id}::uuid and ${visible(s)}
    returning id, space_id, private_to, body
  `;
  return item;
}

/** The shared side of accessible spaces, plus the person's own private side. */
function visible(s: Session) {
  return s.tx`
    space_id in (${accessibleSpaces(s)})
    and (private_to is null or private_to = ${personOf(s.principal) ?? null}::uuid)
  `;
}
