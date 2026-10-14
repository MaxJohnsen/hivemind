import { personOf, type Session } from './db.ts';
import {
  checkSpace,
  current,
  insertItem,
  itemColumns,
  sideOf,
  visible,
  visibleContent,
  type Item,
} from './knowledge.ts';
import { accessibleSpaces } from './spaces.ts';

/** A requirement always applies. A preference can be overridden by a more specific one. */
export type RuleKind = 'requirement' | 'preference';

export interface Rule {
  id: string;
  spaceId: string;
  /** The name of the rule's space, or null when the viewer can't open it. */
  spaceName: string | null;
  /** Whether the rule is in the viewer's personal space, whose guidance follows them everywhere. */
  personal: boolean;
  kind: RuleKind;
  body: string;
  privateTo: string | null;
  onlyHere: boolean;
}

/**
 * Adds a rule to a space's guidance. Only a person editing directly can, and
 * a shared rule needs an admin. It reaches the spaces below unless it is
 * marked only here.
 */
export async function addRule(
  s: Session,
  input: { spaceId: string; kind: RuleKind; body: string; shared?: boolean; onlyHere?: boolean },
): Promise<Item> {
  const privateTo = sideOf(s, input.shared);
  await checkSpace(s, input.spaceId, input.shared);
  const [{ pageId }] = await s.tx`select guidance_page(${input.spaceId}::uuid) as page_id`;
  return insertItem(s, {
    pageId,
    spaceId: input.spaceId,
    privateTo,
    kind: input.kind,
    body: input.body,
    reachesDown: !input.onlyHere,
  });
}

/** Rewrites a rule. What it said before stays in its history. */
export async function editRule(s: Session, ruleId: string, body: string): Promise<Item | undefined> {
  if (!(await ownRule(s, ruleId))) return undefined;
  const [rule] = await s.tx<Item[]>`
    update content set body = ${body} where id = ${ruleId}::uuid returning ${itemColumns(s)}
  `;
  return rule;
}

/** Removes a rule for everyone it reaches. It stays in the history. */
export async function removeRule(s: Session, ruleId: string): Promise<boolean> {
  const rule = await ownRule(s, ruleId);
  if (!rule) return false;
  await insertItem(s, { ...rule, kind: 'removed', body: '', supersedes: rule.id, path: null });
  return true;
}

/**
 * The rules that apply in a space, from least to most specific: the
 * viewer's personal guidance first, then each space from the top of the
 * tree down, with private rules after shared ones in the same space.
 * Homing doesn't judge whether two rules contradict each other. The agent
 * does, by this order.
 */
export async function rulesFor(s: Session, spaceId: string): Promise<Rule[]> {
  return s.tx<Rule[]>`
    ${applying(s, spaceId)}
    select c.id, c.space_id, sp.name as space_name,
           coalesce(sp.private_to is not null and sp.parent_id is null, false) as personal,
           c.kind, c.body, c.private_to, not c.reaches_down as only_here
    from applies a
    join content c on c.space_id = a.space_id
    join pages p on p.id = c.page_id and p.type = 'guidance'
    left join spaces sp on sp.id = c.space_id and sp.id in (${accessibleSpaces(s)})
    where c.kind in ('requirement', 'preference')
      and (a.distance = 0 or c.reaches_down)
      and ${visibleContent(s, 'c')} and ${current(s, 'c')}
    order by a.distance desc, c.private_to is not null, c.created_at
  `;
}

/**
 * The spaces whose guidance applies in a space, as a query named applies:
 * the space itself at distance 0, each space above it, and the viewer's
 * personal space, which is always the farthest.
 */
export function applying(s: Session, spaceId: string) {
  return s.tx`
    with chain (space_id, distance) as (
      select ${spaceId}::uuid, 0
      union all
      select id, distance from spaces_above(${spaceId}::uuid)
    ),
    applies (space_id, distance) as (
      select space_id, distance from chain
      union all
      select id, (select count(*)::integer from chain) from spaces
      where private_to = ${personOf(s.principal) ?? null}::uuid and parent_id is null
        and id not in (select space_id from chain)
    )
  `;
}

/** A current rule in a space the person can open, which is where rules are changed. */
async function ownRule(s: Session, ruleId: string): Promise<Item | undefined> {
  const [rule] = await s.tx<Item[]>`
    select ${itemColumns(s)} from content
    where id = ${ruleId}::uuid and kind in ('requirement', 'preference')
      and ${visible(s, 'content')} and ${current(s, 'content')}
  `;
  return rule;
}
