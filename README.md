# Hivemind

AI assistants are good at helping with a single task. They are bad at knowing your work: which project you're in, how things are done there, what was decided last week. That understanding ends up scattered across folders, chats and tools, and every assistant starts from scratch.

Hivemind is an open-source home for that working context. It works with whichever assistant you use.

## Why

If you use AI assistants for real work, some of this will be familiar:

- Each client or project has its own folder of instructions, and they slowly drift apart.
- A colleague's assistant knows things yours doesn't, and there is no safe way to share.
- What your assistant learned last month is either gone or quietly out of date.
- You want help across everything you do, without one client's information ending up in front of another.

## How it works

Your work is organized into spaces: a client, a project, a team, a family. A space holds four things:

- **Guidance:** the rules and skills agents follow there.
- **Knowledge:** what is known, kept current from emails, meetings and documents.
- **Records:** tasks and events, wherever they actually live.
- **Routines:** work that should happen on its own.

Every space has a shared side for its members and a private side for each of them. Agents learn on your private side automatically. Nothing reaches other people unless that sharing is authorized, and only people can change the rules agents follow.

> Hivemind learns automatically, shares deliberately, and changes behavior consciously.

Agents connect over MCP, so Hivemind works from Claude, ChatGPT, Copilot or Claude Code. It runs on your own server, and it is useful without an AI model of its own. Connecting one lets it learn in the background.

## An example

You're a consultant with three clients. On Monday you ask your assistant to plan the week. It sees the deadlines in all three clients' task systems and in your calendar, and drafts a plan only you can see.

Later, one client emails to move a launch date. Hivemind updates that project's knowledge on your private side, notes where the new date came from, and asks whether your colleague on the project should know too. Your other clients never see any of it.

## Status

Hivemind is being designed in the open. The concept and the specification are written. The implementation has not started.

## Read more

- [Concept](docs/concept.md): how Hivemind works, in plain language. Start here.
- [Specification](docs/spec.md): the guarantees and the detailed behavior.
- [Architecture](docs/architecture.md): how it is built.
- [Prior art](docs/prior-art.md): what already exists, and what we learned from it.

## License

[AGPL-3.0](LICENSE). Please read [CONTRIBUTING](CONTRIBUTING.md) before opening a pull request.
