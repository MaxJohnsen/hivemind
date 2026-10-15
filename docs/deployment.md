# Running Homing

How to run your own Homing. It is one Docker image next to PostgreSQL, started with Docker Compose. How it works inside is in the [architecture](architecture.md).

## Start it

You need Docker and a copy of this repository. Compose builds the image from it.

```sh
echo "HOMING_SECRET=$(openssl rand -base64 32)" >> .env
docker compose up -d --build
docker compose logs homing
```

The log shows a link for creating the first account. It works once, for an hour; restart Homing for a new one. That account looks after this Homing: it invites the people who use it, but gets no access to their spaces. Your account page then shows the address to add to your assistants as a connector.

Keep the secret. It signs sessions and protects the keys that sign assistants' tokens, so changing it signs everyone out and stops assistants from getting new tokens.

## HTTPS

Claude.ai and ChatGPT reach Homing at a public HTTPS address, and passkeys need HTTPS everywhere but localhost. Put Homing behind a reverse proxy that handles HTTPS, such as Caddy, and set `HOMING_URL` to the address people use. Compose publishes Homing only on this machine, at `127.0.0.1:4100`, for the proxy to forward to.

Then set `HOMING_TRUSTED_PROXIES` to the proxy's address, so sign-in's rate limits count each client by its own address. A proxy on the same machine reaches Homing through Docker's network, which `172.16.0.0/12` usually covers.

## Settings

Put them in `.env`, next to `compose.yaml`.

| Setting | What it does |
|---|---|
| `HOMING_URL` | Where people and assistants reach Homing, such as `https://homing.example.com`. Passkeys belong to its host name. Defaults to `http://localhost:4100` |
| `HOMING_SECRET` | Required: at least 32 random characters. Homing won't start without it, unless it listens only on localhost, as `npm test` does |
| `HOMING_TRUSTED_PROXIES` | The reverse proxies in front of Homing, as addresses or ranges. Only they can say who a client is, with `X-Forwarded-For` |
| `HOMING_ASSISTANT_SITES` | The sites whose assistants may connect, by the host of their client metadata document. Defaults to `claude.ai,chatgpt.com`; `*` allows any |
| `HOMING_PASSWORDS` | `off` turns off signing in with a password. Passkeys always work |
| `SMTP_URL` | For sending invites and sign-in links by email, such as `smtps://user:password@smtp.example.com`. Without it, Homing sends no email |
| `HOMING_EMAIL_FROM` | Who Homing's email comes from, such as `Homing <homing@example.com>` |

## Updating

```sh
git pull
docker compose up -d --build
```

Migrations run before the server starts. Back up the database and `.env` together, since a restored database needs the same secret.

## When someone can't sign in

With email, "Can't sign in?" on the sign-in page sends a one-time link to the person's verified address. Without email, you give them one. It works once, for 15 minutes, and only signs them in, so they can add a new passkey:

```sh
docker compose exec homing node src/cli.ts sign-in-link ana@example.com
```
