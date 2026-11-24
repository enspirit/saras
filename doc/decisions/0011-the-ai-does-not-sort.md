# 0011 — The AI does not sort

## Context

A fetched email is sorted: where it stands (to handle, or no reply needed), and how urgent it is. Three could do it: nobody, a rule written in Elo, or the AI, which an organisation chose for itself and an operator for new organisations (`TRIAGE_STRATEGY`).

The AI's part cost more than its one choice shows:

- It was the one step that sent received emails to the LLM without anyone having asked for anything: the sender, the subject, the beginning of the text and the attachment names of every email fetched.
- It could fail, or say nothing of an email. Hence a state of its own, an email *waiting to be sorted*, shown as "Not triaged" and presented again at each fetch, and a fetch that could fail at sorting.
- Chosen after a first fetch, it applied to nothing already fetched. Hence an operation to send those back (SortAgainUnsorted), and a second question in getting started.
- It decided only the two pre-configured attributes, as two more ways of deciding (`ai`, `eloAi`) that every attribute had to refuse "for now".
- It gave a reason nobody could check, where a rule says what it does and costs nothing.

Since [decision 0009](0009-the-prompt-that-suits-follows-from-attributes.md) the AI no longer chooses the prompt either: attributes do, and rules decide attributes.

## Decision

The AI writes; it does not sort. An email is sorted by the rules of the organisation's attributes when it is fetched, and by members afterwards. When the rule of "Stands in" says nothing of an email, it is to handle, at once.

There is no way of sorting to choose: not for an organisation, not for an installation.

## Alternatives

- **Keep it as an option, off by default**, which is what it was. Everything above stays, for the organisations that turn it on, and for everyone to read past.
- **Let the AI decide any attribute, from an instruction**, which is where `ai` as a way of deciding pointed. More of the same cost, not less.

## Consequences

- The LLM is sent a received email for one thing: writing a proposal, when a member asks or, where the organisation chose so, at fetch.
- No email waits to be sorted. `pending` is no longer a status an email may have; a fetch fails at fetching or at preparing proposals, never at sorting.
- The priority of an email is set by hand, or by a rule the organisation gives "Priority".
- An email the AI sorted stays where it put it and says so, with its reason.
- Gone: ChooseSorting, SortWaitingEmails, SortAgainUnsorted and `POST /organization/sort-again`; `sorting` in the organisation's settings; `triaged` in the answer of a fetch; `TRIAGE_STRATEGY`, which is ignored where it is still set.
- Migration `0003-no-sorting-by-the-ai` puts to handle what waited, has no organisation sort by the AI and no attribute decided by it. It leaves `organizations.triage_strategy` and the value `pending` of `emails.status` in the schema, which the version before this one still reads.
- Migration `0004-nothing-kept-of-the-ai-sorting` removes both, in the same release. [Decision 0010](0010-the-server-migrates-its-database-and-several-may-share-it.md) asks that what a version stops using be removed in a later one, so that servers of two versions may share a database during an upgrade: here no installation runs a server of the version before, and such a server does not work once 0004 is applied.
- A way of deciding an attribute that the server does not know (`ai`, `eloAi`, as an interface loaded before this version may still send) is refused, not read as nobody: read so, it would switch the rule of "Stands in" off without saying.

## What would reverse it

Organisations whose mail cannot be told apart by rules they can write (whether a person expects an answer, read from free text), and who accept that every email fetched is read by the LLM for it. It would come back as a way of deciding an attribute, not as a gate before the rules.
