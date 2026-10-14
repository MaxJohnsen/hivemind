// Sets up spaces, rules and skills, until Homing's web app and assistants
// can, and gives people a sign-in link when they can't sign in. Everything
// here is a person editing directly.

import { Pool } from 'pg';
import { authDatabaseUrl, connect, withPrincipal } from './db.ts';
import { addRule, editRule, removeRule, rulesFor, type Rule, type RuleKind } from './guidance.ts';
import { readSkillFolder, removeSkill, saveSkill, skillsFor } from './skills.ts';
import { createAuth } from './auth.ts';
import { operatorSignInLink } from './recovery.ts';
import { configuredUrl, secretFor } from './server.ts';
import { addMember, createSpace, listSpaces, type Space } from './spaces.ts';

const usage = `Usage: node src/cli.ts <command>

  people                                  Everyone with an account, with their ids
  sign-in-link <email>                    A one-time link for someone who can't sign in
  add-space <person> <name> [parent]      Prints the new space's id
  add-member <admin> <space> <person>
  spaces <person>

  rules <person> <space>                  The rules that apply in a space, least specific first
  add-rule <person> <space> requirement|preference <text> [--private] [--only-here]
  edit-rule <person> <rule> <text>
  remove-rule <person> <rule>

  skills <person> <space>                 The skills that apply in a space
  import-skill <person> <space> <folder> [--private]
                                          Adds a SKILL.md folder, or updates the skill with its name
  remove-skill <person> <skill>

Rules and skills are shared with the space unless --private is given, or
the space is in your personal tree. They also apply in the spaces below
their own. A rule can be kept to its space with --only-here.`;

const sql = connect();
const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((arg) => arg.startsWith('--')));
const args = rest.filter((arg) => !arg.startsWith('--'));
const as = <T>(person: string, fn: Parameters<typeof withPrincipal<T>>[2]) =>
  withPrincipal(sql, { person, direct: true }, fn);

try {
  if (command === 'people' && args.length === 0) {
    // Only sign-in's own role can read accounts, which share their person's id.
    const accounts = connect(authDatabaseUrl);
    try {
      for (const account of await accounts`select id, name, email from auth."user" order by "createdAt"`) {
        console.log(`${account.id}  ${account.name} <${account.email}>`);
      }
    } finally {
      await accounts.end();
    }
  } else if (command === 'sign-in-link' && args.length === 1) {
    const url = configuredUrl ?? new URL('http://localhost:4100');
    const pool = new Pool({ connectionString: authDatabaseUrl, options: '-c search_path=auth' });
    try {
      const auth = createAuth(sql, pool, { url, secret: secretFor(url), passwords: false, assistantSites: [] });
      const link = await operatorSignInLink(auth, url, args[0]);
      console.log(link ? `Send this to them. It signs them in once, within an hour:\n\n  ${link}` : 'There is no account with that email.');
    } finally {
      await pool.end();
    }
  } else if (command === 'add-space' && (args.length === 2 || args.length === 3)) {
    console.log(await as(args[0], (s) => createSpace(s, { name: args[1], parentId: args[2] })));
  } else if (command === 'add-member' && args.length === 3) {
    await as(args[0], (s) => addMember(s, args[1], args[2]));
  } else if (command === 'spaces' && args.length === 1) {
    for (const space of await as(args[0], listSpaces)) console.log(`${space.id}  ${space.name}`);
  } else if (command === 'rules' && args.length === 2) {
    printRules(await as(args[0], (s) => rulesFor(s, args[1])));
  } else if (command === 'add-rule' && args.length === 4 && ['requirement', 'preference'].includes(args[2])) {
    const [person, spaceId, kind, body] = args;
    await as(person, async (s) => {
      const space = await spaceById(s, spaceId);
      const shared = !flags.has('--private') && !space.privateTo;
      const onlyHere = flags.has('--only-here');
      console.log(`Rules that already apply in ${space.name}, least specific first:`);
      printRules(await rulesFor(s, spaceId));
      const rule = await addRule(s, { spaceId, kind: kind as RuleKind, body, shared, onlyHere });
      console.log(`\nAdded ${rule.id}, a ${shared ? 'shared' : 'private'} ${kind} in ${space.name}.`);
      if (shared && !onlyHere) console.log(`${reach(space)} Use --only-here to keep a rule to this space.`);
    });
  } else if (command === 'edit-rule' && args.length === 3) {
    await as(args[0], async (s) => {
      const rule = await editRule(s, args[1], args[2]);
      if (!rule) return console.log('There is no rule with that id that you can change.');
      console.log('Changed. What it said before is kept in its history.');
      if (!rule.privateTo && rule.reachesDown) console.log(reach(await spaceById(s, rule.spaceId)));
    });
  } else if (command === 'remove-rule' && args.length === 2) {
    const removed = await as(args[0], (s) => removeRule(s, args[1]));
    console.log(removed ? 'Removed. It stays in the history.' : 'There is no rule with that id that you can change.');
  } else if (command === 'skills' && args.length === 2) {
    const skills = await as(args[0], (s) => skillsFor(s, args[1]));
    if (skills.length === 0) console.log('  None');
    for (const skill of skills) {
      const from = [skill.spaceName ?? 'a space above', skill.privateTo && 'private'].filter(Boolean).join(', ');
      console.log(`  ${skill.pageId}  ${skill.name} (${from}): ${skill.description}`);
    }
  } else if (command === 'import-skill' && args.length === 3) {
    const [person, spaceId, folder] = args;
    const { files, skipped } = await readSkillFolder(folder);
    await as(person, async (s) => {
      const space = await spaceById(s, spaceId);
      const shared = !flags.has('--private') && !space.privateTo;
      const skill = await saveSkill(s, { spaceId, files, shared });
      if (skill.created) {
        console.log(`Added ${skill.name} to ${space.name} as a ${shared ? 'shared' : 'private'} skill with ${files.length} files (${skill.pageId}).`);
      } else {
        const changes = [`${skill.changed.length} changed`, `${skill.added.length} added`, `${skill.removed.length} removed`];
        console.log(`Updated ${skill.name} in ${space.name}: ${changes.join(', ')}. Earlier versions are kept.`);
      }
      if (skipped.length) console.log(`Skipped hidden files: ${skipped.join(', ')}.`);
      if (shared) console.log(reach(space));
    });
  } else if (command === 'remove-skill' && args.length === 2) {
    const removed = await as(args[0], (s) => removeSkill(s, args[1]));
    console.log(removed ? 'Removed. It stays in the history.' : 'There is no skill with that id that you can change.');
  } else {
    console.error(usage);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}

async function spaceById(s: Parameters<typeof listSpaces>[0], spaceId: string): Promise<Space> {
  const space = (await listSpaces(s)).find((candidate) => candidate.id === spaceId);
  if (!space) throw new Error('There is no space with that id that you can see.');
  return space;
}

/** Shown whenever someone changes shared guidance (spec §2). */
function reach(space: Space): string {
  return (
    `It also applies to the spaces below ${space.name}, including closed ones you can't access, ` +
    'and their members may receive it.'
  );
}

function printRules(rules: Rule[]) {
  if (rules.length === 0) console.log('  None');
  for (const rule of rules) {
    const from = rule.personal ? 'your personal space' : (rule.spaceName ?? 'a space above');
    const notes = [from, rule.privateTo && 'private', rule.onlyHere && 'only here'].filter(Boolean).join(', ');
    console.log(`  ${rule.id}  ${rule.kind} (${notes}): ${rule.body}`);
  }
}
