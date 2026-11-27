# saras — architecture

How the repository is laid out, what each part is responsible for, and who may rely on whom. What saras is for is in the [user stories](1-user-stories.md); what it does, as state and operations, in the [operations inventory](2-operations.md).

## The layout

The directory says what a thing is for.

```
bin/            the few commands of the repository itself: the demo
doc/            what saras is for, what it does, and the decisions taken
software/       what we write and ship          one directory per component
tests/          what proves it, from outside    each a component too
world/          what it runs in                 stand-ins for third parties, the chart

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
| [`software/storage`](../software/storage/) | The seeds: the datasets the stack's database is put into, the demo among them. | The service `storage`, which is `dbagent`: never deployed, never published |
| [`world/mailbox`](../world/mailbox/) | A member's mailbox, as the stack meets it: an IMAP server holding sample emails, an SMTP server that sends nothing. | The service `mailbox`, image `saras/mailbox`, in the network of `saras`; never published |
| [`world/fakesmtp`](../world/fakesmtp/) | The outgoing mail server, as the stack meets it: it delivers nothing and shows what it was given. | The service `fakesmtp`, image `saras/fakesmtp`, never published |
| [`world/chart`](../world/chart/) | The Helm chart: how an operator runs the published image on Kubernetes. | Nowhere here: no stack names it, and no suite installs it |
| [`tests/operations`](../tests/operations/) | The black-box specification of the operations: what each is and what the rules demand of it, knowing nothing of what performs it. | The service `operations`, image `saras/operations`, never published: it sleeps, and the suite is run inside it, on a stack whose database is the suites' own |
| [`tests/harness`](../tests/harness/) | The checks on the repository itself: links, import boundaries. | On a checkout, inside `emb run lint` |

PostgreSQL is a third party's image that needs no file of ours: it has no directory, and is pinned in `docker-compose.base.yml`. No deployment is described: saras ships as an image ([decision 0004](decisions/0004-saras-ships-as-an-image.md)), and as a chart an operator installs it with, which names no cluster, no address and no secret ([decision 0007](decisions/0007-a-helm-chart-for-operators.md)).

Why saras is one component and not three is [decision 0002](decisions/0002-one-component.md).

## Who may rely on whom

```
tests/harness  ──reads the files of──► everything         (imports nothing)
tests/operations ──HTTP, through the front door──► software/saras   (knows nothing else of it)
tests/operations ──asks for a seed──► software/storage ; ──reads──► PostgreSQL   (never writes it)
tests/operations ──is run by──► opspicy, from its image   (a project of its own: decision 0020)
software/saras ──► PostgreSQL, the mail providers, the LLM
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
| The server's own outgoing mail server | A real one, when `SMTP_URL` names it | `world/fakesmtp` in the stack; an SMTP server started by the tests that need only a checkout |
| Mail providers | The real ones | `world/mailbox` in the stack, for the demo; a real IMAP server and a real SMTP server started by the tests, in their own process |
| Identity providers | The real ones | None: the tests stand in for their answers |
| The LLM (OpenRouter) | The real one, zero retention enforced | A stand-in started by the tests, recording what it is sent; none in the stack, which has no key |

No suite talks to a real one. Why the tests keep stand-ins of their own for the mailboxes and the LLM is [decision 0003](decisions/0003-third-parties-stood-in-inside-the-tests.md); why the mailbox of the stack runs in the network of saras is [decision 0005](decisions/0005-the-mailbox-of-the-stack-is-local-to-saras.md).

## State

The state is kept in PostgreSQL and controlled by `software/saras` alone, which brings its schema to what it expects when it starts, one migration after the other: [decision 0010](decisions/0010-the-server-migrates-its-database-and-several-may-share-it.md). Several servers may share one database, which is then where they agree on who does what.

A named state is a seed of `software/storage`, loaded by `dbagent`: `emb run demo` adds the demo organisation to whatever the database holds, then connects its mailbox, which is not saras's to keep but the mail provider's. A seed is made by arriving at the state through the API and flushing it, never by hand.

## The two stacks

| | Compose files | For |
| --- | --- | --- |
| On a laptop | `base` + `devel` | Developing: saras on `localhost:7230` with its sources mounted and watched, PostgreSQL on `localhost:7254` ([the ports](../HACKING.md#the-stack)) |
| Under the suites | `base` + `test` | CI: no published port, sources baked into the images, no secret read, sign-up open |

`emb up` starts the first; `COMPOSE_PROJECT_NAME=saras-try COMPOSE_FILE=docker-compose.base.yml:docker-compose.test.yml emb up` the second, under a name of its own so that it runs beside the first. Its database is a volume of its own, whatever the name: the suites empty it, and never the development one. `base` names images and `emb` builds them, from each component's Embfile.

Environment, by who reads it: `.env.commons` (the stack's vocabulary: shared, non-secret, loaded by `emb` into every task), `.env` (secrets and one laptop's overrides, loaded by `emb` and listed by no compose file: a container gets of it what its `env/devel.env` names, as `${NAME:-default}`), and for each component `env/base.env` (what it is configured by, in every stack: every variable it reads, with its default; listed in `docker-compose.base.yml`), `env/devel.env` (what the development stack changes) and `env/test.env` (what only the suites change, which pins everything `devel.env` takes from `.env`). Later files win, in that order.

## Tests

| Level | Holds | Where | Runs with |
| --- | --- | --- | --- |
| unit | A computation: one pure function, a table of cases, no mock. And the checks that read the component's own sources. | `software/saras/test/unit/` | `emb run test` |
| integration | An operation over HTTP, in an application the test starts itself, against local mail servers and a stand-in for the LLM | `software/saras/test/integration/` | `emb run test`; `emb run test:postgres` on the stack's PostgreSQL |
| operations | One operation as its clauses say it: from a seed, every precondition violated alone and refused with nothing changed, every postcondition observed in the state reached. The assembled product over HTTP, black box | `tests/operations/specification/<area>/operations/` | `emb run test:operations`, on the stack under the suites |
| repository | Links, import boundaries | `tests/harness/` | `emb run lint` |
| chart | What the Helm chart renders and what it refuses, without a cluster | `world/chart/` | `emb run lint`, `emb run test` |

The black-box suite starts each case from a seed, which empties the database: it runs on the stack under the suites, whose database is nobody's, and refuses the development one ([decision 0017](decisions/0017-the-operations-are-specified-by-predicates.md)). Its status says what it leaves to the integration tests.

`emb` is the only entry point. Every build and every suite is a task; CI calls those tasks and nothing else (`.github/workflows/test.yml`), so a green CI and a green laptop mean the same thing. `emb run test` needs a checkout; a suite that needs the running stack has a name of its own.

## Decisions

A choice between real alternatives is a record in [`decisions/`](decisions/): context, decision, alternatives, and what would reverse it. The decisions about what saras *does* are in the [operations inventory](2-operations.md#decisions).
