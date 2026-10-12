# Prior art

Hivemind builds on ideas that already work. This page credits them and says where Hivemind goes further.

## What we learned from

**Karpathy's LLM Wiki.** An agent compiles raw sources into a Markdown wiki and keeps it current, instead of re-deriving answers every time. Hivemind's knowledge pages follow this idea. Its known weakness, pages that drift after many rewrites, is why Hivemind ties every item to its sources and never rewrites text from its own previous version.

**Open Knowledge Format.** Google's portable Markdown format for that kind of wiki, with provenance and free-text page types. Hivemind's export aims to be compatible.

**CLAUDE.md and AGENTS.md.** Instruction files that cascade down a folder tree. Hivemind's guidance inherits the same way, but resolves conflicts by rule instead of leaving them to the model.

**Agent Skills.** The SKILL.md format for reusable instructions. Hivemind stores skills in that shape and exports them as they are.

**Model Context Protocol.** The standard way agents reach tools, and Hivemind's only required interface.

**Agent memory systems** such as mem0, Letta, Zep, Basic Memory and OpenViking. Together they showed that Markdown with a rebuildable index works, that outdated facts should be superseded rather than deleted, and that privacy has to hold in every index, not just the main one.

**Guru and GitHub Copilot Memory.** Knowledge stays trustworthy when it is verified, cited and allowed to expire.

## Where Hivemind goes further

We haven't found a system that combines three things:

- shared knowledge with a private layer for each person,
- deliberate, authorized sharing from private to shared,
- guidance that inherits down a deep tree of spaces.

The pieces exist separately. Hivemind's bet is that they belong together.
