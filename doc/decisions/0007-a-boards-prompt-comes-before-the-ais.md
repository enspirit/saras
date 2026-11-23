# 0007 — The prompt of a board comes before the one the AI suggests

## Context

A proposal is written with a prompt. Until now the only thing that chose one was the AI, when it sorts: it suggests, for each email to handle, the prompt that suits it best. An organisation that does not have the AI sort got no choice at all: the first prompt of its list, for every email.

A board is how an organisation arranges its work: "quotes", "support", "what Sam takes care of". It is natural for it to say how its emails are answered, and it costs nothing.

## Decision

A board may name one prompt of the organisation.

- **Who writes a reply from a board** is offered that prompt first, marked as the board's. The prompt of a proposal already written for the email stays first; the AI's suggestion comes after the board's.
- **A proposal written at fetch** uses the prompt of the first shared board, in the order they were made, that shows the email; else the AI's suggestion; else the first prompt of the list. Personal boards are not looked at: what is written at fetch is written for the mailbox, not for one member's view of it.

So the order is: what the organisation arranged, then what the AI thought of one email, then the default.

## Alternatives

- **The AI's suggestion first, the board's as a fallback.** It is the more specific of the two, being about one email. But a board's prompt is something a person chose on purpose, and an organisation that sets one while the AI sorts would see it ignored most of the time, without knowing why.
- **A rule that answers a prompt**, as attributes have rules. More general, and a second thing to learn; a board with a prompt says the same with what is already there.
- **A default prompt for the organisation**, chosen in place of "the first of the list". Still useful, and not excluded by this.

## Consequences

- An email shown by several shared boards with different prompts takes the prompt of the oldest of them. Nothing says so on the boards.
- Writing at fetch runs each shared board's filter against each email to prepare: a few small queries per email, for at most ten emails per fetch and mailbox.

## What would reverse it

Organisations that have the AI sort and find that its suggestion, being about the email itself, is right more often than their boards.
