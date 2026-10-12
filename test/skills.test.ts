// Skills (spec §2): SKILL.md folders kept as they were imported, reaching
// down the tree, with the more specific skill of a name winning.

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import type { Principal } from '../src/db.ts';
import { readItem, readPage } from '../src/knowledge.ts';
import { readSkillFolder, saveSkill, skillsFor, type SkillFile } from '../src/skills.ts';
import { addMember, createSpace } from '../src/spaces.ts';
import { admin, as, db, person, refused, type Person } from './helpers.ts';

/**
 * Ana runs Acme with her colleague Cara, and the Website project below it.
 * Gunnar, from the client, is in a closed workshop below Acme.
 */
async function acme() {
  const ana = await person('Ana');
  const cara = await person('Cara');
  const gunnar = await person('Gunnar');
  const spaces = await as(ana, async (s) => {
    const space = await createSpace(s, { name: 'Acme' });
    await addMember(s, space, cara.id);
    const website = await createSpace(s, { name: 'Website', parentId: space });
    const workshop = await createSpace(s, { name: 'Workshop', parentId: space, closed: true });
    await addMember(s, workshop, gunnar.id);
    return { space, website, workshop };
  });
  return { ana, cara, gunnar, ...spaces };
}

const direct = (someone: Person) => ({ ...someone, direct: true as const });

function skill(name: string, description: string, steps = '1. Collect what changed.\n2. Write it in two sentences.') {
  return { path: 'SKILL.md', body: `---\nname: ${name}\ndescription: ${description}\n---\n\n${steps}\n` };
}

const folders: string[] = [];
after(() => Promise.all(folders.map((folder) => rm(folder, { recursive: true }))));

/** Writes a skill folder to disk, as someone would have it on their computer. */
async function folder(files: Record<string, string | Buffer>) {
  const root = await mkdtemp(join(tmpdir(), 'skill-'));
  folders.push(root);
  for (const [path, body] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), body);
  }
  return root;
}

async function skillsSeenBy(principal: Principal, spaceId: string, sql = db) {
  return (await as(principal, (s) => skillsFor(s, spaceId), sql)).map((found) => `${found.name}: ${found.description}`);
}

test('an imported skill reads back as it was, files and all', async () => {
  const { ana, space } = await acme();
  const files = {
    'SKILL.md': skill('status-report', 'Writes the weekly status report for a client.').body,
    'references/tone.md': 'Plain and short. No exclamation marks.\n',
    'scripts/count.py': 'import sys\nprint(len(sys.stdin.read().split()))\n',
  };
  const { files: read } = await readSkillFolder(await folder(files));
  const saved = await as(direct(ana), (s) => saveSkill(s, { spaceId: space, files: read, shared: true }));

  const page = await as(ana, (s) => readPage(s, saved.pageId));
  assert.deepEqual(Object.fromEntries(page?.items.map((item) => [item.path, item.body]) ?? []), files);
  assert.deepEqual(await skillsSeenBy(ana, space), ['status-report: Writes the weekly status report for a client.']);
});

test('a more specific skill replaces an inherited one with the same name', async () => {
  const { ana, cara, gunnar, space, website, workshop } = await acme();
  await as(direct(ana), async (s) => {
    await saveSkill(s, { spaceId: ana.personalSpaceId, files: [skill('status-report', 'Ana’s own way')] });
    await saveSkill(s, { spaceId: space, files: [skill('status-report', 'Acme’s way')], shared: true });
    await saveSkill(s, { spaceId: space, files: [skill('invoice', 'Acme’s invoices')], shared: true });
    await saveSkill(s, { spaceId: website, files: [skill('status-report', 'Ana’s way for the website')] });
    await saveSkill(s, { spaceId: website, files: [skill('status-report', 'The website’s way')], shared: true });
  });

  assert.deepEqual(await skillsSeenBy(ana, ana.personalSpaceId), ['status-report: Ana’s own way']);
  assert.deepEqual(await skillsSeenBy(ana, space), ['invoice: Acme’s invoices', 'status-report: Acme’s way']);
  // Between equally specific skills, the private one wins for its owner.
  assert.deepEqual(await skillsSeenBy(ana, website), ['invoice: Acme’s invoices', 'status-report: Ana’s way for the website']);
  assert.deepEqual(await skillsSeenBy(cara, website), ['invoice: Acme’s invoices', 'status-report: The website’s way']);
  // Skills reach closed spaces too, without row-level security as well.
  for (const sql of [db, admin]) {
    assert.deepEqual(await skillsSeenBy(gunnar, workshop, sql), ['invoice: Acme’s invoices', 'status-report: Acme’s way']);
    const names = (await as(gunnar, (s) => skillsFor(s, workshop), sql)).map((found) => found.spaceName);
    assert.deepEqual(names, [null, null]);
  }
});

