# 0005 — The mailbox of the stack is local to saras

## Context

The demo has to be whole on one machine: a mailbox with emails to fetch, and replies that go somewhere without leaving it. The stack therefore needs a mail provider's stand-in, `world/mailbox`: an IMAP and an SMTP server.

saras refuses to give a password to a mail server without TLS, unless that server is one of its own machine (`localhost`, `127.x`). It is one of its privacy guarantees, and it is not open to configuration. A stand-in that is a service of its own on the compose network is neither local nor, as it comes, speaking TLS.

## Decision

The mailbox container runs **in the network of the saras container** (`network_mode: service:saras`) and listens on its loopback: for saras it is a mail server of its own machine, `127.0.0.1:1143` and `127.0.0.1:1025`, the one case its rule lets through. Nothing changes in saras, and nothing else can reach the mailbox.

The access to a mailbox is sealed with the server's `APP_SECRET`, so a seed cannot carry one that opens everywhere. The demo seed holds the organisation; `emb run demo` then connects the mailbox through the API, as its administrator would.

## Alternatives

- **TLS, with a certificate saras trusts.** The stand-in serves a certificate for the name `mailbox`, and saras is started with it as an extra authority. It keeps the two containers apart, and it is what a real provider looks like; it costs a private key in the repository or a certificate handed over a volume at start, and a second thing to renew.
- **Let saras accept named hosts without TLS.** A setting that turns a guarantee off is a guarantee that can be turned off.
- **Carry the mailbox in the seed**, sealed with the development secret. It opens only where that secret is in force, which is not the stack of someone with an `APP_SECRET` of their own.

## Consequences

- The mailbox lives and dies with the saras container: made anew alone, saras leaves it in the network of the old one. `emb up` puts that right, and `emb run demo` makes the mailbox anew every time.
- No other service of the stack can reach the mailbox. A suite that wants to read what was sent has to ask saras, or its log.

## What would reverse this

A suite that must read the mailbox from outside saras; or a second service that needs it. Either one is the day to give it TLS and a name of its own.
