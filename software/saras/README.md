# saras

The server and the interface it serves: the **Backend** and the **Frontend** of [`doc/2-operations.md`](../../doc/2-operations.md). It is responsible for one thing: performing every operation of saras on behalf of a person, or on its own when a timer obliges it, and keeping the state those operations change.

## Public interface

Nothing else is public.

- **The operations, over HTTP**, under `/api`: one route per operation or observation, requests and answers in JSON. Their inventory, with the clauses of each, is [`doc/2-operations.md`](../../doc/2-operations.md), by area: access, settings, mailboxes, sorting, replying, prompts, attributes, boards. A route is open to visitors, to members (the default) or to administrators only; a write that is not JSON is answered `415`.
- **A refusal** is a status and a message code the interface translates: invalid `400`, unauthenticated `401`, forbidden `403`, not found `404`, conflict `409`, gone `410`, too many attempts `429`, a mail host or the LLM failing `502`.
- **The interface**: `/` and `/styleguide.html`, with the files they load. `/brand/*` is the brand folder when there is one, file by file, over the default brand.
- **Its configuration**: the environment variables of [`env/base.env`](env/base.env), each described there with its default, and nothing else. `APP_SECRET` is the only one it refuses to start without.
- **The brand folder** named by `BRAND_DIR`: `theme.css`, `brand.json`, a logo, a favicon. [`brands/example/`](brands/example/) is a complete one.
- **The image** `saras/saras`, built from this directory: it listens on `PORT` (3000), keeps the embedded database under `/data`, and is healthy when `GET /api/public` answers.
- **What it does on its own**: ExpireSessions and ErasePastRetention hourly and at start; FetchMailbox for every mailbox each `SYNC_INTERVAL_MINUTES`.

**The state it controls** is every variable `doc/2-operations.md` gives to the Backend, kept in PostgreSQL. It creates the schema itself when it starts (`src/tooling/db/schema.ts`): see [the decision](../../doc/decisions/0001-the-server-creates-its-schema.md).

## Depends on

No other component of ours. Third parties, each reached through one place:

