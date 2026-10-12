// Sets up people, spaces, tokens and guidance, until Hivemind has sign-in
// and a web app. Everything here is a person editing directly.

import { connect, withPrincipal } from './db.ts';
import { addRule, editRule, removeRule, rulesFor, type Rule, type RuleKind } from './guidance.ts';
import { addMember, createPerson, createSpace, listSpaces } from './spaces.ts';
import { createToken, revokeTokens } from './tokens.ts';

const usage = `Usage: node src/cli.ts <command>

  add-person <name>                       Prints the new person's id
  add-token <person> <agent>              Prints a token for an agent, such as "Claude Code"
  revoke-tokens <person>                  Revokes all of a person's tokens
  add-space <person> <name> [parent]      Prints the new space's id
  add-member <admin> <space> <person>
  spaces <person>

  rules <person> <space>                  The rules that apply in a space, least specific first
  add-rule <person> <space> requirement|preference <text> [--private] [--only-here]
  edit-rule <person> <rule> <text>
  remove-rule <person> <rule>

Rules are shared with the space unless --private is given, or the space is
in your personal tree. A rule also applies in the spaces below its own
unless --only-here is given.`;

const sql = connect();
const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((arg) => arg.startsWith('--')));
const args = rest.filter((arg) => !arg.startsWith('--'));
const as = <T>(person: string, fn: Parameters<typeof withPrincipal<T>>[2]) =>
  withPrincipal(sql, { person, direct: true }, fn);

try {
  if (command === 'add-person' && args.length === 1) {
    console.log((await createPerson(sql, args[0])).id);
  } else if (command === 'add-token' && args.length === 2) {
    console.log(await as(args[0], (s) => createToken(s, args[1])));
  } else if (command === 'revoke-tokens' && args.length === 1) {
    console.log(`Revoked ${await as(args[0], revokeTokens)} tokens.`);
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
      const space = (await listSpaces(s)).find((candidate) => candidate.id === spaceId);
      if (!space) throw new Error('There is no space with that id that you can see.');
      const shared = !flags.has('--private') && !space.privateTo;
      const onlyHere = flags.has('--only-here');
      console.log(`Rules that already apply in ${space.name}, least specific first:`);
      printRules(await rulesFor(s, spaceId));
      const rule = await addRule(s, { spaceId, kind: kind as RuleKind, body, shared, onlyHere });
      console.log(`\nAdded ${rule.id}, a ${shared ? 'shared' : 'private'} ${kind} in ${space.name}.`);
      if (shared && !onlyHere) {
        console.log(
          `It also applies to the spaces below ${space.name}, including closed ones you can't access, ` +
            'and their members may receive it. Use --only-here to keep a rule to this space.',
        );
      }
    });
  } else if (command === 'edit-rule' && args.length === 3) {
    const rule = await as(args[0], (s) => editRule(s, args[1], args[2]));
    console.log(rule ? 'Changed. What it said before is kept in its history.' : 'There is no rule with that id that you can change.');
  } else if (command === 'remove-rule' && args.length === 2) {
    const removed = await as(args[0], (s) => removeRule(s, args[1]));
    console.log(removed ? 'Removed. It stays in the history.' : 'There is no rule with that id that you can change.');
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

function printRules(rules: Rule[]) {
  if (rules.length === 0) console.log('  None');
  for (const rule of rules) {
    const from = rule.personal ? 'your personal space' : (rule.spaceName ?? 'a space above');
    const notes = [from, rule.privateTo && 'private', rule.onlyHere && 'only here'].filter(Boolean).join(', ');
    console.log(`  ${rule.id}  ${rule.kind} (${notes}): ${rule.body}`);
  }
}
