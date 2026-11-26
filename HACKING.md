# Working on saras

How the repository is laid out, how to run it, and where each thing is written down. What saras is and how to install it is in the [README](README.md).

## The repository

The directory says what a thing is for; [`doc/3-architecture.md`](doc/3-architecture.md) says it in full.

| | |
| --- | --- |
| [`software/saras/`](software/saras/) | The server and the interface it serves: every operation, and the state. Its [README](software/saras/README.md) says what it answers for, and how its code is laid out. |
| [`software/storage/`](software/storage/) | The seeds: the datasets the stack's database is put into, loaded by `dbagent`. |
| [`world/mailbox/`](world/mailbox/) | A member's mailbox, as the stack meets it: sample emails, and replies that go nowhere. |
| [`world/fakesmtp/`](world/fakesmtp/) | The outgoing mail server of the stack: it delivers nothing, and shows what it was given. |
| [`world/chart/`](world/chart/) | The Helm chart: saras on Kubernetes, for an operator. Nothing of the stack. |
| [`tests/webspicy/`](tests/webspicy/) | The black-box specification of the API, run through the front door of the stack. |
| [`tests/harness/`](tests/harness/) | The checks on the repository itself: links, and who may import whom. |
| [`doc/`](doc/) | The [user stories](doc/1-user-stories.md), the [operations and the state](doc/2-operations.md), the [architecture](doc/3-architecture.md), the [design](doc/4-design.md), the [decisions](doc/decisions/). |
| [`bin/`](bin/) | The few commands of the repository itself. |

Each component has a `README.md`, which is its contract (public interface, depends on, must not, harness, status), and an `Embfile.yml`, which holds its tasks.

## Commands