| | Reached through | What is expected of it |
| --- | --- | --- |
| PostgreSQL: a server (`DATABASE_URL`), or the embedded one ([PGlite](https://pglite.dev)) | `src/tooling/db.ts`, `db/` | Keeps the state. Both speak the same SQL: one schema, one set of queries. |
| A mail provider: IMAP / SMTP, Gmail, Microsoft Graph | `src/tooling/mail/`, one provider per kind behind one interface | Controls the mailbox: lists folders, gives the messages of one, sends, files a draft. |
| An identity provider: Google, Microsoft | `src/tooling/mail/oauth.ts` | Grants lasting access to a mailbox by sign-in. |
| The LLM, through OpenRouter | `src/tooling/llm/openrouter.ts`, the only place where email content leaves the application | Honours `zdr` and `data_collection: deny`, or refuses the request. This is contractual: it cannot be verified from here. |
| The DNS | `src/tooling/mail/lookup.ts` | Says who hosts the mail of a domain. |
| An outgoing mail server of its own, optional (`SMTP_URL`) | `src/tooling/postman.ts` | Delivers the link of a lost password. |

## Must not

Each is held by the test named, or by a scanner of [`tests/harness`](../../tests/harness/).

1. **Send the LLM a request without the zero-retention clause**, whatever the configuration (`test/unit/privacy.test.ts`).
2. **Send the LLM a received email when only the member's text is asked about**, or an email the rules set aside as automated (`test/unit/privacy.test.ts`, `test/integration/sorting-by-the-ai.test.ts`).
3. **Let anything of an organisation be reached from another** (`test/integration/separate-organisations.test.ts`).
4. **Keep a credential unsealed, or a password other than as a hash** (`test/unit/sealing-secrets.test.ts`).
5. **Trust incoming content**: what a reply may contain is rebuilt from a list, and a page loads only its own files (`test/unit/rich-text-replies.test.ts`, `test/integration/page-security.test.ts`).
6. **Declare a domain object twice**: `shared/` declares them once for the server and the browser, and imports nothing (`test/unit/shared-types.test.ts`).
7. **Know HTTP in the domain, or the server in the browser**: an operation refuses with a kind, and `src/tooling/http/refusals.ts` alone turns it into a status; `web/` reaches the server through `/api` and shares only `shared/` with it (`tests/harness`, the boundaries).
8. **Grow a file past 200 lines or a function past 20** (`test/unit/size.test.ts`).
9. **Write a colour, a font or a sentence where it does not belong**: the design system's layering and the translations' completeness (`test/unit/design-system.test.ts`, `test/unit/i18n.test.ts`).

## Harness

```sh
emb run saras:lint               # both TypeScript projects, server and browser
emb run saras:test               # unit + integration, on a checkout
emb run saras:test:unit          # the computations and the checks on the sources: no server started
emb run saras:test:integration   # the operations over HTTP
emb run test:postgres            # the integration tests on the stack's PostgreSQL server; needs `emb up`
emb run test:webspicy            # its contract over HTTP, from outside; needs `emb up`
```

Each task calls the npm script of the same name, so `npm test` in this directory is the same run.

- **`test/unit/`**: a table of cases per pure function of `src/domain/computations/` and of the tooling, without a mock; and the checks that read the sources (sizes, shared types, design system, translations).
- **`test/integration/`**: one file per subject, in the words of the user stories. Each starts the application wired as `src/main.ts` wires it, on a database of its own, with a real local IMAP server, a real local SMTP server and a stand-in for OpenRouter that records what it is sent (`test/support/`). No secret and no outside service.
- The database is the embedded one, in memory; with `TEST_DATABASE_URL`, a PostgreSQL server, where each file works in a schema of its own.

Green means: `lint` clean, and every test passing on both databases.

## Status

> **In flight:** nothing.

- Every operation of the inventory exists. Where the code does not do what the documents say is listed there, under Deviations.
- The black-box specification of the operations has begun in [`tests/webspicy`](../../tests/webspicy/), with what reads and what refuses. For everything else the tests of `test/integration/` still play that part, inside this component.
- The image is not published to a registry: an operator builds it from a checkout, and the repository describes no deployment ([decision 0004](../../doc/decisions/0004-saras-ships-as-an-image.md)).
- The pure functions live in `src/domain/computations/` and `shared/`, inside this component, not in a library of their own.

## Inside

- `shared/`: the domain objects as members see them (mailbox, email, proposal, reply, prompt, member, organisation), declared once for the server and the browser.
- `src/domain/`: what saras does, by area. Each operation has its file, named after it and headed by its clauses (`replying/send-reply.ts`…); `computations/` holds the pure decisions; `state/` reads and writes the state; `observations/` holds what members read; `model/` what is kept. [`doc/2-operations.md`](../../doc/2-operations.md) is the inventory.
- `src/domain/sorting/`: the triage gate, its strategies, and the header rules applied before it.
- `src/domain/mailboxes/fetch-mailbox.ts`: fetch, then sort, then prepare proposals.
- `src/tooling/`: how it is done, with no business rule: `http/` (the HTTP API: `server.ts`, and one file of routes per area), `db.ts` and `db/` (driver and schema), `mail/` (one provider per kind of mailbox, same interface), `llm/openrouter.ts` (the OpenRouter client, privacy policy enforced), `crypto.ts`, `config.ts`, `html.ts`, `messages.ts`.
- `web/`: the interface's TypeScript, one page file per subject under `pages/` and one function per operation under `api/` (see "Design system"); `public/`: its static files (HTML, CSS, default brand, translations).
- Data: PostgreSQL (see "Database").

### TypeScript

Everything is TypeScript in strict mode.

- **Server and tests** run directly on Node.js, which strips the types itself: there is nothing to compile, `npm start` and `npm test` execute the `.ts` files. The code therefore only uses erasable syntax (no enums, no parameter properties), which the compiler enforces.
- **Browser code** is bundled by `npm run build` ([esbuild](https://esbuild.github.io), `scripts/build.ts`) into `public/js/` (not committed): the interface from `web/` and `shared/` with the two browser libraries (see "Third-party software"), the design system's style sheets as one file, and the translations as one file per language. A first page load is about ten requests.
- `npm run typecheck` checks both; the bundler itself does not check types. `npm run dev` rebuilds the bundles and restarts the server on change.
- **What the server returns is typed once**, in `shared/`: the server's read queries and operations return those types, and `web/api/` reads them. A test (`test/unit/shared-types.test.ts`) keeps either side from declaring a domain object of its own.
- **Small files, small functions**: no source file (TypeScript, CSS) has more than 200 lines, and no function more than 20. `test/unit/size.test.ts` enforces both, and lists what is over.

### Design system

The interface follows the hierarchy tokens → atoms → molecules → organisms → pages, one folder per tier and one file per component, in CSS and in TypeScript alike:

| Tier | Styles (`public/design/`) | Components (`web/ui/`) | Content |
| --- | --- | --- | --- |
| Tokens | `tokens.css` | — | Brand inputs `--brand-*`, then semantic tokens `--color-*`, `--font-*`, `--space-*`, `--radius-*`… |
| Base | `base.css` | `dom.ts` | HTML element defaults; the single element-creation function. |
| Atoms | `atoms/*.css` | `atoms/*.ts` | `Icon`, `Button`, `Badge`, `Input`, `Select`, `Textarea`, `Checkbox`, `Notice`, `Avatar`, `Chip`, `Text`, `BrandMark`… |
| Molecules | `molecules/*.css` | `molecules/*.ts` | `Field`, `Card`, `PageHeader`, `Tabs`, `Table`, `Choices`, dialogs, `NavItem`, `EmailListItem`, `RichEditor`, `RecipientField`, toast… |
| Organisms | `organisms/*.css` | `organisms/*.ts` | `AppShell`, `AuthPanel`, `Page`, `Mailbox`, `Reading`, `ReadingHeader`, `ReplyDock`. |
| Pages | — | `web/app.ts`, `web/pages/`, `web/styleguide.ts` | Behaviour only, assembled from components; wording comes from the translation files. |

Rules, enforced by `test/unit/design-system.test.ts`:

- a colour or a font is written as a literal only in `tokens.css`;
- components use semantic tokens only, never `--brand-*`;
- pages write neither class names nor HTML elements: they call components;
- dependencies only point downwards (an atom never imports a molecule);
- a brand theme may only set tokens that exist.

CSS cascade layers (`@layer`) make the hierarchy effective: a molecule always wins over an atom, and `theme.css`, loaded outside any layer, wins over everything without `!important`.

To add a component: the function in `web/ui/<tier>/<component>.ts`, its style in `public/design/<tier>/<component>.css` (listed in `public/design/index.css`), an example in `web/styleguide/<tier>.ts`.

The aims of the design, its tokens and components, and how each screen is put together are in [`doc/4-design.md`](../../doc/4-design.md).
