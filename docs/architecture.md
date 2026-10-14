# Architecture

How Homing is built. The behavior it must have is in the [specification](spec.md). This document can change without changing the concept.

## Shape

Homing is a modular monolith: one deployment with a transactional database, derived indexes, background workers and optional model inference. External agents stay independent and use Homing through MCP.

| Component | Responsibility |
|---|---|
| MCP server | The interface agents use |
| Web app | The interface people use |
| Core | Spaces, guidance, context, permissions, publishing checks, proposals |
| Runner | System routines: capture → route → upkeep |
| Connection broker | Credential vault, OAuth, adapters, executing `act` |
| Store | One transactional database plus derived search indexes |
| Local bridge | Optional. An outbound-only helper on a Mac, for example for iMessage |

## Technology

Chosen for fast context retrieval, simple self-hosting, reliable concurrency and permissions, easy extensibility and minimal infrastructure.

| Part | Choice |
|---|---|
| Language | TypeScript on Node.js, for the MCP server, web app, workers and adapters |
| Database | PostgreSQL, the single source of truth |
| Database access | Plain SQL through postgres.js, with SQL migration files |
| MCP | The official TypeScript SDK over Streamable HTTP, at `/mcp` |
| Web app | React, built with Vite, with Tailwind and shadcn/ui. It compiles to static files the server serves; the approval card shown inside assistants compiles to one self-contained HTML file |
| Search | Postgres full-text search plus `pg_trgm` for names; pgvector only when semantic search is enabled |
| Queue | Postgres (`SKIP LOCKED`) |
| Space tree | Plain tables with recursive queries |
| Credentials | Encrypted in Postgres; the key is kept outside the database |
| Model access | A thin provider layer: Anthropic, OpenAI, or any OpenAI-compatible local endpoint |
| Deployment | Docker Compose: one Homing image plus Postgres. Each release publishes the image for amd64 and arm64 |

- The server code runs without a build step. Only the web app has one, and it runs when the image is built.
- One image runs every component. A setting chooses its role (everything, MCP and web, or workers), so an installation can be split later without code changes. Heavy parsing runs in worker processes.
- No Redis, search engine, vector database or graph database. One is added only if a benchmark shows Postgres falls short. For search, the fallback is a ranking extension inside Postgres, such as ParadeDB's `pg_search`, not a new service.
- Graphile Worker and pgvector are preferred, not committed, until they are tested.
- Homing is a server, even for one person. There is no embedded or single-binary variant in v1.

## Background work

Background work runs through a durable job queue in the same database. Workers run in the same deployment, which gives retries, concurrency control and recovery without microservices.

Jobs come in two kinds:

- **Internal jobs** (upkeep, indexing, extracting) run at least once and must be safe to repeat.
- **Publishing actions** (sending, posting, creating external records) run at most once. The attempt is recorded before acting. If the outcome is unknown, Homing never retries blindly: it checks the destination, or marks the action as uncertain and asks.

Each routine run is a job, recording who it acted for, which connection it used, what it did and which proposals it created.

## Data and security

**Every row is scoped.** Every stored row, including index entries and jobs, carries `space_id`, and `private_to` when it belongs to a private side. Jobs also record the person or space they act for.

**Row-level security is on from day one.** Homing decides what actions are authorized. PostgreSQL independently enforces who can access protected data. Normal requests and routines never bypass that protection.

- It uses the same access table and content visibility as the application, including the exceptions for guidance and proposals.
- A skill's files are items on its page, each with its path, so a SKILL.md folder is stored as it was imported. For now Homing keeps only text files up to 512 KB, small enough to search, and doesn't follow links.
- Each guidance item records whether it reaches down, and a read-only policy lets shared guidance through to the spaces below, closed ones included. Private guidance needs no exception, since its owner can open its space. A trigger checks every write to a guidance or skill page: it must be a person editing directly, shared guidance needs an admin, and each page holds only its own kind of item. Only the web app and the command line mark an edit as direct, so a new path can't change guidance by accident.
- One restricted database role handles normal operations. Each request or routine sets its person or space for the transaction, and background workers get no elevated access.
- A separate admin role is used only for migrations and narrowly defined housekeeping, such as deletion cascades and access-table updates. The normal role can't write the access table, and changes spaces and memberships only through database functions that check the caller's rights.
- It covers sensitive data: content, sources, credentials and search data. Purely technical tables don't need the same policies.
- The application still filters explicitly. Row-level security catches missing filters. It is not protection against a fully compromised application.

## Self-hosting

Self-hosting is part of the product, not something users piece together: HTTPS, MCP authentication, OAuth callbacks, migrations, upgrades, backup and restore. A full backup includes the encryption key. A Markdown export is not an operational backup.

Migrations run as a separate step before the server starts, so the running server never holds the admin role. Local agents such as Claude Code connect with a personal token, of which Homing keeps only a hash, and a person can revoke their tokens. Claude.ai and ChatGPT need OAuth, which comes later.

Until there is sign-in and a web app, a command-line tool sets up people, spaces and tokens, and edits guidance. It is a stand-in, not the intended way to use Homing.

The command line and the database credentials are operator access. The command line takes any person's id without sign-in, and any connection with the credentials can mark itself as a person editing directly, so either can act as anyone, including changing guidance. An agent that can run commands where Homing runs, such as Claude Code on the same machine, has that access too. Once there is sign-in, a direct edit needs a signed-in person, and the command line keeps only what setting up an instance needs.

## Toward a hosted version

Homing is designed so it could run as a managed service, without building that in v1. Roots are organizational boundaries, not tenant isolation. A hosted service would also need identities, credentials, storage, indexes and execution kept separate per tenant.

## Open

- A built-in OAuth authorization server, or a delegated identity provider.
