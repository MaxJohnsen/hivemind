# Hivemind: specification

*How Hivemind must behave: the guarantees it makes, the decisions behind them, and what is still open. It builds on the [concept](concept.md). How it is implemented is in the [architecture](architecture.md).*

---

## Guarantees

Hivemind guarantees the following for everything that passes through it, whatever the implementation. It cannot control what external agents do on their own.

1. **No silent publishing.** Hivemind never publishes to an unauthorized audience. This applies especially across clients. Publishing actions run at most once: an action whose outcome is unknown is never retried blindly.
   - For Hivemind's own routines it holds by construction: runs are scoped before they start, and content carries its sources (§8, §4).
   - For external agents, Hivemind checks every action performed through it and shows the exact change for approval when it isn't already authorized. It cannot know what an agent saw elsewhere.
2. **Every operation is checked for permission,** whatever the model asks for. A cross-client leak test is a release test: two people in different client spaces, with shared and private knowledge, attempting cross-client reads and writes through every storage path. The test runs both through Hivemind and directly against the database with the application's filters bypassed, so the database is shown to refuse on its own.
3. **Untrusted input is contained by limiting what the agent can do,** not by trusting how it reads the input.
4. **Only humans change guidance.** Ingested content can never change rules, skills or permissions. This is enforced in the store, on every write path, and requires explicit human authorization (a direct edit by an authorized person, or an approved proposal), not just a human identity.
5. **Credentials never reach the model.** Personal connections are never shared, and Hivemind never silently switches to another identity.
6. **Mandatory guidance is never dropped** to fit a size budget.
7. **Provenance is kept.** Everything records where it came from: its sources, or the person or agent who wrote it. Derived text cites its sources, and content with unknown sources never publishes automatically.
   - When a source has to be deleted, its excerpts go, including from history, along with every content item that rests only on it.
   - Synthesized prose that depended on the source is flagged for regeneration.
   - Facts and text written by people are never silently overwritten.
8. **Records stay authoritative where they live.** Changes go back to the record's home system. Private annotations are never written back. The source system's permissions are always respected.
9. **Hivemind is fully usable through MCP alone.** Every write names an explicit destination.
10. **Spaces are portable.** A space's knowledge structure survives export and re-import intact, and this round-trip is a release test. Credentials and live external records are not included in an export; connections have to be set up again.

---

## 0. Foundations

**Decided**
- **Deterministic code enforces the rules; models interpret.** Permissions, inheritance, publishing, storage, search, matching known identities and applying upkeep operations are plain code. Extracting knowledge, proposing upkeep, resolving ambiguous routing and part of contradiction detection use a model.
- **Model access is configurable and optional.**
  - Set up through a single question: which AI provider should Hivemind use for background learning (Claude, OpenAI, a local model…)? Cost and data-handling controls are part of that setup.
  - The deployment sets a default, and a space can override it, for example with "no model processing" for confidential spaces.
  - Deterministic identifier matching runs before any model. A source that matches a space with no model processing is never sent to a model. A source from an unknown sender is processed under the setting of the space where it lands, usually your personal space. That limit is stated plainly.
  - Self-hosting Hivemind does not keep data local if the model is an external API. The setup says so plainly.
  - "No model processing" only controls Hivemind's *own* inference. It does not stop external assistants from processing the space's information.
- **The core works without any LLM.** Guidance inheritance and context assembly are deterministic. Knowledge is written and read through MCP. Search needs no embeddings. People and external agents maintain the knowledge. No model credentials are required.
- **Optional capabilities are independent.** Each one adds to the core, none depends on another, and any combination works:

  | Capability | Adds |
  |---|---|
  | Connections | Live records, planning across systems, actions |
  | Model | Background learning: extracting knowledge, upkeep, triage, ambiguous routing |
  | Client integrations | Automatic context loading and session capture |
  | Routines | Scheduled and event-driven work |

  Without a model, Hivemind learns only through agents (`remember` during work).
- **Distribution:**
  - Open source under AGPL-3.0, and self-hosted first.
  - The same codebase can run privately or as a managed cloud service, with the same features and APIs. Hosting is a convenience, never a dependency.
  - The intent is that every feature stays open. That is a governance decision, not an architectural rule.
  - Contributors sign an agreement that allows relicensing, so commercial licensing stays possible ([CONTRIBUTING](../CONTRIBUTING.md)).
  - Self-hosting is part of the product: HTTPS, authentication, upgrades, backup and restore work out of the box ([architecture](architecture.md)).