test('a skill is a SKILL.md with a name and description, and only text files', async () => {
  const { ana, space } = await acme();
  const root = await folder({
    'SKILL.md': skill('brand', 'Applies Acme’s visual identity.').body,
    'assets/logo.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]),
    'assets/sizes.bin': Buffer.from('small\0large'),
    '.DS_Store': Buffer.from([0x00, 0x01]),
  });
  await assert.rejects(readSkillFolder(root), { message: /These aren't text: assets\/logo\.png, assets\/sizes\.bin\.$/ });

  // Hidden files are skipped, and named.
  await rm(join(root, 'assets'), { recursive: true });
  const { files, skipped } = await readSkillFolder(root);
  assert.deepEqual([files.map((file) => file.path), skipped], [['SKILL.md'], ['.DS_Store']]);

  const save = (files: SkillFile[]) => as(direct(ana), (s) => saveSkill(s, { spaceId: space, files, shared: true }));
  await assert.rejects(save([{ path: 'README.md', body: 'Applies the brand' }]), /needs a SKILL\.md/);
  await assert.rejects(save([skill('Brand Guide', 'Applies the brand')]), /needs a name/);
  await assert.rejects(save([{ path: 'SKILL.md', body: '---\nname: brand\n---\nSteps' }]), /needs a description/);
});

test('importing a skill again updates it, and keeps what it said before', async () => {
  const { ana, gunnar, space, workshop } = await acme();
  const first = skill('status-report', 'Writes the weekly status report.');
  const second = skill('status-report', 'Writes the weekly status report, in Norwegian.');
  const save = (files: SkillFile[]) => as(direct(ana), (s) => saveSkill(s, { spaceId: space, files, shared: true }));

  const created = await save([first, { path: 'tone.md', body: 'Plain' }, { path: 'old.md', body: 'Outdated' }]);
  const updated = await save([second, { path: 'tone.md', body: 'Plain' }, { path: 'new.md', body: 'Current' }]);
  assert.equal(updated.pageId, created.pageId);
  assert.deepEqual([updated.changed, updated.added, updated.removed], [['SKILL.md'], ['new.md'], ['old.md']]);

  for (const reader of [ana, gunnar]) {
    const page = await as(reader, (s) => readPage(s, created.pageId));
    assert.deepEqual(page?.items.map((item) => item.path).sort(), ['SKILL.md', 'new.md', 'tone.md']);
  }
  assert.deepEqual(await skillsSeenBy(gunnar, workshop), ['status-report: Writes the weekly status report, in Norwegian.']);
  const page = await as(ana, (s) => readPage(s, created.pageId));
  const skillMd = await as(ana, (s) => readItem(s, page!.items.find((item) => item.path === 'SKILL.md')!.id));
  assert.deepEqual(skillMd?.history.map((revision) => revision.body), [first.body]);
});

test('only people change skills, and shared skills only the space’s admins', async () => {
  const { ana, cara, space } = await acme();
  const files = [skill('status-report', 'Writes the weekly status report.')];

  for (const someone of [{ ...ana, agent: 'Claude Code' }, ana]) {
    await assert.rejects(as(someone, (s) => saveSkill(s, { spaceId: space, files, shared: true })), refused);
  }
  await assert.rejects(as(direct(cara), (s) => saveSkill(s, { spaceId: space, files, shared: true })), refused);
  await as(direct(cara), (s) => saveSkill(s, { spaceId: space, files }));
  assert.deepEqual(await skillsSeenBy(cara, space), ['status-report: Writes the weekly status report.']);
  assert.deepEqual(await skillsSeenBy(ana, space), []);
});

test('a skill keeps its name, even straight against the database', async () => {
  const { ana, space } = await acme();
  const { pageId } = await as(direct(ana), (s) =>
    saveSkill(s, { spaceId: space, files: [skill('status-report', 'Writes the weekly status report.')], shared: true }),
  );
  const [name] = await as(ana, (s) => s.tx`select id from content where page_id = ${pageId} and kind = 'title'`);
  await assert.rejects(
    as(direct(ana), (s) => s.tx`
      insert into content (space_id, page_id, kind, body, supersedes, reaches_down)
      values (${space}, ${pageId}, 'removed', '', ${name.id}, true)
    `),
    refused,
  );
  // Nor does knowledge go on a skill's page.
  await assert.rejects(
    as(direct(ana), (s) => s.tx`
      insert into content (space_id, page_id, kind, body, reaches_down) values (${space}, ${pageId}, 'text', 'Hello', true)
    `),
    { code: '23514' },
  );
});
