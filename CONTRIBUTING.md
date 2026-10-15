# Contributing

Homing is still being designed, so the most useful contribution right now is a question or a challenge to the concept. Open an issue.

## Development

You need Node.js 24 or later and Docker.

```sh
docker compose up -d db   # PostgreSQL on port 5442
npm install
npm run check             # type checking
npm test                  # recreates the test database and runs the tests
npm run dev:web           # the screens, with sample data, at http://localhost:5173
```

### Running it

```sh
echo "HOMING_SECRET=$(openssl rand -base64 32)" >> .env   # once
docker compose up -d --build
docker compose logs homing   # shows the link for creating the first account
```

Open the link to create your account with a passkey. It works once, for an hour; restart Homing for a new one. Homing reads these settings:

| Setting | What it does |
|---|---|
| `HOMING_URL` | Where people and assistants reach Homing, such as `https://homing.example.com`. Passkeys belong to its host name. Defaults to `http://localhost:4100` |
| `HOMING_SECRET` | Signs sessions: at least 32 random characters, such as from `openssl rand -base64 32`. Homing won't start without one, except when it listens only on localhost, as `npm test` does. Changing it signs everyone out |
| `HOMING_PASSWORDS` | `off` turns off signing in with a password. Passkeys always work |
| `HOMING_TRUSTED_PROXIES` | The reverse proxies in front of Homing, as addresses or ranges like `172.16.0.0/12`. Only their `X-Forwarded-For` counts for sign-in's rate limits; otherwise Homing uses the connection's own address |

### Trying it with Claude Code

Until Homing has sign-in, a small command-line tool sets up people, spaces, tokens, rules and skills. Each command prints what it creates, and `node src/cli.ts` lists them all.

```sh
docker compose up -d --build
docker compose exec homing node src/cli.ts add-person "Your name"
docker compose exec homing node src/cli.ts add-space <your id> "A client"
docker compose exec homing node src/cli.ts add-token <your id> "Claude Code"
docker compose exec homing node src/cli.ts add-rule <your id> <space id> preference "Write reports in English"
claude mcp add --transport http homing http://localhost:4100/mcp --header "Authorization: Bearer <token>"
```

Then ask Claude Code to remember something for that client, and ask about it in a new session. Ask it to write a report for the client, and the rule comes with the context.

The command line acts as whoever you name, without sign-in, so treat it like the database password. An agent that can run commands on the same machine, such as Claude Code, can use it too, and can change guidance with it. Until Homing has sign-in, don't rely on "only people change guidance" there.

To add a skill, run the command line from your checkout instead, so it can read the skill's folder on your computer. It connects to the database from Docker Compose.

```sh
node src/cli.ts import-skill <your id> <space id> ~/skills/status-report
```

## Releasing

Versions follow [Semantic Versioning](https://semver.org). Until 1.0, a minor version may include breaking changes, and its notes say so.

A release starts as a draft:

```sh
gh release create v0.1.0 --draft --generate-notes
```

GitHub lists the merged pull requests. Add a few sentences on top about what's new and anything to do when upgrading, then publish. Publishing builds the Docker image for amd64 and arm64 and pushes it to `ghcr.io/maxjohnsen/homing` as `0.1.0`, `0.1` and `latest`. Published releases can't be changed.

## License

Homing is licensed under AGPL-3.0. To keep the option of offering it under other terms later, for example a commercial license for organizations that can't use AGPL, contributors will be asked to sign a short contributor agreement before their first pull request is merged. You keep the copyright to your work. The agreement only gives the project the right to relicense it.

The agreement will be published here before any outside code is accepted.
