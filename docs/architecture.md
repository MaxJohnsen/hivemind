# Architecture

How Hivemind is built. The behavior it must have is in the [specification](spec.md). This document can change without changing the concept.

## Shape

Hivemind is a modular monolith: one deployment with a transactional database, derived indexes, background workers and optional model inference. External agents stay independent and use Hivemind through MCP.

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
| Search | Postgres full-text search plus `pg_trgm` for names; pgvector only when semantic search is enabled |
| Queue | Postgres (`SKIP LOCKED`) |
| Space tree | Plain tables with recursive queries |
| Credentials | Encrypted in Postgres; the key is kept outside the database |
| Model access | A thin provider layer: Anthropic, OpenAI, or any OpenAI-compatible local endpoint |
| Deployment | Docker Compose: one Hivemind image plus Postgres |

- One image runs every component. A setting chooses its role (everything, MCP and web, or workers), so an installation can be split later without code changes. Heavy parsing runs in worker processes.
- No Redis, search engine, vector database or graph database. One is added only if a benchmark shows Postgres falls short. For search, the fallback is a ranking extension inside Postgres, such as ParadeDB's `pg_search`, not a new service.
- Graphile Worker and pgvector are preferred, not committed, until they are tested.
- Hivemind is a server, even for one person. There is no embedded or single-binary variant in v1.

## Background work

Background work runs through a durable job queue in the same database. Workers run in the same deployment, which gives retries, concurrency control and recovery without microservices.

Jobs come in two kinds:

- **Internal jobs** (upkeep, indexing, extracting) run at least once and must be safe to repeat.
- **Publishing actions** (sending, posting, creating external records) run at most once. The attempt is recorded before acting. If the outcome is unknown, Hivemind never retries blindly: it checks the destination, or marks the action as uncertain and asks.

Each routine run is a job, recording who it acted for, which connection it used, what it did and which proposals it created.

## Data and security

**Every row is scoped.** Every stored row, including index entries and jobs, carries `space_id`, and `private_to` when it belongs to a private side. Jobs also record the person or space they act for.

**Row-level security is on from day one.** Hivemind decides what actions are authorized. PostgreSQL independently enforces who can access protected data. Normal requests and routines never bypass that protection.

- It uses the same access table and content visibility as the application, including the exceptions for guidance and proposals.
- One restricted database role handles normal operations. Each request or routine sets its person or space for the transaction, and background workers get no elevated access.
- A separate admin role is used only for migrations and narrowly defined housekeeping, such as deletion cascades and access-table updates. The normal role can't write the access table.
- It covers sensitive data: content, sources, credentials and search data. Purely technical tables don't need the same policies.
- The application still filters explicitly. Row-level security catches missing filters. It is not protection against a fully compromised application.

## Self-hosting

Self-hosting is part of the product, not something users piece together: HTTPS, MCP authentication, OAuth callbacks, migrations, upgrades, backup and restore. A full backup includes the encryption key. A Markdown export is not an operational backup.

## Toward a hosted version

Hivemind is designed so it could run as a managed service, without building that in v1. Roots are organizational boundaries, not tenant isolation. A hosted service would also need identities, credentials, storage, indexes and execution kept separate per tenant.

## Open

- Web framework and database query library.
- A built-in OAuth authorization server, or a delegated identity provider.
