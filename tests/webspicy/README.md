# webspicy

The **black-box specification** of what saras answers over HTTP. Not a second test suite: a contract, in the client's type system, from which the tests are derived.

One responsibility: *say what a URL answers, knowing nothing about what serves it.*

## Public interface

A component with no API of its own. It offers two tasks and one guarantee: **it reads only what comes back over HTTP.**

| | |
| --- | --- |
| `emb run test:webspicy` | the whole suite, against the running stack |
| `S=api/public/get.yml emb run test:webspicy:one` | one specification, by its path under `formaldoc/` |

`SARAS_API` names the target, an origin with no path, and has no default: a suite that silently falls back to localhost passes against whatever is listening. In the stack it is `http://saras:3000` ([`env/base.env`](env/base.env)).

The tree under [`formaldoc/`](formaldoc/) is the front door's URL space: `formaldoc/api/auth/signup/post.yml` specifies `POST /api/auth/signup`. Each file is one operation of [`doc/2-operations.md`](../../doc/2-operations.md), named after it, with its clauses as pre, post and errconditions.

## Depends on

| | |
| --- | --- |
| the running stack | saras, healthy, reached through its front door |
| the state it starts from | sign-up is open: both overlays of the stack say so |
| `webspicy`, Finitio | Ruby gems, pinned in `Gemfile.lock` |

Nothing of ours is in its process.

## Must not

1. Never import saras's source, never hold a database handle.
2. Never point behind the front door.
3. Never be edited to make a mismatch pass: if the specification and the server disagree, one is a bug, and the suite is how it was found.
4. Never reset the state by a route of its own. There is none to reset it by yet: see Status.
5. Never hold a credential.
6. Never ship: `publish: false`.

## Harness

It *is* the harness. Not part of `emb run test`: it needs a running stack, and CI runs it after `emb up`, under `docker-compose.test.yml`.

To add a specification: the file, at the path of its URL; its schemas in [`schema.fio`](schema.fio); the conditions before the examples. On a laptop the specifications are mounted: a change is seen at the next run. After editing `config.rb` or `schema.fio`, `emb up -f webspicy`.

## Status

> **In flight:** nothing.

Two operations are specified, and only as far as a suite with no way to choose its start state can go:

| Specification | Says |
| --- | --- |
| `GET /api/public` | What visitors are told, and its shape. |
| `POST /api/auth/signup` (CreateOrganization) | Its two refusals that leave nothing behind: an address that is not one, a password too short. |

What is not specified, and why:

- **Anything that succeeds in writing.** A sign-up that succeeds leaves an organisation behind, and the same address is refused at the next run. A case that writes needs to start from a named state, and nothing installs one: the server creates its schema itself and no service owns seeds ([decision 0001](../../doc/decisions/0001-the-server-creates-its-schema.md)).
- **Anything a member does.** A session is obtained by signing up or signing in, hence the same need.
- **A wrong password at sign-in.** It counts towards the lock-out of the origin, ten in fifteen minutes, kept in the server's memory: ten runs would lock the suite out of every route a visitor may attempt.
- **Anything that needs a mailbox or the LLM.** The stack has neither ([decision 0003](../../doc/decisions/0003-third-parties-stood-in-inside-the-tests.md)).

Until then the operations are held by `software/saras/test/integration/`, from inside the component.
