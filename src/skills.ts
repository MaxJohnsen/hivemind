import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { parse } from 'yaml';
import type { Session } from './db.ts';
import { applying } from './guidance.ts';
import { checkSpace, current, insertItem, itemColumns, sideOf, visible, visibleContent, type Item } from './knowledge.ts';
import { accessibleSpaces } from './spaces.ts';

/** A file in a skill's folder, such as SKILL.md or references/tone.md. */
export interface SkillFile {
  path: string;
  body: string;
}

export interface Skill {
  pageId: string;
  name: string;
  description: string;
  spaceId: string;
  /** The name of the skill's space, or null when the viewer can't open it. */
  spaceName: string | null;
  privateTo: string | null;
}

/**
 * Reads a skill folder in the agent skills format: a SKILL.md with a name
 * and a description, and any other files. Hidden files, such as .DS_Store,
 * are skipped and listed. Hivemind keeps only text files for now, so a
 * folder with other files is refused as a whole.
 */
export async function readSkillFolder(folder: string): Promise<{ files: SkillFile[]; skipped: string[] }> {
  const files: SkillFile[] = [];
  const skipped: string[] = [];
  const binary: string[] = [];
  for (const entry of await readdir(folder, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = relative(folder, join(entry.parentPath, entry.name)).split(sep).join('/');
    if (path.split('/').some((part) => part.startsWith('.'))) {
      skipped.push(path);
      continue;
    }
    const body = asText(await readFile(join(folder, path)));
    if (body === undefined) binary.push(path);
    else files.push({ path, body });
  }
  if (binary.length) {
    throw new Error(`Hivemind keeps only text files in skills for now. These aren't text: ${binary.sort().join(', ')}.`);
  }
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)), skipped: skipped.sort() };
}

/**
 * Saves a skill in a space, or updates the one with the same name on the
 * same side: changed files keep what they said before, and files no longer
 * in the folder are removed. Only a person editing directly can, and a
 * shared skill needs an admin. A skill reaches the spaces below its own.
 */
export async function saveSkill(s: Session, input: { spaceId: string; files: SkillFile[]; shared?: boolean }) {
  const { name } = describe(input.files);
  const privateTo = sideOf(s, input.shared);
  await checkSpace(s, input.spaceId, input.shared);

  const [existing] = await s.tx<{ pageId: string }[]>`
    select t.page_id from content t
    join pages p on p.id = t.page_id and p.type = 'skill'
    where t.space_id = ${input.spaceId}::uuid and t.kind = 'title' and t.body = ${name}
      and t.private_to is not distinct from ${privateTo}::uuid and ${visible(s, 't')}
  `;
  const pageId = existing?.pageId ?? randomUUID();
  const item = { pageId, spaceId: input.spaceId, privateTo, reachesDown: true };
  if (!existing) {
    await s.tx`insert into pages (id, space_id, type) values (${pageId}::uuid, ${input.spaceId}::uuid, 'skill')`;
    await insertItem(s, { ...item, kind: 'title', body: name });
  }

  const stored = await s.tx<Item[]>`
    select ${itemColumns(s)} from content
    where page_id = ${pageId}::uuid and kind = 'file' and private_to is not distinct from ${privateTo}::uuid
      and ${visible(s, 'content')} and ${current(s, 'content')}
  `;
  const changed: string[] = [];
  const added: string[] = [];
  for (const file of input.files) {
    const before = stored.find((candidate) => candidate.path === file.path);
    if (!before) {
      await insertItem(s, { ...item, kind: 'file', path: file.path, body: file.body });
      added.push(file.path);
    } else if (before.body !== file.body) {
      await s.tx`update content set body = ${file.body} where id = ${before.id}::uuid`;
      changed.push(file.path);
    }
  }
  const removed = stored.filter((file) => !input.files.some((candidate) => candidate.path === file.path));
  for (const file of removed) {
    await insertItem(s, { ...item, kind: 'removed', body: '', supersedes: file.id });
  }
  return { pageId, name, created: !existing, added, changed, removed: removed.map((file) => file.path!) };
}

/**
 * The skills that apply in a space, by name. A skill in a more specific
 * space replaces an inherited one with the same name, personal skills are
 * the least specific, and between equally specific ones the private one
 * wins. The agent picks the ones a task needs by their descriptions.
 */
export async function skillsFor(s: Session, spaceId: string): Promise<Skill[]> {
  const skills = await s.tx<(Omit<Skill, 'description'> & { skillMd: string | null })[]>`
    ${applying(s, spaceId)}
    select distinct on (t.body) t.page_id, t.body as name, t.space_id, sp.name as space_name, t.private_to, (
      select f.body from content f
      where f.page_id = t.page_id and f.kind = 'file' and f.path = 'SKILL.md'
        and f.private_to is not distinct from t.private_to
        and ${visibleContent(s, 'f')} and ${current(s, 'f')}
    ) as skill_md
    from applies a
    join content t on t.space_id = a.space_id and t.kind = 'title'
    join pages p on p.id = t.page_id and p.type = 'skill'
    left join spaces sp on sp.id = t.space_id and sp.id in (${accessibleSpaces(s)})
    where ${visibleContent(s, 't')}
    order by t.body, a.distance, t.private_to is null
  `;
  return skills.map(({ skillMd, ...skill }) => ({ ...skill, description: frontmatter(skillMd ?? '').description ?? '' }));
}

/** The name and description of a skill, from the frontmatter of its SKILL.md. */
function describe(files: SkillFile[]): { name: string; description: string } {
  const skillMd = files.find((file) => file.path === 'SKILL.md');
  if (!skillMd) throw new Error('A skill needs a SKILL.md file.');
  const { name, description } = frontmatter(skillMd.body);
  if (!name || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) {
    throw new Error('SKILL.md needs a name in its frontmatter, in lowercase letters, numbers and hyphens, such as status-report.');
  }
  if (!description) throw new Error('SKILL.md needs a description in its frontmatter, saying what the skill does and when to use it.');
  return { name, description };
}

function frontmatter(skillMd: string): { name?: string; description?: string } {
  const yaml = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(skillMd)?.[1];
  try {
    const fields = yaml ? parse(yaml) : undefined;
    const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
    return { name: text(fields?.name), description: text(fields?.description) };
  } catch {
    return {};
  }
}

/** The file's text, or undefined when it isn't text. */
function asText(bytes: Buffer): string | undefined {
  if (bytes.includes(0)) return undefined;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}
