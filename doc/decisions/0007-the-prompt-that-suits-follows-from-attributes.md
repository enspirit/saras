# 0007 — The prompt that suits an email follows from its attributes

## Context

A proposal is written with a prompt. The AI used to choose it: when it sorted, it was given the list of prompts and suggested one per email. An organisation that did not have the AI sort got no suggestion at all, and one that did paid tokens for a choice it could not see the reasons of.

Meanwhile sorting came to give each email attributes: where it stands, its priority, and those the organisation makes (a topic, who takes care of it), decided by rules that cost nothing, by the AI, or by hand.

## Decision

The AI no longer chooses a prompt, and is no longer told the prompts. An email goes through one line:

```
incoming email ─► sorting (sets its attributes) ─► the prompt that suits ─► writing (by hand, or at fetch)
```

Each prompt says which emails it suits: for some attributes, the values that suit it. An email suits a prompt when it has one of those values for every attribute named. The best prompt is, among those an email suits, the one that names the most attributes; the first of the list when several do. A prompt that names none is never the best. When no prompt is, who writes is offered the first of the list, and a proposal written at fetch uses it.

Nothing is kept of the choice: it is computed from the email's attributes and the prompts as they are, each time it is needed (`src/domain/computations/prompt-affinity.ts`).

## Alternatives

- **Keep the AI's suggestion, with affinity as a fallback.** Two ways of choosing, one of which cannot be explained, for a result that is one prompt among a handful.
- **A prompt on each board.** It was built and withdrawn: a board is a member's view, several may show the same email, and which one wins has to be explained.
- **A rule in Elo that answers a prompt.** More general; a second place where prompts are chosen, when an attribute decided by a rule already says the same.

## Consequences

- An organisation with no attribute but the two it starts with can still say "high priority suits this prompt"; to go further it makes an attribute and a rule.
- Changing what a prompt suits, or an attribute of an email, changes which prompt is offered at once, including for emails already kept. A proposal already written keeps the prompt it was written with.
- `emails.suggested_prompt_id` is no longer written nor read. It stays in the schema, which the server only ever adds to ([decision 0001](0001-the-server-creates-its-schema.md)).
- The sorting request is shorter: it no longer carries the names and descriptions of the prompts.

## What would reverse it

Organisations whose emails cannot be told apart by attributes they can decide with rules or by hand, and who would rather pay the AI to choose.