- **Instances are independent but interoperable.** Content from another instance stays authoritative at its source and is never copied over automatically. There are three approaches:

  | Approach | When |
  |---|---|
  | **Several MCP servers in one assistant**, where the agent connects to each instance directly | Works in v1. Each instance's context stays separate. |
  | **Your Hivemind as your personal gateway**: "connect another Hivemind" once, then search, context and records work across instances on demand, with no syncing | The destination, but later. One entry point gives unified search and planning. |
  | **True federation**: instances exchange or synchronize knowledge, identities and updates | Postponed, if ever. |

  - **Each instance resolves its own part.** The remote instance resolves its own chain of guidance for you, including its requirements. Your instance then layers your personal guidance and your private notes on top. Your private notes stay on your instance, as a link to the remote space. Precedence works as usual, so the remote space's rules beat your defaults.
  - **The remote instance enforces its own permissions and publishing.** Each connection to another instance needs its own authorization, and tokens are never forwarded.
  - **Sharing rules still apply.** Whatever is learned from a remote instance is a source like any other: private unless sharing is authorized (§4). Guidance from another root never silently becomes global.
  - **Identifiers are qualified by instance** from day one, so any space can be referenced unambiguously across installations.

## 1. Context assembly · critical

**Decided**
- **Progressive context.** Every `context` call returns a stable **core**. When the purpose is known, it also returns a **relevant layer**. Full details are available on demand.

  | Layer | Contents |
  |---|---|
  | Core (stable for a person in a space until something changes) | Identity and role, the rules that apply, the space overview (its summary and its map of active pages, §3), and a skill index |
  | Relevant (adapts to the request) | Relevant pages, decisions, records, recent changes, the skills that apply, pending proposals and other important items |

- **Resolve, then assemble, in a single call.** `context` takes a free-text request and, optionally, a space. If the space isn't known, Hivemind first works out the people, messages, records and topics involved, using the same matching as routing. If more than one space fits, it returns the candidates. If a source isn't indexed yet, it is queried live within a strict time limit.
- **Local assembly never waits on external systems.** Guidance, overviews and indexed knowledge are assembled locally. Live lookups (external records, unindexed sources) go through `search` and `read`, or run within a strict time limit. The two are measured separately.
- **Retrieval is helped by structure but never depends on it.** Candidates come from relationships and from content search in parallel, and are ranked together. Retrieval must still work when links are missing or wrong.
  - Access is a mandatory filter, never a ranking signal.
  - Relevance is the main ranking signal.
  - Relationships, authority, freshness, how close the space is, and recency adjust the ranking. None of them is absolute.
  - Archived spaces and pages, and superseded items, are left out by default. They are included when the request is about them or about the past.
- **Untrusted content is marked** in responses, for example a client's email.

**Open**
- Should effective guidance be precompiled for each person and space, and how should that be invalidated?
- What should the default context budget be?

## 2. Guidance · critical

**Decided**
- **Guidance is stored as pages and content (§3).** It shares storage, history, visibility per item, editing, search and export with knowledge. It has its own rules for authorization, reach and loading.
  - **Two reserved page types (§3), fixed when the page is created:**
    - A **guidance page**: each space has one. It holds the space's rules, one item per rule (requirement or preference, optionally *only here*), and exports as AGENTS.md.
    - A **skill page**: its instructions plus its files (references, scripts) as items. It exports as a SKILL.md folder and can be served as `skill://` resources.
  - Rules are evaluated for applicability and precedence, and applicable requirements always load. Skills are selected by relevance.
  - Includes are links on a guidance page.
- **Only people write guidance, enforced in the store.** Every write to a guidance or skill page goes through one check: its content, its files and its settings (strength, *only here*, inheritance).
  - The check requires explicit human authorization, not just a human identity. Agents act as you through MCP, so your identity alone doesn't show that *you* decided.
  - A write passes only as a direct edit by an authorized person in a human channel (the web app), or as an approved proposal (§4).
  - It covers imports, MCP actions, background workers and any future path by construction, instead of relying on a list of protected paths.
  - Agent writes become proposals. Even when you ask an agent to add a rule, you confirm the exact text.
