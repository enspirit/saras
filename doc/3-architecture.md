# saras — architecture

How the repository is laid out, what each part is responsible for, and who may rely on whom. What saras is for is in the [user stories](1-user-stories.md); what it does, as state and operations, in the [operations inventory](2-operations.md).

## The layout

The directory says what a thing is for.

```
doc/            what saras is for, what it does, and the decisions taken
software/       what we write and ship          one directory per component
tests/          what proves it, from outside    each a component too
world/          what it runs in                 the deployment

.emb.yml                    project, plugins, flavors, repository-wide tasks
.env.commons                committed, non-secret defaults: the stack's vocabulary
.env                        not committed: secrets and personal overrides
docker-compose.base.yml     what each service *is*
docker-compose.devel.yml    + ports, env files, bind mounts   (a laptop)
docker-compose.test.yml     + the suites' env, no published port   (CI)
```

Three questions place a directory. Do we write it and ship it? `software/`. Does it exist only to prove the rest, from outside, and never ship? `tests/`. Do we run it without writing it, or does it describe where things run? `world/`. Unit and integration tests are not `tests/`: they live inside the component they test.

## Components

A component is a directory under one of the three, with a `README.md` that is its contract (public interface, depends on, must not, harness, status) and an `Embfile.yml` that holds its tasks. If a behaviour is not in a component's README, nothing else may rely on it.

| Component | What it is | Runs as |
| --- | --- | --- |
| [`software/saras`](../software/saras/) | The server and the interface it serves: every operation, and the state. | The service `saras`, image `saras/saras`: the front door |
| [`tests/webspicy`](../tests/webspicy/) | The black-box specification of the API: what a URL answers, knowing nothing of what serves it. | The service `webspicy`, image `saras/webspicy`, never published: it sleeps, and the suite is run inside it |
| [`tests/harness`](../tests/harness/) | The checks on the repository itself: links, import boundaries. | On a checkout, inside `emb run lint` |
| [`world/compose`](../world/compose/) | saras as an operator runs it: the application and a PostgreSQL server. | An operator's `docker compose up`, never by the suites |

PostgreSQL is a third party's image that needs no file of ours: it has no directory, and is pinned in `docker-compose.base.yml`.

Why saras is one component and not three is [decision 0002](decisions/0002-one-component.md).

## Who may rely on whom

```
tests/harness  ──reads the files of──► everything         (imports nothing)
tests/webspicy ──HTTP, through the front door──► software/saras   (knows nothing else of it)
world/compose ──builds──► software/saras ──► PostgreSQL, the mail providers, the LLM
```

Inside `software/saras`, dependencies point one way, and `tests/harness` holds each arrow that is listed there:

```
web/ ──/api──► src/tooling/http ──► src/domain ──► src/tooling (database, mail, LLM, sealing)
  └──────────────► shared/ ◄──────────┘
```

- The browser is a client of the API with no privileged path: `web/` imports nothing of `src/`.
- `shared/` declares the domain objects once, for both, and imports nothing.
- The domain knows nothing of HTTP: an operation refuses with a kind, and the tooling turns the kind into a status.
- One place wires everything together: `src/main.ts`.
- One adapter per third party: the table of `software/saras/README.md`, "Depends on", names the one module that reaches each.

A new arrow is a decision, not an edit.

## Third parties

| Agent | In production | Under the suites |
| --- | --- | --- |
| PostgreSQL | A server | The same image in the stack; the embedded PostgreSQL in the tests that need only a checkout |
| Mail providers, identity providers | The real ones | A real IMAP server and a real SMTP server started by the tests, in their own process |
| The LLM (OpenRouter) | The real one, zero retention enforced | A stand-in started by the tests, recording what it is sent; none in the stack, which has no key |

No suite talks to a real one. Why the stand-ins live inside the tests and not in `world/` is [decision 0003](decisions/0003-third-parties-stood-in-inside-the-tests.md).

## State

The state is kept in PostgreSQL and controlled by `software/saras` alone, which creates its schema when it starts: [decision 0001](decisions/0001-the-server-creates-its-schema.md).

## The two stacks, and the deployment

| | Compose files | Project | For |
| --- | --- | --- | --- |
| On a laptop | `base` + `devel` | `saras-dev` | Developing: saras on `localhost:3000` with its sources mounted and watched, PostgreSQL on `localhost:5432` |
| Under the suites | `base` + `test` | `saras-dev` | CI: no published port, sources baked into the images, no secret read, sign-up open |
| An operator's | `world/compose/docker-compose.yml` | `saras` | Running saras for real |

`emb up` starts the first; `COMPOSE_FILE=docker-compose.base.yml:docker-compose.test.yml emb up` the second. `base` names images and `emb` builds them, from each component's Embfile.

Environment, four files with one reader each: `.env.commons` (shared, non-secret, loaded by `emb` into every task), `.env` (secrets and one laptop's overrides; reaches a container only where the compose file lists it), `software/saras/env/devel.env` (how the container sees the stack), `env/test.env` (what only the suites change).

## Tests

| Level | Holds | Where | Runs with |
| --- | --- | --- | --- |
| unit | A computation: one pure function, a table of cases, no mock. And the checks that read the component's own sources. | `software/saras/test/unit/` | `emb run test` |
| integration | An operation over HTTP, in an application the test starts itself, against local mail servers and a stand-in for the LLM | `software/saras/test/integration/` | `emb run test`; `emb run test:postgres` on the stack's PostgreSQL |
| api | One operation and its refusals, as a client sees them: the assembled product over HTTP, black box | `tests/webspicy/formaldoc/` | `emb run test:webspicy`, against the running stack |
| repository | Links, import boundaries | `tests/harness/` | `emb run lint` |

The black-box suite has only begun: it has no way yet to choose the state it starts from, so it specifies what reads and what refuses. Its status says what waits, and on what.

`emb` is the only entry point. Every build and every suite is a task; CI calls those tasks and nothing else (`.github/workflows/test.yml`), so a green CI and a green laptop mean the same thing. `emb run test` needs a checkout; a suite that needs the running stack has a name of its own.

## Decisions

A choice between real alternatives is a record in [`decisions/`](decisions/): context, decision, alternatives, and what would reverse it. The decisions about what saras *does* are in the [operations inventory](2-operations.md#decisions).