Every build and every suite is a task of [`emb`](https://github.com/enspirit/emb) (`npm install -g @enspirit/emb`). `emb tasks` lists them; CI calls them and nothing else.

```sh
emb run setup           # install the dependencies
emb run lint            # type-check, links, import boundaries, the chart
emb run build           # bundle the browser code
emb run test            # unit and integration tests: needs a checkout, not a stack

emb up                  # the stack, in Docker
emb run demo            # the demo organisation and its mailbox, on the stack
emb run test:postgres   # the integration tests on the stack's PostgreSQL
emb run test:webspicy   # the API's contract, from a container of its own
emb down
```

In `software/saras`, each task is the npm script of the same name (`npm test`, `npm run dev`…). `lint` and `test` also hold the Helm chart, and need [`helm`](https://helm.sh/docs/intro/install/) on the machine for it; no cluster.

## The stack

`emb up` starts saras with its sources mounted and watched, and what it runs in:

| Service | Is | On a laptop |
| --- | --- | --- |
| `saras` | The server, restarted and rebundled on change | http://localhost:7230 (`emb logs saras` shows its log, one JSON object per line: [decision 0012](doc/decisions/0012-the-server-logs-json-lines-and-never-what-it-protects.md)) |
| `postgres` | The database | `localhost:7254`, user and database `saras` |
| `storage` | `dbagent`, for the seeds and the pages of the schema | — |
| `mailbox` | The mailbox of sample emails, in the network of `saras` | — (`emb logs mailbox` shows what it was given to send) |
| `fakesmtp` | Where saras's own mail goes (the link of a lost password) | http://localhost:7210 |
| `webspicy` | The black-box suite; it sleeps until run | — |

The ports are saras's own, so that the stack starts beside another project's: **72, then the two digits the usual port starts with** (3000 is 7230, 5432 is 7254, 1080 is 7210). They are numbered in [`.env.commons`](.env.commons), and `SARAS_PORT=3000 emb up` takes another for once ([decision 0018](doc/decisions/0018-the-stack-takes-the-ports-72xx-of-a-laptop.md)).

It needs no `.env`. With one at the root of the repository, the server is given what [`software/saras/env/devel.env`](software/saras/env/devel.env) names of it, and nothing else: `APP_SECRET`, `BASE_URL`, `LOG_LEVEL`, the OpenRouter key, model and address, the OAuth applications, the outgoing mail. `SARAS_BRAND=klaro` in it picks a folder of `software/saras/brands/`.

Three compose files, two stacks: `docker-compose.base.yml` says what each service is; `devel` adds ports and mounts; `test` is what CI runs, with no published port and no secret. To try something without touching the development database, run a second stack beside the first:

```sh
COMPOSE_PROJECT_NAME=saras-try COMPOSE_FILE=docker-compose.base.yml:docker-compose.test.yml emb up
```

## The demo and the seeds

`emb run demo` applies the `demo` seed (one organisation, added to whatever the database holds), makes the mailbox of the stack anew, and connects it through the API. It is safe on a database you care about; **installing** a seed is not: `emb run storage:db.seed` empties every table, and asks for a word to be typed.

A seed is not written by hand: `emb run storage:demo.rebuild` sets the organisation up through the API in a stack of its own and flushes it. See [`software/storage`](software/storage/README.md).

## Changing the schema

The schema is the migrations of `software/saras/src/tooling/db/migrations/`, applied in order by the server when it starts, each once ([decision 0010](doc/decisions/0010-the-server-migrates-its-database-and-several-may-share-it.md)). To change it:

1. Add `NNNN-what-it-does.ts`, with the next number, and list it last in `src/tooling/db/migrations.ts`. It is SQL, run in one transaction: it need not be safe to run twice.
2. Write it so that **the version before still works on the result**: during an upgrade, servers of both versions share the database. Add now; remove what is no longer used in a later release.
3. Leave the ones before it alone. A migration that was applied is not applied again.

The development stack watches the sources: **the migration is applied to your development database the moment the file is saved and listed**. Get it right in a stack of its own first (below, `saras-try`), or with `npm test`, which starts from nothing each time. A table that is the server's own and belongs in no seed (the ledger, `scheduled_tasks`) is left out of `software/storage/data/empty`; any other is added there, by `emb run storage:demo.rebuild`.

To read the schema as it stands, with its tables, constraints and diagrams: `emb run storage:db.spy`, then open `software/storage/schema/spy/index.html`. See [`software/storage`](software/storage/README.md).

Several servers on one database: `ROLES` says what a process takes on (`migrate`, `web`, `clock`; all three by default), and `test/integration/several-servers.test.ts` starts two on one database.

## Tests

| Level | Holds | Where | Runs with |
| --- | --- | --- | --- |
| unit | The computations, as pure functions; and the checks that read the sources (sizes, shared types, design system, translations, configuration) | `software/saras/test/unit/` | `emb run test` |
| integration | The operations over HTTP, in an application each test starts itself, against a real local IMAP server, a real local SMTP server and a stand-in for OpenRouter that records what it is sent | `software/saras/test/integration/` | `emb run test`; `emb run test:postgres` on a PostgreSQL server |
| api | An operation as a client sees it, black box | `tests/webspicy/formaldoc/` | `emb run test:webspicy` |
| repository | Links, import boundaries | `tests/harness/` | `emb run lint` |
| chart | What the Helm chart renders and refuses, and that it knows every variable of `env/base.env` | `world/chart/` | `emb run lint`, `emb run test` |

Green means `emb run lint` clean and `emb run test` passing; and, for what touches the stack, the suites that need it. GitHub Actions runs all of it on every push, without any secret (`.github/workflows/test.yml`). Once it is green on `main` or on a version tag, a last job publishes the image with `emb run publish`: the only one that reads a secret, the Docker Hub login ([decision 0006](doc/decisions/0006-the-image-is-published-on-docker-hub.md)).

## Environment

| File | Holds | Read by |
| --- | --- | --- |
| `.env.commons` | The stack's vocabulary: compose files, published ports. Committed | `emb`, for every task |
| `.env` | Secrets, and one laptop's overrides. Not committed | `emb`; no compose file lists it |
| `software/saras/env/base.env` | Every variable the server reads, described, with its default. A test holds it to the code | The stack, and you |
| `software/saras/env/devel.env` | What the development stack changes, and what it takes from `.env`, as `${NAME:-default}` | The development stack |
| `software/saras/env/test.env` | What only the suites change; it pins everything `devel.env` takes from `.env` | The stack under the suites |

A new variable is read in `software/saras/src/tooling/config.ts` and described in `base.env`; `test/unit/configuration.test.ts` fails otherwise.

## How it works

```
mailbox ──► fetch the watched folder (IMAP / Gmail API / Graph)
              │
              ├─ a rule sets it aside ──► "no reply needed"   (automated mail, at first; never sent to the LLM)
              │
              └─ no rule does ──► "to handle"                  (with the attributes the other rules gave it)
                                        │
                     you write in the reply area, as much as you like
                                        │
              optionally, the LLM (ZDR): check typos / improve style / apply a prompt
                                        │
                       you review, edit, explain (optional)
                                        │
              sent in your name, or filed as a draft (SMTP / IMAP / Gmail API / Graph)
```

Every operation is one file under `software/saras/src/domain/<area>/`, named after it and headed by its clauses; [`doc/2-operations.md`](doc/2-operations.md) is the inventory. The paths below are in `software/saras/`.

**Sorting** is done when an email is fetched, by the rules of the organisation's attributes (`src/domain/sorting/sort-by-rules.ts`): each rule is an Elo expression given the email, which answers a value of its attribute or nothing. The rule of "Stands in" says where the email stands; when it says nothing the email is to handle. No LLM sorts ([decision 0011](doc/decisions/0011-the-ai-does-not-sort.md)), so nothing waits to be sorted and sorting cannot fail a fetch. Which prompt suits an email follows from its attributes and from what each prompt says it suits (`src/domain/computations/prompt-affinity.ts`).

**A reply** is sent as HTML with a plain-text alternative, both quoting the original. Only the elements an email needs are allowed (`src/tooling/html.ts`): whatever the LLM returns, and whatever is stored or sent, is rebuilt from that list on the server, and the interface sanitises again before displaying anything. A draft is filed in the mailbox's Drafts folder: over IMAP the folder flagged `\Drafts`, or named Drafts or Brouillons.

## Translations

Every word of the interface comes from a translation file; none is written in the code (`test/unit/i18n.test.ts` enforces it, and that every language has exactly the keys of the source language).

- **Files:** `software/saras/public/i18n/<language>/<section>.json`, one file per section of the interface, plus `index.json`, which lists the languages and names the default. The first part of a key is its section: `mailboxes.connect` is `connect` in `mailboxes.json`. English is the source language; French is provided.
- **Format:** Tolgee's native JSON — keys nested on dots, values in ICU MessageFormat: `{name}` parameters, `{count, plural, one {…} other {…}}`, `{kind, select, …}`, and `<tag>…</tag>` for a part the interface renders as a link or in bold.
- **In the code:** `t('key', params)` returns a string, `tRich('key', params, { link: … })` nodes (`web/i18n.ts`). The formatter (`web/i18n/format.ts`) is a small dependency-free implementation of that ICU subset.
- **Language shown:** the user's choice, else the first browser language available, else the default. A missing translation falls back to the default language.
- **Adding a language:** the folder `public/i18n/<tag>/` with the same files, one line in `index.json`, then `npm run build`.
- **With Tolgee:** `.tolgeerc.json` maps the files for the [Tolgee CLI](https://docs.tolgee.io/tolgee-cli): with a project id and `TOLGEE_API_KEY`, `npx @tolgee/cli push` and `pull`, each section being a namespace.

The server never sends sentences of its own to the interface: errors, verdicts made by rules and mailbox problems travel as a code with parameters (`src/tooling/messages.ts`, with their English text), which the interface translates under the `server.` keys. It remembers each member's language for what it writes on their behalf: the reason the LLM gives for a verdict, the line introducing the quoted original, the default prompt of a new organisation. The prompts sent to the LLM are in English, and a reply is always drafted in the language of the email received.

## Where it is written

| To know | Read |
| --- | --- |
| What saras is for, feature by feature | [`doc/1-user-stories.md`](doc/1-user-stories.md) |
| What it does, as state and operations; where the code deviates | [`doc/2-operations.md`](doc/2-operations.md) |
| Who may rely on whom; the stacks; the test levels | [`doc/3-architecture.md`](doc/3-architecture.md) |
| The design system, the screens, the brands | [`doc/4-design.md`](doc/4-design.md) |
| How a designer works on them, with Node.js alone | [`DESIGN.md`](DESIGN.md) |
| Why a thing is the way it is, and what would reverse it | [`doc/decisions/`](doc/decisions/) |
| What a component answers for, and how to test it | Its `README.md` |

A fact lives in one place. When the code and a document disagree, one of them changes in the same change; `emb run lint` checks that every link still leads somewhere.