- **Who changes guidance:** shared guidance is changed by the space's admins, and other members can propose changes. Private guidance is changed by its owner.
- **How guidance flows:**
  - Guidance applies to its own space and everything below it, unless it is marked *only here*.
  - Inherited guidance reaches everyone in a child space, including people who can't access the parent.
  - A closed space blocks inherited membership, not guidance.
  - Personal-space guidance follows the person everywhere. This applies only to the personal space's own guidance; spaces under it behave like any other space.
- **Including guidance:** an include expands only for readers who can access what it points to. Including something never grants access to it.
- **Precedence:**
  - The more specific rule wins.
  - Between two rules that are equally specific, the private one wins.
  - Personal-space guidance counts as the least specific.
  - Requirements always apply. If two requirements conflict, only the affected action is blocked, and both rule owners are notified.
- **Conflicts** are detected in two places: obvious ones when a rule is saved, the rest when guidance is evaluated at execution time.
- **Versions:** guidance is always live, with no pinning. History and rollback are kept, and each run uses one consistent snapshot.
- **Guidance improves from use, not schedules.** Three things trigger a proposed change:
  - a correction (if it's unclear, the agent asks "just this time, or always?"; "always" becomes `act guidance.propose` with the exact text, which you confirm, so this works from any MCP client);
  - a contradiction with knowledge;
  - repeated failures.

  Agents propose changes and humans decide. Hivemind may learn to *propose less* without asking.

## 3. Knowledge engine · critical

**Decided**
- **Knowledge should be structured only as much as necessary to maintain, retrieve and share it reliably.**
- **Three concepts:**

  | Concept | Responsibility |
  |---|---|
  | **Source** | Where knowledge came from: a reference, permitted excerpts and audience. It may arrive from a place (§6), through your own connection, from an agent's report, or as evidence you supply directly |
  | **Page** | The subject the knowledge belongs to, in one space. It has a free-text type (person, decision, meeting…), as in OKF; guidance names the types a space prefers |
  | **Content** | The knowledge itself, as Markdown. Each item has its own visibility (`private_to`), sources, author (a person or an agent), protection and history, and can be marked superseded (by which item, and when) |

  - Claim extraction, fact keys and automatic dependencies between content items are not part of v1. Optional keys can be added later if real workflows need them.
- **One logical page per subject, with visibility per content item.** Each person sees one assembled page: the shared content plus their own private content, with no trace of anyone else's private content.
  - The page itself has no side. Everything shown about it, including its title and overview, is built only from content the viewer can see, so a private page doesn't show up in search, links, counts or suggestions.
  - One page per subject is the goal, not a guarantee. Duplicates are safer than wrong merges.
- **Small items where useful.** Anything that can go out of date, such as a date, owner, status, decision, commitment or contact, is written as its own item with its own sources, so it can be updated on its own. Prose such as background, reasoning or a description of a client's culture isn't split up artificially. Agents choose sensible boundaries. Ideas are marked as ideas.
- **`published_from` is lineage, not synchronization.** Shared content records the private content it was published from. When the private content changes, Hivemind can suggest an update. It never changes what others see by itself.
- **Hivemind continuously improves how knowledge is organized and presented, while keeping its meaning grounded in original evidence and preserving useful history.**
- **When a page is created:** when guidance names its type ("client contacts"), when a person asks, or when the agent judges that someone would look the subject up by name. A subject coming up again is a signal, not a rule.
  - A person who only appears in sources doesn't get a page until they're relevant enough to remember. Until then, their addresses stay in the sources' metadata, which remains searchable. A mailbox with 20,000 contacts doesn't produce 20,000 pages.
- **Knowledge without a home stays in its source.** Excerpts stay searchable. When a subject later earns a page, the page is built from those sources. Nothing is dumped on the overview.
- **The overview is a map, not a container.** It holds a short summary of the space's current state, plus a list of its active pages that Hivemind generates from page data. It is never an index written by an agent.
- **Upkeep is a fixed set of operations.** The agent doing the upkeep (Hivemind's model, or an external agent when no model is configured) proposes operations. Hivemind applies them itself, checking permissions and protection and recording history. Every operation preserves visibility and provenance, and every operation can be undone.

  | Operation | Behavior |
  |---|---|
  | Write or update an item | From evidence. New evidence updates only the items it affects, and the agent finds those items itself; there is no automatic dependency chain |
  | Supersede an item | When evidence justifies it, such as an explicit change or a decision by someone with authority. The old item is kept as "was true until…". Newer isn't automatically right: when that's unclear, both items are marked uncertain |
  | Improve wording or structure | For items written by agents. Allowed, but always regenerated from the item's sources, never from its previous text alone, so errors can't compound |
  | Combine duplicate items | Keep one, citing both sources |
  | Create a page, move items, split a page | Only items written by agents. Text written by a person stays where it is and gets a link |
  | Mark pages as the same subject | Automatic when identifiers match. Otherwise the pages are marked "possibly the same" |
  | Archive a page | Only with evidence that it's no longer active, such as a completed project or someone who has left. Age alone is not evidence |

- **Upkeep happens at two moments:** when new evidence arrives (targeted updates), and in a periodic tidy pass per space that handles splits, duplicates, contradictions and inactive pages. The space's routine tidies the shared side, and each owner's routine tidies their own private items.
- **Archiving removes finished work from everyday attention without losing its history.** Archiving is never deletion.

  | Level | How it is archived | Effect |
  |---|---|---|
  | Space | By a person (agents can suggest it); its children are included | Out of daily context, routines and upkeep paused, still searchable, can be reopened |
  | Page | By upkeep, with evidence that it's no longer active | Out of the overview and default context, still searchable |
  | Item | By being superseded | Context shows what's true now; `read` shows the history ("Gunnar, project manager 2027–2029") |

  Not being relevant right now isn't a state, because ranking handles it. Stable knowledge isn't obsolete: a page about Gunnar can stay current for five years without changing.
- **Text written by people is protected.** Agents can flag it or propose changes, but never rewrite it.
- **Relationships** come from explicit links between pages, not from things simply appearing together.
- **History keeps the same boundaries.** Every revision carries the same visibility as its content. Deleting a source also removes its excerpts from history.
- **What is stored:** knowledge, not conversation history. The default is a reference plus an excerpt. A copy is kept only when it is necessary and permitted.
- **Conflicts:** conflicting information is marked as uncertain, never silently resolved.
- **Storage:** content is Markdown, backed by a database. Sources, pages, content, links, revisions and permissions are stored transactionally. There is one authoritative store, and nobody edits its files directly.
- **People are accounts or pages.** There is no contact database and no global person registry.
  - A **Person** is a Hivemind account. Its own identifiers are the ones its provider verifies (connecting Gmail proves control of that account, not of every alias) plus any the person confirms. Addresses only observed in messages are suggestions.
  - **Everyone else is a page,** like any other subject.
- **Identifiers are content items with a structured value:** system, tenant, type and value, for example `slack · acme-workspace · U123`. They are the one structured key in knowledge, because deterministic matching and routing depend on them (§0).
  - They are indexed for matching, and visibility is enforced *during* matching. A private phone number never helps anyone else identify Gunnar.
  - Provenance comes from content. The strength of a match comes from the identifier's type, so no confidence field is needed.
- **Identity is resolved conservatively:**
  - Unambiguous IDs within the right system and tenant match automatically.
  - Email is a strong signal, not proof. Names and roles are weak signals and are not identifiers.
  - Uncertain matches stay separate.
  - **Merging is logical.** Pages marked as the same subject are assembled and shown as one page to anyone who can see both. Nothing moves, so private items and history are untouched, and removing the link undoes the merge. There is no physical merge.
  - Knowledge is never combined across spaces. Pages in different spaces that share an identifier are linked only for people who can access both spaces.
  - Duplicates are tolerated.
- **Export:** an open bundle, compatible with OKF where possible, containing pages, content, sources, links, stable IDs and history.

**Open**
- How is it tracked that a source is still available and still permitted?
- How should the active-knowledge routine work: finding gaps, then investigating them on the user's private side?

## 4. Permissions and sharing · critical

**Decided**
- **Knowledge is shared with spaces, not with individual members.** Once something is published, current and future members see it.
  - Adding a member is a sharing decision, and it is made explicit in the UI.
  - A group that needs restricted history uses a separate space.
  - A new member sees the knowledge, but not the original sources.
- **The access rule.** Everything that lives in a space carries `space_id` and `private_to`. An empty `private_to` means the shared side.
  - You can see something if you can access its space and it is either shared or private to you.
  - **The one exception is guidance (§2).** Each shared guidance item is also visible in every space it reaches below its own. This applies per item, never to the whole guidance page, so private and *only here* items stay where they are. Private guidance reaches down only for its owner. Knowledge never reaches down. The exception is part of this rule, so `context`, `search` and `read` always agree, and includes can never get around it.
  - Access is derived from memberships, parents and closed spaces into an access table. The table is updated in the same transaction as any change to them, so removing someone takes effect immediately.
  - Every query, search and job checks against this table.
- **Publishing never changes the audience of evidence.** Sources stay where they are, and knowledge is published from them.
  - Publishing creates or updates shared knowledge, which stays linked to its private origin.
  - Other members see who published it and when. They don't see the source, its sender or its subject. Full provenance stays internal. A source that is itself shared is cited normally.
  - When the private evidence changes, the shared knowledge is not updated silently. The publisher gets a proposal, unless a binding already authorizes the update.
  - In your own context, the private and shared versions show as one while they agree. When they differ, you see the difference.
  - Things you wrote yourself, such as a note or a draft page, move to the shared side when you share them.
  - **Publishing checks the content's sources, not just who publishes.** Content citing sources that the destination's audience isn't authorized for never publishes automatically, and the approval names them, for example "includes information from Beta". Content with unknown sources never publishes automatically. Because provenance travels with the content, the check still holds weeks later, when a suggestion is accepted.
- **External agents:** Hivemind controls access to information, and the actions performed through it. It cannot control what independent agents do outside it, and it doesn't pretend to.
- **Your personal tree is private.** Spaces you create under your personal space are only yours.
  - Nobody else can be granted access to them.
  - Everything in them lives on your private side.
  - Hivemind never suggests sharing there.
  - Creating a space asks: "Just me, or with others?"
- **Making a space collaborative** is an explicit conversion. Inviting someone to a space in your personal tree triggers it, and it can also be started directly. It:
  - takes the space and everything under it out of your personal tree, either as a new root or under a shared space you choose;
  - shows who will gain access;
  - keeps all existing content on your private side, so nothing becomes visible through the conversion;
  - keeps what flows from bound places private until sharing is declared;
  - lists the guidance that will stop applying, and offers either to add it to the space (shared with its members) or to include it (applies only to you);
  - keeps a link to the former parent, visible only to you;
  - offers to prepare suggested shared knowledge for review.
- **Hivemind learns privately by default and shares automatically when authorized. It only interrupts you when a deliberate sharing decision is needed.** There are two kinds of interruption:
  - **Approval:** something is about to reach people who aren't authorized yet.
  - **Suggestion:** private knowledge would genuinely help the space. This happens in every ordinary space, even one with a single member, because a space's shared side serves current and future members. It never happens in your personal tree.
- **Audience helps Hivemind understand information. Authorization determines whether Hivemind may share it.**
  - A source's audience is who could see it in its own system. Each adapter reports it when it can: the visible recipients of an email, the members of a channel or DM, the attendees of a meeting. Otherwise it is unknown, and the content stays private to whoever connected or supplied it.
  - Audience alone never authorizes sharing, even when everyone in a space could already see the source, because the shared side also serves future members.
  - Audience is used to make suggestions useful ("Ola was on this thread") and to detect material changes.
- **Ask once for a clearly defined sharing scope, not once per fact.** For a thread or channel, the choice is:
  - **Share what's there now:** a one-time approval of the current content. This is the default.
  - **Keep sharing from it:** binding the thread as a place. This is an explicit, ongoing and revocable authorization with the same declaration as any binding.
  - If a bound source's audience changes materially, for example a new participant from another organization joins the thread, the flow pauses and asks again.
- **Binding a place** (a mailbox folder, a channel, a drive folder, or a single thread) to a space authorizes learning from the sources that arrive there and, when permitted, publishing what is learned. You bind a place, not an individual source. A thread is a place, because it keeps receiving new messages; a single email or document is a source. It requires all three of:
  1. access to the place;
  2. admin rights on the destination;
  3. an explicit, recorded declaration that sharing with current and future members is authorized.

  Bindings that cross organizations get a stronger warning. Without the declaration, ingestion stays private. Scopes are preferences for what to extract, not security boundaries.

  A binding authorizes ongoing sharing within its place. It is not a blanket waiver: it never overrides restrictions a source carries (for example a sensitivity label or a "do not forward" marking reported by the adapter), and a material change in audience pauses it.
- **A proposal is an exact change awaiting the authorization required to execute it. Approval never grants permissions the approver doesn't have.** One concept covers guidance changes, sharing suggestions, publishing approvals, updates to published knowledge and the catch-up when a space becomes collaborative.
  - A proposal holds the **change** (exactly what will happen), **why** (a correction, evidence, an agent), its **deciders** and its **state** (open, approved, rejected, expired).
  - **Approving executes exactly what was shown.** If the underlying thing changes first, the proposal is shown again. Actions run at most once (guarantee 1).
  - **Every boundary the change crosses needs its own authorization,** possibly from different people. Publishing your private knowledge to Acme needs your consent to disclose it and the right to publish in Acme. The owner approves disclosure first, so nobody else sees private content before its owner has agreed.
  - **Only the proposer and the deciders can see a proposal.**
  - **Direct edits don't go through proposals.** An authorized person editing in the web app simply saves. Both paths use the same validation and are recorded in the same history.
- **Approvals are the exception, not the routine:**
  - They appear where you work: inline in chat, otherwise in an inbox and a daily digest.
  - **An approval only counts when it comes through a channel the agent can't speak for:** the web app, a form shown by the client (MCP elicitation), or a link you open. An agent saying "the user approved" is never an approval. This applies to every approval, including publishing and guidance.
  - Each one shows what, to whom, and where it came from.
  - They are grouped by destination, and each item can be excluded individually.
  - If nobody answers, routine knowledge stays private, important items surface in context, and actions never run.
  - **Two kinds of advance permission:** a **binding** pre-approves *knowledge* flowing from a place into a space. A **standing authorization** pre-approves a clearly defined kind of *action*, for example replies within one thread or tasks in one Asana project. An authorized person can create either one directly in the web app; when an agent suggests one, it becomes a proposal. Both paths are recorded the same way. Both kinds can be revoked, and agents suggest them only when they can be clearly defined.
  - Approval fatigue is tracked as a metric.

**Open**
- Audience reporting for systems beyond email, chat and meetings (Asana, Drive, …). These start as unknown.
- If a private source is deleted, does knowledge published from it stay, flagged "source removed", or go too (guarantee 7)? Leaning towards stay, because a person vouched for it.

## 5. MCP interface and clients · critical

**Decided**
- **Five tools to start with, to be benchmarked:**

  | Tool | Purpose |
  |---|---|
  | `context` | Resolve the space and assemble context, including pending proposals that matter here |
  | `search` | Search everything the user is authorized to see |
  | `read` | Get details, including action schemas, proposals and skills |
  | `remember` | Create or update your private state inside Hivemind: knowledge, notes, annotations, identifiers and private tasks |
  | `act` | Change an external system, publish, or make a governed change: `mail.send`, `asana.create_task`, `knowledge.publish`, `guidance.propose`, … |

- **`remember` manages your private Hivemind state. `act` performs external operations, publishing and governed changes.** The line is where the change happens and whom it affects. Examples:
  - "Remember to follow up with Gunnar on Friday" → `remember` creates a private task. Marking it done is also `remember`.
  - "Create that task in my private Asana project" → `act`, because it changes an external system.
  - "Share the deadline with Ola" → `act`, because it publishes.
  - "Always format my reports this way" → `act guidance.propose`.
- **`remember` is approval-free, not permission-free.** It can't overwrite text people wrote, change guidance, or write to anyone else's private side.
- **Every write can cite sources,** and should. Content with unknown sources never publishes automatically (§4).
- **`act` returns one of three outcomes:** done, waiting for approval (with a client-shown form or a link) or blocked. Approval is never a tool.
- **Connections bring capabilities** through adapters. Adding a system adds actions, never tools. `act` validates arguments, authorization and approvals.
- **Working or publishing depends on effect, not on the name.** A draft in a shared mailbox counts as publishing.
- **The outbound identity is resolved,** either from your preference or by asking. It is never assumed from the space.
- **Client experience levels** (how well the agent client uses Hivemind):
  1. MCP only: works whenever the client calls the tools.
  2. MCP plus one recommended instruction: more consistent.
  3. Native integration: context loads reliably, and sessions are captured through hooks.
- **Conversations** are learned from automatically at level 3, unless the user says "don't keep this". Otherwise they are learned from through `remember`. Hivemind keeps the knowledge, not the transcript (§3). Background learning never depends on the chat client.
- **Space detection** is a suggestion that asks when it's ambiguous. Git remotes are hints. There is no hidden "current space".
- **No required repository structure, no local workspace, no separate chat app.** Prompts and MCP Apps are enhancements only.
- **Remote clients connect through OAuth.** Claude.ai and ChatGPT need Hivemind at a public HTTPS address and authorize through OAuth, so Hivemind acts as an OAuth authorization server or delegates to an identity provider. An install that is reachable only locally can serve those clients only through a tunnel.

**Open**
- How should client integrations be designed, starting with a Claude Code plugin?

## 6. Connections · high

**Decided**
- **Two concepts:**

  | Concept | What it is |
  |---|---|
  | **Connection** | A key: credentials for one account in one system. It belongs to a person, or to a space for shared automation. It's encrypted and never visible to a model. |
  | **Place** | A space's pointer to where things live: system, tenant and resource, for example "Acme's Asana, project Website". A place can be bound to its space (§4). |

- **Places are matched to keys automatically,** using stable IDs (system, tenant, resource) and a per-action check: *can this connection perform this action here?*
  - The match order is: your own connection, then an authorized space connection, then ask.
  - One connection can serve many spaces, and one space can use many connections.
- **Connection status is informative.** A missing connection is shown when it matters and never blocks other work.
- **Hivemind never needs exclusive control of an integration to benefit from it.** Agents can bring their own access, such as an organization's connectors, with no mode switch:
  - What they report back is recorded as agent-reported and stays private.
  - Context says plainly what Hivemind can and can't reach.
  - Only background work that Hivemind performs *itself* needs a Hivemind key.

**Open**
- How does OAuth to external systems work across tenants? (Credential storage is described in the [architecture](architecture.md).)
- Which adapters are needed: APIs, MCP client, local bridges (for example iMessage on a Mac), webhooks?
- How should the screens work: one Connections screen, plus status shown in each space?

## 7. Records · high

**Decided**
- **Every record lives in one system, behind one record interface.** Hivemind's own native tasks are one system and Asana is another. Designing the interface for two systems from day one keeps it from becoming Asana-shaped.
- **Native tasks are deliberately minimal,** so Hivemind can capture actions without another product ("follow up with Gunnar on Friday"):
  - title, description, status (open or done), an optional due date, an optional assignee (one person), space and visibility, and optional provenance;
  - recurrence, reminders, multiple assignees and project-management features are not part of v1.
- **External records are read live, helped by a cache, with no mirror in v1:**
  - They are read through a connection that can reach the place.
  - The cache is short-lived and reused only through the same connection. Hivemind's own access check runs before anything is served from it, so someone removed from a space gets nothing. Permission changes made in the external system are bounded only by the expiry, and no cache can do better without checking live.
  - When a system is unavailable, the cached data is shown together with its age.
- **Annotations** are your notes on any record: content items attached to a record instead of a page (§3), with the same visibility, history and protection. They are never written back.
- **Freshness is shown honestly,** not promised to be perfect. Binding a place does not settle record permissions, because those can differ per item.
- A persistent index is an optional optimization for later.

**Open**
- Which write operations come first, and in what order?
- Calendars: availability views, opt-in mirroring of "busy" blocks, and what event titles might disclose.
- The planning skill: deadlines, priorities, effort, availability, dependencies, private notes.

## 8. Routines, agents and routing

**Decided**
- **There are two kinds of routine:**
  - **System routines** are built in and part of v1, and they're critical: capturing from connected sources, routing, triage and knowledge upkeep. They run in Hivemind's own runner, and they are what "learns automatically" depends on.
  - **User routines** come later. These are user-defined jobs ("a status report every Friday"), external triggers and pluggable runtimes.
- **Routine definitions live in Hivemind:** owner, trigger, skill, space and output. Each run is recorded with who it acted for, which connection it used, what it did and which proposals it created.
- **Every routine belongs to a person or a space. There is no system identity.**
  - A routine works within its owner's current permissions, checked at every operation (guarantee 2), not just when a run starts.
  - Every external action uses a specific authorized connection. The owner is a person or a space; the connection is the account that actually acts.
  - It acts automatically within authorization a person has already granted. Outside that authorization it creates proposals. A routine can never approve anything or expand its own authority.
  - It never inherits.
- **Person routines** use only that person's connections and access. If the person loses access to a space, the routine stops acting there, routing falls back to their personal space, and they are notified.
- **Space routines** use only the space's connections and bound places. They never read anyone's private side or use a personal connection: if an automation needs your mailbox, it belongs to you. They keep running when members leave, and the space's admins are accountable for them.
- **System routines are ordinary routines.** Capturing from your mailbox is a routine you own, created when you connect it. Capturing from a bound place through a space connection is owned by the space.
- **Housekeeping is not a routine.** Indexing, deletion cascades and cache expiry are deterministic code. They use no connections, never publish, and run under row-level security like everything else. Only narrowly defined housekeeping uses elevated database access ([architecture](architecture.md)). Knowledge upkeep (§3) is a routine, because it interprets content. Anything that uses a connection, or interprets content with a model, is a routine with an owner. Embeddings follow the space's model setting (§0).
- **Triggers can come from anywhere:** Hivemind's schedule, connection events, or an external scheduler that calls "run routine X". Hivemind orchestrates (triggers, approvals, retries, history), and a pluggable runtime does the work.
- **Hivemind's own routines operate within restricted information boundaries. They may publish automatically only when their inputs and actions are authorized for the destination. Cross-space work stays private unless explicitly approved.**
  - **Runs are scoped before they start.** A space routine reads only its space, the guidance that reaches it and its permitted sources.
  - **A person routine may read every space its owner can access.** It lives in the owner's personal space, and its results are private by default. Weekly planning across clients is an ordinary person routine.
  - **Private work is automatic everywhere.** A person routine updates its owner's private knowledge, notes and native tasks across all their spaces without approval.
  - **Automatic publishing needs both** an authorized action and inputs that the destination's audience is authorized to see. Being in the same space isn't enough: a private email about Acme doesn't become shareable because the routine is scoped to Acme.
- **Containment:** a routine that reads untrusted input runs where all its tools come from Hivemind. A run that holds outside tools falls outside containment, and its output is agent-reported.
- **Routing:**
  - Sources from bound places route themselves.
  - Other sources land in your personal space. Content they inform lives on your private side in the matched spaces and cites them there.
  - One source can inform many spaces, and none of them is primary.
  - Routing rules are guidance.
  - When knowledge is unclear, it waits quietly. When an action is unclear, the agent asks.

**Open**
- v1: what is the minimal runner for system routines (scheduling, retries, history)?
- Later: the full orchestration engine and its runtime integrations.

---

## Benchmarks to run first

0. **Small items vs. a plain wiki:** feed the same stream of sources over simulated weeks into (a) a plain agent-maintained Markdown wiki and (b) pages made of small, sourced content items, kept up through the upkeep operations (§3). Measure how correct the current facts are, how stale they get, how much they drift after many updates, how traceable they are, and what each costs. Add structure (fact keys, dependencies) only where it wins.
1. **MCP reliability:** how consistently Claude and ChatGPT call Hivemind on realistic prompts, at experience levels 1 and 2.
2. **Generic vs. specific tools:** whether agents build `act` payloads correctly, compared with dedicated tools, and whether they choose correctly between `remember` and `act` (for example, whether "remember" feels natural for completing a task).
3. **Context variants:** core only, core plus relevant summaries, and core plus full pages. Measure quality, number of calls, latency and tokens.
4. **Retrieval:** relationships plus full-text search, with and without semantic search, always with row-level security on.
5. **Planning latency:** weekly planning across 5 to 10 external systems. If it takes 15 to 30 seconds, add caching or indexing.
6. **Prompt-cache reuse** across clients.

## Conceptually tested workflows

These fit the model without new primitives, and they were walked through the data model on 2026-10-12. None has been shown end-to-end yet:
- Morning email triage
- Shared project knowledge
- Cross-client weekly planning

## Deferred

These were raised by the 50-scenario stress test (2026-10-11). They wait for real need.

- Whether a link needs acceptance from the other side.
- Custom record types, and structured fields on page types.
- Spaces as members, "everyone" as a member, synced membership, and membership expiry.
- Guidance that follows a space's members into other trees.
- Sessions that serve several people at once.
- What happens to private sides when someone leaves.
- Retention, legal holds and audit rights.
- Treating other restructuring (re-parenting between shared spaces, un-closing a space) as sharing. Making a space collaborative is decided in §4.
