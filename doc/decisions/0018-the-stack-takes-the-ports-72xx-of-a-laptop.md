# 0018 — The stack takes the ports 72xx of a laptop

## Context

The development stack publishes three ports on the machine of whoever runs it: the front door, the database, and the page of the mail it was given to send. They were the usual ones of what listens behind them: 3000, 5432, 1080.

Those are the usual ones of everybody. A developer who works on another project keeps its stack up, and `emb up` then fails on the first port already taken: saras could not be started beside it.

## Decision

On a laptop the stack takes ports of its own: **72, then the two digits the usual port starts with**.

| Service | Usual | Published |
| --- | --- | --- |
| `saras` | 3000 | 7230 |
| `postgres` | 5432 | 7254 |
| `fakesmtp` | 1080 | 7210 |

72 is S and A on the keys of a phone: one thing to remember, and the rest is read off a port one already knows. A service published later is numbered the same way.

Only the host side changes. Inside its container every service listens where it always did, the stack under the suites still publishes nothing, and the server's own default stays `PORT=3000`: what an operator is given, by the image and by the chart, is untouched. The numbers are those of [`.env.commons`](../../.env.commons), and the process environment still beats them: `SARAS_PORT=3000 emb up`.

## Alternatives

- **Keep the usual ports, and let each developer override them.** `.env.commons` wins over `.env`, so the override is typed at every command or exported in every shell; and the default stays the one that fails.
- **A digit in front** (13000, 15432, 11080). Nothing to remember at all, which is why other projects do it too: 15432 is as taken as 5432. With one digit there are also few projects to tell apart before the range the system gives to outgoing connections.
- **A run of consecutive ports** (7270, 7271, 7272). Nothing in a number says which service it is: a table to look up each time.
- **No published port, and a proxy with names** (`saras.localhost`). It takes port 80, which is the one most surely taken, or a proxy shared between projects, which no stack owns.

## Consequences

- The stack starts beside another project's, and its addresses are http://localhost:7230 and http://localhost:7210.
- A bookmark, and a `BASE_URL` in a laptop's `.env` that names port 3000, are to be changed by hand. So is the redirect address of an OAuth application registered for development: it is `{BASE_URL}/api/oauth/…/callback`, and the host refuses one it was not told.
- Two usual ports that start with the same two digits (80 and 8080) would ask for the same number: the second takes the next one free.
- `npm run design`, which needs no Docker, is not the stack: it stays on the server's default, 3000, and `PORT` moves it ([`DESIGN.md`](../../DESIGN.md)).

## What would reverse it

Another project on the same machines taking the range 72xx; or a proxy shared by the stacks of a laptop, which would give each a name and make the numbers nobody's concern.
