# saras — for an agent working here

saras is a self-hosted web tool to answer email with the help of AI. One Node.js server (TypeScript, run directly, nothing compiled) serving its own interface, on PostgreSQL. Its promises about privacy are the product: do not trade one for convenience.

## The map

```
software/saras/     the server and its interface: src/ (domain, tooling), web/, shared/, public/, test/
software/storage/   the seeds of the stack's database (dbagent): data/empty, data/demo
world/mailbox/      a member's mailbox, as the stack meets it (IMAP + SMTP, sample emails)
world/fakesmtp/     the outgoing mail server of the stack (delivers nothing)
world/chart/        the Helm chart, for an operator on Kubernetes
tests/webspicy/     the black-box specification of the API
tests/harness/      checks on the repository: links, import boundaries
doc/                user stories, operations, architecture, design, decisions/
bin/demo            what `emb run demo` runs
```

Each component's `README.md` is its contract. Read it before changing the component, and change it in the same change.

## Commands

`emb` is the only entry point; CI calls the same tasks.

```sh
emb run lint            # type-check, links, import boundaries, helm lint — seconds
emb run test            # unit + integration, on a checkout (no stack)
emb up                  # the stack: saras on :3000, postgres, storage, mailbox, fakesmtp, webspicy
emb run test:postgres   # integration tests on the stack's PostgreSQL
emb run test:webspicy   # the API's contract
emb run demo            # the demo organisation and its mailbox
```

In `software/saras`: `npm test`, `npm run test:unit`, `npm run typecheck`, one file with `node --test test/unit/<name>.test.ts`.

**Done means:** `emb run lint` clean and `emb run test` passing, and the stack suites when the change touches the stack, a compose file, an env file or a seed. If something is red or was not run, say so.

## What will bite

- **The development database may hold real data.** Never install a seed on it (`storage:db.seed`, `db.check`, `POST /seeds/install`): it empties every table. `emb run demo` and `storage:db.apply` are safe. For anything else, use a stack of its own: `COMPOSE_PROJECT_NAME=saras-try COMPOSE_FILE=docker-compose.base.yml:docker-compose.test.yml emb up`, and `docker compose -p saras-try down -v` when done.
- **`.env` holds real secrets.** Do not read it or print it. `docker compose config` prints the resolved environment: use `config --quiet`. To see what a container got, grep `docker inspect` for the one variable, and say "from .env" rather than the value.
- **Env files.** `software/saras/env/base.env` describes every variable the server reads; `devel.env` names what it takes from `.env` as `${NAME:-default}`; `test.env` pins every one of those. No compose file lists `.env`. A new variable goes in `src/tooling/config.ts` and `base.env`; `test/unit/configuration.test.ts` holds them together. These files hold no secret, yet a tool may refuse to touch `**/env/*.env`: ask, do not work around it.
- **Guarantees that are not settings.** Every LLM request carries the zero-retention clause; a mail server gets a password over TLS only, unless it is local (which is why `world/mailbox` runs in the network of the saras container: decision 0005); nothing of an organisation is reachable from another; credentials are sealed with `APP_SECRET`; no log holds a secret or anything of a mail, whatever `LOG_LEVEL`. A change that makes one of these configurable is the wrong change.
- **`kubectl` may point at a real cluster.** The chart is held by `helm lint` and `helm template`, which reach none. Never `helm install` or `kubectl apply` to see whether it works: ask.
- **The mailbox container follows saras.** Recreating `saras` alone leaves `mailbox` in the old network; `emb up` or `emb run demo` puts it right.
- **A migration is applied when it is saved.** The development stack watches the sources: a file added to `software/saras/src/tooling/db/migrations/` and listed is applied to the development database at once, and not again once edited. Write it right first (`npm test`, or a stack of its own), and never edit one that was released: add another.
- **A seed is flushed, not written.** Change the demo by changing `software/saras/scripts/demo/setup.ts`, then `emb run storage:demo.rebuild`, and review the diff. A mailbox's access is sealed with the server's secret, so no seed carries one.

## Rules of the code (`software/saras`)

Each is held by a test, which will tell you:

- No file over 200 lines, no function over 20 (`test/unit/size.test.ts`).
- One file per operation, in `src/domain/<area>/`, named after it and headed by its clauses; pure decisions in `src/domain/computations/`, with a table of cases and no mock. A new operation is also a row in `doc/2-operations.md`.
- The domain knows nothing of HTTP; the browser imports nothing of the server; `shared/` declares the domain objects once and imports nothing (`tests/harness`, `test/unit/shared-types.test.ts`).
- Nothing is said with `console`: `log.info('what happened', { fields })` (`src/tooling/log.ts`), which redacts every line. Never a field holding an address, a folder, a body or anything of a mail: a mailbox, a member and an organisation are numbers in a log (`test/unit/logging.test.ts`, `test/integration/what-the-log-says.test.ts`, decision 0012).
- No sentence in the code: the interface's words are in `public/i18n/`, in every language; the server sends codes (`src/tooling/messages.ts`).
- Colours and fonts only in `public/design/tokens.css`, and a brand's inputs only in its `theme.css`, the default brand's in `public/brand/`; pages call components (`test/unit/design-system.test.ts`).
- Erasable TypeScript only (no enum, no parameter property): Node strips the types and runs the file.
- The schema changes by a new migration, numbered, that leaves the previous version of the server working (`test/integration/migrations.test.ts` holds the numbering; the rest is yours).
- Several servers may share one database. What must happen once is decided there, not in a server's memory: a turn of the clock (`src/tooling/clock.ts`), a key held (`db.hold`).

## Writing here

- A fact lives in one place. Documents link to each other rather than repeat; `emb run lint` fails on a link that leads nowhere.
- A choice between real alternatives is a record in `doc/decisions/`, with what would reverse it.
- Commit messages say, in a sentence, what is now true, then why: see `git log`.

## Read the one the task calls for

| Task | Read |
| --- | --- |
| Running the stack, the suites, the env files, translations, changing the schema | [`HACKING.md`](HACKING.md) |
| What a feature is meant to do | [`doc/1-user-stories.md`](doc/1-user-stories.md) |
| An operation, the state it changes, known deviations | [`doc/2-operations.md`](doc/2-operations.md) |
| Where a new thing goes; who may rely on whom | [`doc/3-architecture.md`](doc/3-architecture.md) |
| The interface: tokens, components, screens, brands | [`doc/4-design.md`](doc/4-design.md) |
| Working on the brand or the design system with Node.js alone: no `emb`, no Docker | [`DESIGN.md`](DESIGN.md) |
| The code layout of the server | [`software/saras/README.md`](software/saras/README.md) |
| Seeds, the demo | [`software/storage/README.md`](software/storage/README.md) |
| The Helm chart | [`world/chart/README.md`](world/chart/README.md) |
| A black-box specification | [`tests/webspicy/README.md`](tests/webspicy/README.md) |
