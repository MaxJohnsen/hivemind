// Sets up people, spaces and tokens, until Hivemind has sign-in.

import { connect, withPrincipal } from './db.ts';
import { addMember, createPerson, createSpace, listSpaces } from './spaces.ts';
import { createToken, revokeTokens } from './tokens.ts';

const usage = `Usage: node src/cli.ts <command>

  add-person <name>                       Prints the new person's id
  add-token <person> <agent>              Prints a token for an agent, such as "Claude Code"
  revoke-tokens <person>                  Revokes all of a person's tokens
  add-space <person> <name> [parent]      Prints the new space's id
  add-member <admin> <space> <person>
  spaces <person>`;

const sql = connect();
const [command, ...args] = process.argv.slice(2);
const as = <T>(person: string, fn: Parameters<typeof withPrincipal<T>>[2]) => withPrincipal(sql, { person }, fn);

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
  } else {
    console.error(usage);
    process.exitCode = 1;
  }
} finally {
  await sql.end();
}
