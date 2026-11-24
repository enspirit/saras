# 0012 — The server logs JSON lines, and never what it protects

## Context

The server said almost nothing: a sentence when it started, one when something failed that nobody was told. No request was logged, and nothing of a conversation with a mail server: the IMAP library's logger was turned off, the SMTP one never given.

It showed in production. A member connecting a mailbox by its servers got a `504` from the gateway in front of saras, and the server's output held no line about it: not that the request had come, not which mail server was asked, not what it answered. Nor could it have: the libraries wait 90 seconds (IMAP) and two minutes (SMTP) for a server to accept a connection, longer than a gateway waits for saras. A port that answers nothing, as a filtered one does, was told to the member as a gateway's timeout and to nobody as what it is.

More had to be said, and the README promises that the server never logs the content of emails or requests. What may be said had to be decided once, in one place, and held.

## Decision

**One JSON object per line, on the standard output** (JSON Lines), every level on the one stream. Each line starts with `time` (ISO 8601, UTC), `level` (`debug`, `info`, `warn`, `error`) and `msg`, the names pino and Go's `slog` write and most collectors read without being told, the level as a word; then what the line is about, as fields. `LOG_LEVEL` says from which level up; `info` unless said. `src/tooling/log.ts` is the only place that writes, and no source of the server calls `console`.

**What a line is about travels with what is being done.** Every request has an id, the gateway's `x-request-id` when it gave one, and says it back in its answer; every line logged while the request is handled carries it as `req`, however deep it is logged from. The same for a task of the clock (`task`) and a mailbox being fetched (`mailbox`). The lines of a request are read together, and with the gateway's own.

**A request is logged when it ends**: method, route as it is declared (`/api/mailboxes/:id`, never the address asked for), status, milliseconds, the member and the organisation as numbers. And when it does not end: *left unanswered* when whoever asked closed the connection first, which is what a gateway giving up looks like from here.

**Of a mail server, the way in is logged and nothing past it.** Where it is, the connection, TLS, signing in, how long it took; when it fails, the kind of failure, the server's answer, and what its name resolves to from where saras runs. At `debug`, the handshake itself, line by line. The first command that is not of the handshake (`SELECT`, `FETCH`, `MAIL FROM`…) ends it for good: folders, correspondents and mail are said in no log, and past that point a failure is told by its code only, a server's own words being free to name anyone. So is a fetch that failed: its words are kept with the mailbox, for its members.

**Never, at any level**: a password, a key, a token, a cookie; who signs in at a mail server; the address of a mailbox, a member or a correspondent; a folder; a request's body or query; anything of a mail. Three things hold it rather than care at each call. Every line passes through `src/tooling/redaction.ts`: a value named as a secret is hidden, a URL loses its credentials, an email address is taken out of any text, a long text is cut. What the mail libraries say is read through a list of what may be repeated, with the credentials of the connection taken out of every text. And `test/integration/what-the-log-says.test.ts` connects a mailbox, fetches it and sends a reply at `debug`, then looks for each of these in what was written.

**A mail server is given 15 seconds to accept a connection, and 15 to greet.** Not a setting. The failure then reaches the member as what it is, in the interface, before any gateway gives up.

`LOG_LEVEL` loosens none of this: it chooses how much is said of what may be said.

## Alternatives

- **pino**, which is what most Node servers log with, and already installed as a dependency of the IMAP library. Its line is the one chosen here; its redaction is by paths declared ahead, where what must be hidden here is found by name at any depth and by value inside texts. What is left of it is a file of fifty lines, against a dependency in the one place that must never leak.
- **A level as a number** (pino's default), or `@timestamp` and `log.level` (Elastic Common Schema), or `severity` (Google Cloud). Each suits one collector best. `time`, `level` as a word and `msg` are read by all of them, some after one line of configuration; the names are in one function.
- **Text for people in development, JSON in production.** Two formats, one of which no test would read. `emb logs saras | jq` reads the one.
- **The libraries' loggers as they are**, behind `LOG_LEVEL=debug`. They mask a password and not who signs in; the SMTP one repeats recipients, the IMAP one whatever a `FETCH` answers. The promise would hold at `info` only.
- **Logging who signs in**, to tell mailboxes apart. A number does, once the mailbox is connected (`mailbox`); before that, the request does (`req`, `member`).
- **The timeouts as settings.** Nothing an operator knows makes a mail server worth waiting two minutes for while a member watches.

## Consequences

- The output is no longer sentences: a person reads it with `jq`, or in whatever collects it.
- At `info`, a line per request to the API and a few per mailbox fetched: more than before, by much. The files of the interface, and the health check when it is answered (`GET /api/public`), are logged at `debug` only.
- A mail server slower than 15 seconds to accept a connection is refused where it was waited for. None is known.
- A request's id is in its answer (`x-request-id`): a member who reports a problem can be asked for it.
- The mail libraries' words are repeated as `msg`: they may change with a version of a library, and are not something to alert on. The fields are ours.
- What the server says of Gmail, Microsoft Graph and the LLM is still only the request and its outcome.
- A new thing logged is held by `redaction.ts` whatever it is given; what it should say remains the writer's to think about.

## What would reverse this

A collector that must be given a format of its own, by more than renaming three fields: the line is then built by something made for it. Or a need to follow a mail past the handshake to find a fault in the protocol: that is a tool run by hand against one mailbox with its owner's consent, not a level of the log.
