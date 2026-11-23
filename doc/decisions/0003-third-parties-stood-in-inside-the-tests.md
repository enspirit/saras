# 0003 — Third parties are stood in for inside the test process

## Context

saras talks to mail providers (IMAP, SMTP, Gmail, Microsoft Graph), to an LLM through OpenRouter, and to identity providers. No suite may talk to the real ones. The layout has a place for their stand-ins, `world/<mock>/`: a container of the stack, with one definition per endpoint.

The tests of `software/saras/test/integration/` already stand in for them, in their own process: a real IMAP server and a real SMTP server on local ports, and a stand-in for OpenRouter that records what it is sent (`test/support/`). The demo reuses the mail servers (`scripts/demo/`).

## Decision

They stay there, for the tests: each test needs a mailbox of its own, with its own messages, and reads afterwards what was sent.

The stack has stand-ins of its own in `world/`: the server's outgoing mail server (`world/fakesmtp`) and, for the demo, one mailbox of sample emails (`world/mailbox`). It has no LLM: the server in it has no key, whatever a laptop's `.env` holds, and an address for OpenRouter where nothing listens (`software/saras/env/test.env`).

## Alternatives

- **The tests use the stand-ins of the stack.** `world/mailbox` holds one fixed mailbox; the tests would share it, and each other's leftovers. And `world/openrouter`, which nothing needs until a black-box suite asks for a proposal.

## What would reverse this

The first black-box specification of an operation that needs the LLM (WriteWithPrompt): a stand-in for it then joins `world/`. And the day `world/mailbox` can be given a mailbox per test, the integration tests can use it instead of their own.
