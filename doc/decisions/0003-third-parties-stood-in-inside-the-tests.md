# 0003 — Third parties are stood in for inside the test process

## Context

saras talks to mail providers (IMAP, SMTP, Gmail, Microsoft Graph), to an LLM through OpenRouter, and to identity providers. No suite may talk to the real ones. The layout has a place for their stand-ins, `world/<mock>/`: a container of the stack, with one definition per endpoint.

The tests of `software/saras/test/integration/` already stand in for them, in their own process: a real IMAP server and a real SMTP server on local ports, and a stand-in for OpenRouter that records what it is sent (`test/support/`). The demo reuses the mail servers (`scripts/demo/`).

## Decision

They stay there. The stack of `docker-compose.test.yml` has no mailbox and no LLM: the server in it has no key, and an address for OpenRouter where nothing listens (`software/saras/env/test.env`).

## Alternatives

- **`world/mailbox` and `world/openrouter` as services of the stack.** Needed by a black-box suite that connects a mailbox or asks for a proposal. Until such a suite exists they would be a second copy of what `test/support/` does, with nothing to hold the two equal.

## What would reverse this

The first black-box specification of an operation that needs a mailbox or the LLM (ConnectMailbox, FetchMailbox, WriteWithPrompt). The stand-ins then move to `world/`, as images that are never published, and the integration tests use the same definitions.
