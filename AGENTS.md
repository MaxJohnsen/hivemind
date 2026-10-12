# AGENTS.md

Guidance for AI agents working in this repository.

## What this repository is

Hivemind is being designed, so for now the documents are the product. Each one has a job:

- `README.md` makes people interested. It starts with the problem.
- `docs/concept.md` explains the idea in plain language, without technology.
- `docs/spec.md` defines the behavior and guarantees, without technology.
- `docs/architecture.md` describes how Hivemind is built.

Keep that separation. Implementation details never go in the concept or the spec.

## How we write

This repository should read as if people wrote it for people.

- Write as little as needed. Cut whatever doesn't help the reader.
- Lead with the problem or the point, then the detail. Nuance goes one level down: README, then concept, then spec, then architecture.
- Use plain words. No buzzwords, hype, inflated claims or long feature lists.
- Prefer short paragraphs. Use lists and tables only where they help, and don't open every bullet with a bold label.
- Avoid em dashes.
- Use American English.
- Say what Hivemind is designed to do. Don't claim it works before it is built.
- Present conclusions, not the discussion that led to them.
- Link any claim about another project to its source.

## Changing the design

- The concept is deliberately stable. Add a concept only when implementation shows a real limitation.
- Record decisions in the spec, keep the concept, spec and architecture consistent, and remove anything a new decision makes stale.
- `notes/` holds unpublished research. It is ignored by git, and its content never goes into `docs/` without being checked and rewritten.
- Commits follow Conventional Commits: `type(scope): subject`.
