# saras

The server and the interface it serves: the **Backend** and the **Frontend** among [the agents of saras](../../tests/operations/specification/agents.yml). It is responsible for one thing: performing every operation of saras on behalf of a person, or on its own when a timer obliges it, and keeping the state those operations change.

## Public interface

Nothing else is public.

- **The operations, over HTTP**, under `/api`: one route per operation or observation, requests and answers in JSON. Each is specified, with its clauses, in [`tests/operations`](../../tests/operations/), by area: access, settings, mailboxes, sorting, replying, prompts, attributes, boards. A route is open to visitors, to members (the default) or to administrators only; a write that is not JSON is answered `415`.
- **What an operation takes** is the type of its input in [`tests/operations/specification`](../../tests/operations/specification/): the parameters of its path, with its body, or its query for a `GET`. What is not of that type is refused `400`, with the code its constraint names or `request.invalid` and where ([decision 0021](../../doc/decisions/0021-an-input-is-refused-when-it-is-not-of-its-type.md)). The areas move to it one by one: boards so far; a route that names no operation of the specification checks nothing yet.
- **A refusal** is a status and a message code the interface translates: invalid `400`, unauthenticated `401`, forbidden `403`, not found `404`, conflict `409`, gone `410`, too many attempts `429`, a mail host or the LLM failing `502`.
- **The interface**: `/` and `/styleguide.html`, with the files they load. `/brand/*` is the brand folder when there is one, file by file, over the default brand.
- **Its configuration**: the environment variables of [`env/base.env`](env/base.env), each described there with its default, and nothing else. `APP_SECRET` is the only one it refuses to start without.
- **The brand folder** named by `BRAND_DIR`: `theme.css`, `brand.json`, a logo, a favicon. [`brands/example/`](brands/example/) is a complete one.
- **The image** `saras/saras`, built from the root of the repository (this directory and the specification of the operations) and published as [`enspirit/saras`](https://hub.docker.com/r/enspirit/saras): it listens on `PORT` (3000), keeps the embedded database under `/data`, and is healthy when `GET /api/public` answers.
- **Its log**, on the standard output: one JSON object per line, with `time`, `level` (`debug`, `info`, `warn`, `error`) and `msg`, then fields. `LOG_LEVEL` says from which level up. Every line of a request carries its id as `req`: the `x-request-id` it came with, or one the server gives it, said back in the answer. A request is logged when it is answered, and as *left unanswered* when whoever asked gave up first; reaching a mail server, step by step, with what it answered when it did not let us in. What is logged and what never is: [decision 0012](../../doc/decisions/0012-the-server-logs-json-lines-and-never-what-it-protects.md).
- **What it does on its own**: ExpireSessions and ErasePastRetention hourly; FetchMailbox for every mailbox each `SYNC_INTERVAL_MINUTES`.
- **Its roles**, `ROLES`: `migrate` (bringing the database to what this version expects, at start), `web` (the two first items above) and `clock` (the one just above). A process takes all three unless told otherwise, and is then a whole installation. Several may run on one PostgreSQL server, with all three or sharing them out; `migrate` alone ends once the database is migrated, with status 0.

**The state it controls** is every variable [the state of the specification](../../tests/operations/specification/state.yml) gives to the Backend, kept in PostgreSQL. It changes the schema itself, one migration after the other, when it starts (`src/tooling/db/migrations/`): see [the decision](../../doc/decisions/0010-the-server-migrates-its-database-and-several-may-share-it.md).

## Depends on

Of ours, the specification of the operations, [`tests/operations/specification`](../../tests/operations/specification/): its types are what the server checks its inputs against, read when it starts through the link `specification/` (a copy in the image). Third parties, each reached through one place:

| | Reached through | What is expected of it |
| --- | --- | --- |
| PostgreSQL: a server (`DATABASE_URL`), or the embedded one ([PGlite](https://pglite.dev)) | `src/tooling/db.ts`, `db/` | Keeps the state. Both speak the same SQL: one schema, one set of queries. |
| A mail provider: IMAP / SMTP, Gmail, Microsoft Graph | `src/tooling/mail/`, one provider per kind behind one interface | Controls the mailbox: lists folders, gives the messages of one, sends, files a draft. An IMAP or SMTP server accepts a connection within 15 seconds and greets within 15 more, or is told to the member as not answering. In the stack, [`world/mailbox`](../../world/mailbox/) for IMAP / SMTP. |
| An identity provider: Google, Microsoft | `src/tooling/mail/oauth.ts` | Grants lasting access to a mailbox by sign-in. |
| The LLM, through OpenRouter | `src/tooling/llm/openrouter.ts`, the only place where email content leaves the application | Honours `zdr` and `data_collection: deny`, or refuses the request. This is contractual: it cannot be verified from here. |
| The DNS | `src/tooling/mail/lookup.ts` | Says who hosts the mail of a domain. |
| An outgoing mail server of its own, optional (`SMTP_URL`) | `src/tooling/postman.ts` | Delivers the link of a lost password. In the stack, [`world/fakesmtp`](../../world/fakesmtp/). |

## Must not

Each is held by the test named, or by a scanner of [`tests/harness`](../../tests/harness/).

1. **Send the LLM a request without the zero-retention clause**, whatever the configuration (`test/unit/privacy.test.ts`).
2. **Send the LLM a received email when only the member's text is asked about**, or an email the rules set aside as automated (`test/unit/privacy.test.ts`, `test/integration/proposals-at-fetch.test.ts`).
3. **Let anything of an organisation be reached from another** (`test/integration/separate-organisations.test.ts`).
4. **Keep a credential unsealed, or a password other than as a hash** (`test/unit/sealing-secrets.test.ts`).
5. **Trust incoming content**: what a reply may contain is rebuilt from a list, and so is a received email shown as it was written, in a document that may run nothing, reach no host and be framed by our pages only; a file attached is shown only when a browser runs nothing of it; a page loads only its own files (`test/unit/received-html.test.ts`, `test/integration/an-email-as-it-was-written.test.ts`, `test/unit/rich-text-replies.test.ts`, `test/integration/page-security.test.ts`).
6. **Declare a domain object twice**: `shared/` declares them once for the server and the browser, and imports nothing (`test/unit/shared-types.test.ts`).
7. **Know HTTP in the domain, or the server in the browser**: an operation refuses with a kind, and `src/tooling/http/refusals.ts` alone turns it into a status; `web/` reaches the server through `/api` and shares only `shared/` with it (`tests/harness`, the boundaries).
8. **Grow a file past 200 lines or a function past 20** (`test/unit/size.test.ts`).
9. **Write a colour, a font or a sentence where it does not belong**: the design system's layering and the translations' completeness (`test/unit/design-system.test.ts`, `test/unit/i18n.test.ts`).
10. **Do twice, with several servers on one database, what one server does once**: apply a migration, run a task of its clock, fetch a mailbox while it is being fetched, hand a reply over (`test/integration/migrations.test.ts`, `the-clock.test.ts`, `several-servers.test.ts`). What a server keeps in its memory alone is the count of wrong guesses.
11. **Log a password, a key, a cookie, who signs in at a mail server, an address, a folder, or anything of a mail or of a request's body**, at any level; or say anything other than through its log (`test/unit/logging.test.ts`, `test/integration/what-the-log-says.test.ts`).
12. **Edit a migration that was released, or write one the version before cannot live with**: the first is not applied again, and the second breaks the servers still running during an upgrade. Held by nothing but the one who writes it.

## Harness

```sh
emb run saras:lint               # both TypeScript projects, server and browser
emb run saras:test               # unit + integration, on a checkout
emb run saras:test:unit          # the computations and the checks on the sources: no server started
emb run saras:test:integration   # the operations over HTTP
emb run test:postgres            # the integration tests on the stack's PostgreSQL server; needs `emb up`
emb run test:operations          # its operations as their clauses say them, from outside; on the stack under the suites
```

Each task calls the npm script of the same name, so `npm test` in this directory is the same run.

- **`test/unit/`**: a table of cases per pure function of `src/domain/computations/` and of the tooling, without a mock; and the checks that read the sources (sizes, shared types, design system, translations).
- **`test/integration/`**: one file per subject, in the words of the user stories. Each starts the application wired as `src/main.ts` wires it, on a database of its own, with a real local IMAP server, a real local SMTP server and a stand-in for OpenRouter that records what it is sent (`test/support/`). No secret and no outside service.
- The database is the embedded one, in memory; with `TEST_DATABASE_URL`, a PostgreSQL server, where each file works in a schema of its own.

Green means: `lint` clean, and every test passing on both databases.

## Status

> **In flight:** what an operation is given is checked against its type ([decision 0021](../../doc/decisions/0021-an-input-is-refused-when-it-is-not-of-its-type.md)): boards are. Where a checked input does not yet secure the code downstream is listed there, [where the code falls short of it](../../doc/decisions/0021-an-input-is-refused-when-it-is-not-of-its-type.md#where-the-code-falls-short-of-it).

- Every operation specified exists. Where the code does not do what the documents say is listed in [the deviations](../../doc/2-deviations.md).
- The operations are specified from outside in [`tests/operations`](../../tests/operations/), which says what it leaves to the tests of `test/integration/`, inside this component: what needs the LLM, a second factor, the lock-out, and what the server does on its own.
- The image is published on Docker Hub by CI, from `main` and from version tags ([decision 0006](../../doc/decisions/0006-the-image-is-published-on-docker-hub.md)); the repository describes no deployment ([decision 0004](../../doc/decisions/0004-saras-ships-as-an-image.md)), and holds a Helm chart for operators, [`world/chart`](../../world/chart/).
- The pure functions live in `src/domain/computations/` and `shared/`, inside this component, not in a library of their own.

## Inside

- `shared/`: the domain objects as members see them (mailbox, email, proposal, reply, prompt, member, organisation), declared once for the server and the browser.
- `src/domain/`: what saras does, by area. Each operation has its file, named after it and headed by its clauses (`replying/send-reply.ts`…); `computations/` holds the pure decisions; `state/` reads and writes the state; `observations/` holds what members read; `model/` what is kept; `refusal.ts`, a refusal and its kind, which `tooling/http/refusals.ts` turns into a status; `world.ts`, what an operation acts in (`World`) and on behalf of whom (`Actor`). [`tests/operations`](../../tests/operations/) specifies each operation.
- `src/domain/sorting/`: sorting by the rules of the organisation's attributes, when an email is fetched and again when a rule changes; the corrections a member makes.
- `src/domain/mailboxes/fetch-mailbox.ts`: fetch, sorted by the rules, then prepare proposals.
- `src/tooling/`: how it is done, with no business rule: `http/` (the HTTP API: `server.ts`, one file of routes per area, and `inputs.ts`, the check of what an operation is given), `specification.ts` (what the server reads of the specification: its types, and the entry and input of each operation), `db.ts` and `db/` (the two drivers, the migrations and what applies them), `clock.ts` (the tasks the server runs on its own, due in the database), `mail/` (one provider per kind of mailbox, same interface), `llm/openrouter.ts` (the OpenRouter client, privacy policy enforced), `log.ts` (the one place that writes the log) and `redaction.ts` (what no line may hold), `mail/log/` (what is repeated of a conversation with a mail server), `http/access-log.ts` (what is logged of a request), `crypto.ts`, `config.ts`, `html.ts`, `messages.ts`.
- `web/`: the interface's TypeScript, one page file per subject under `pages/` and one function per operation under `api/` (see "Design system"); `public/`: its static files (HTML, CSS, default brand, translations).
- Data: PostgreSQL, a server or the embedded one (`src/tooling/db.ts`).

### Where the state is kept

Each variable of [the state](../../tests/operations/specification/state.yml), who controls it and who monitors it, and where the code keeps it. Essential state only: what another agent can observe.

| Variable | Meaning | Controlled by | Monitored by | Concrete copies |
| --- | --- | --- | --- | --- |
| Organisation | A team's private space: its name. | Backend | Members | `organizations.name` |
| Writing | When a proposal is written for an email to handle: on demand (`none`), at fetch (`draft`), at fetch and filed in the mailbox's drafts (`mailbox`). | Backend | Members | `organizations.automation`; `Organization.writing` in `shared/` |
| Automated mail first | Whether plainly automated mail is set aside by rule before anything else. | Backend | Members | `organizations.skip_automated` |
| Organisation's AI | Its model and its own key, the same for every member. | Backend | Administrators (key: presence only) | `organizations.model`, `.openrouter_key_enc` |
| Member | A person's account in one organisation: address, name, role, password. | Backend | Administrators, the member | `users.*`; `session.me` in the frontend |
| Member's settings | Language, signature. | Backend (language also Frontend) | The member | `users.language`, `.signature` (`.model` and `.openrouter_key_enc` remain from before and are no longer read); `localStorage` (language) |
| Second factor | The secret a member's authenticator app shares with the server, the last code step accepted, and their recovery codes. | Backend | The member (at set-up only) | `users.totp_secret_enc` (sealed), `.totp_last_step`, `.recovery_codes_json` (hashes) |
| Sign-in in progress | That a password was accepted and a second factor is awaited, for ten minutes. | Backend | Frontend | `sign_ins_in_progress`; the `signin` cookie |
| Password reset | A pending right to choose a new password, for an hour. | Backend | Whoever holds the link | `password_resets` (the token as a hash only) |
| Session | That a browser is signed in as a member, until when. | Backend | Frontend | `sessions`; the `sid` cookie |
| Attempt count | Wrong guesses of a password or an invitation token from one origin, in the last fifteen minutes. | Backend | Visitors (as a refusal) | in memory (`World.attempts`) |
| Invitation | A pending right to join an organisation with a role, until a date. | Backend | Administrators, the invited person | `invitations` (the token as a hash only) |
| Mailbox | A connected address: kind, personal or shared, who manages it, its credentials. | Backend | Members who may use it | `accounts.*` (credentials sealed) |
| Watched folder | The one folder of a mailbox that is fetched. | Backend | Members who may use it | `accounts.folder`, `.folder_name` |
| Fetch state | When a mailbox was last fetched and what went wrong. | Backend | Members who may use it | `accounts.last_sync_at`, `.last_error` |
| Email | A received message as saras keeps it: who, what, when, its text and its HTML when it has one; the text and the HTML erased past retention. Of a file attached, its name, type and size. | Backend | Members who may use its mailbox | `emails.*` |
| Email status | Where the email stands: to handle, no reply needed, ignored, replied. | Backend | Members | `emails.status` |
| Triage verdict | Who sorted the email (a rule, a member, nobody; the AI, on emails it sorted when it did), why. | Backend | Members | `emails.triage_source`, `.triage_reason` (`.suggested_prompt_id` and `.priority` remain from before and are no longer read) |
| Proposal | A text the AI wrote for an email: by which help, prompt and model. | Backend | Members | `drafts` |
| Reply in progress | What a member has written or changed in the reply area, its recipients, the reason for an edit. | Frontend | The member | the editor and fields of the composer (lost on leaving the page) |
| Reply | What was handed to the mailbox for an email: sent or filed as a draft, to whom, by whom, whether the proposal was edited and why. | Backend | Members | `replies` |
| Prompt | A way of replying: name, when to use it, instructions. | Backend | Administrators (members: name and description) | `prompts` |
| Board | A named view of emails: a filter on their attributes and on their facts (mailbox, how recent, sender, keywords, attachments), personal or shared. A condition on an attribute, the mailbox, the sender or keywords says what an email is, or what it is not (`except`). | Backend | Its owner; every member when shared | `boards` (the filter as JSON); `shared/board.ts` |
| Order of boards | The order a member gave to the boards of their menu; until they give one, the shared ones first, then their own, each as it was made. | Backend | The member | `users.board_order_json` |
| Attribute | Something the organisation wants to know of each email: a choice among values, or a member. One is pre-configured, with a fixed name and fixed values whose colours the organisation chooses: "Stands in". The others are the organisation's own; it starts with one, a priority ([decision 0014](../../doc/decisions/0014-the-priority-is-an-attribute-of-the-organisation.md)). Each says who decides it: nobody, or a rule written in Elo. | Backend | Members; administrators change them | `attributes`; for "Stands in", `organizations.skip_automated`; `shared/attribute.ts` |
| Value of an email for an attribute | The value, and who decided it: a rule, a member by hand. | Backend | Members who may use its mailbox | `emails.status`, `.attributes_json` |
| Mailbox contents | The messages, drafts and flags at the provider. | Mail provider | Backend, the member in their mail client | outside saras |

Accidental state, left out: fetches in flight (`running` in `fetch-mailbox.ts`), replies on their way to the mailbox (`World.handingOver`), the sign-in under way at a mail host (`sessions.oauth_state`), box counts cached in the frontend.

### Where the notions and the decisions of the domain live

What a predicate or a function of the specification names, and where the code decides it.

| Notion | Definition | Where it lives |
| --- | --- | --- |
| May use a mailbox | It is in the member's organisation, and is theirs or shared. | `mayUse` (a SQL condition), `mailboxFor`, `emailFor` in `state/` |
| Manages a mailbox | Shared: the member is an administrator. Personal: it is theirs. | `manages` in `computations/mailboxes.ts` |
| Box | To reply = `needs_reply`; Solved = `no_reply`; Answered = `sent`; Archive = `ignored`. | `BOXES` in `shared/email.ts`; `computations/boxes.ts` counts by it |
| Sign-up is open | The operator allows it, or no account exists yet. | `signUpIsOpen` in `computations/access.ts` |
| Key in force | The organisation's, else the server's. Same order for the model. | `computations/key-in-force.ts` |
| Locked out | Ten wrong guesses from one origin within fifteen minutes. | `isLockedOut` in `computations/access.ts` |
| Proposal was edited | The final text differs from the proposed one, whitespace aside. | `wasEdited` in `computations/reply.ts`; a second version in `web/pages/reply-in-progress.ts` (`norm`) |
| Passage to complete | A passage in square brackets of 2 to 80 characters. | `TO_COMPLETE` in `web/pages/reply-in-progress.ts` only |
| Automated mail | Mailing-list headers, `no-reply` senders, bulk precedence. | `sorting/rules.ts` |

The decisions and transformations, pure, in `src/domain/computations/` unless said otherwise: no database, no network, no clock of their own, unit-tested in `test/unit/` (`computations.test.ts`, `replying.test.ts`, and a file named after each subject).

| File | What it decides or transforms |
| --- | --- |
| `access.ts` | Is sign-up open; may this account be opened (address, password length); is the address free; the name of a new organisation; the role an invitation gives; may the last administrator be demoted; may one delete oneself; is this origin locked out. |
| `mailboxes.ts` | Who manages a mailbox; shared or personal; who shares one later; is the address already connected; what is given to connect by servers; the same servers with a new password; is it the very mailbox to renew; is the folder one of the mailbox's; what a session remembers of a sign-in at a host, and whether an answer is to it. |
| `settings.ts` | Is this a model identifier; a way of writing. |
| `sorting.ts` | May an email be sorted again by a member. |
| `replying.ts` | The proposal as HTML; is something written; is the email's content kept; may the reply be handed over (recipients, text, status, none in flight); what a hand-over records (edited or not, the reason kept or dropped); which prompt a prepared proposal uses. |
| `reply.ts` | Who to reply to, the subject, the threading headers, the quoted body; whether the proposal was edited. |
| `prompts.ts` | What a prompt must contain. |
| `given.ts` | What a client gives, reduced: clipped text, addresses, a language tag. For the areas whose inputs are not yet checked against their types ([decision 0021](../../doc/decisions/0021-an-input-is-refused-when-it-is-not-of-its-type.md)). |
| `emails.ts` | A stored row as an email. |
| `key-in-force.ts` | Member, organisation, configuration → the key and model in force. |
| `llm-prompts.ts` | An email, a prompt, a text → what is sent to the LLM. |
| `tooling/llm/openrouter.ts` (`buildChatRequest`, `explainError`) | The request with its privacy clause; an error as a problem. |
| `tooling/html.ts`, `text.ts` | What a reply may contain; text ↔ HTML. |
| `tooling/mail/lookup.ts` (`classifyMx`, `domainOf`), `gmail.ts`, `graph.ts` | MX names → who hosts the mail; a provider's message → an email. |
| `web/mail-presets.ts` (`serversFor`) | An address → servers to propose. |

Still buried in the interface (`web/pages/`):

| Decision | Buried in |
| --- | --- |
| Passages to complete; whether the member edited the proposal | `TO_COMPLETE`, `norm` in `web/pages/reply-in-progress.ts` |
| Where the tour goes next | `pathOf`, `leaveStep` in `web/pages/getting-started/path.ts` |

### TypeScript

Everything is TypeScript in strict mode.

- **Server and tests** run directly on Node.js, which strips the types itself: there is nothing to compile, `npm start` and `npm test` execute the `.ts` files. The code therefore only uses erasable syntax (no enums, no parameter properties), which the compiler enforces.
- **Browser code** is bundled by `npm run build` ([esbuild](https://esbuild.github.io), `scripts/build.ts`) into `public/js/` (not committed): the interface from `web/` and `shared/` with the two browser libraries (see "Third-party software"), the design system's style sheets as one file, and the translations as one file per language. A first page load is about ten requests.
- `npm run typecheck` checks both; the bundler itself does not check types. `npm run dev` rebuilds the bundles and restarts the server on change. `npm run design` does the same with the mailbox of sample emails of [`world/mailbox`](../../world/mailbox/) beside it and the demo organisation set up, for who works on the design with Node.js alone ([`DESIGN.md`](../../DESIGN.md)).
- **What the server returns is typed once**, in `shared/`: the server's read queries and operations return those types, and `web/api/` reads them. A test (`test/unit/shared-types.test.ts`) keeps either side from declaring a domain object of its own.
- **Small files, small functions**: no source file (TypeScript, CSS) has more than 200 lines, and no function more than 20. `test/unit/size.test.ts` enforces both, and lists what is over.

### Design system

The interface follows the hierarchy tokens → atoms → molecules → organisms → pages, one folder per tier and one file per component, in CSS and in TypeScript alike:

| Tier | Styles (`public/design/`) | Components (`web/ui/`) | Content |
| --- | --- | --- | --- |
| Tokens | `tokens.css`, after `public/brand/theme.css` | — | Brand inputs `--brand-*`, declared by the default brand; then the semantic tokens derived from them, `--color-*`, `--font-*`, `--space-*`, `--radius-*`… |
| Base | `base.css` | `dom.ts` | HTML element defaults; the single element-creation function. |
| Atoms | `atoms/*.css` | `atoms/*.ts` | `Icon`, `Button`, `Badge`, `Input`, `Select`, `Textarea`, `Checkbox`, `Notice`, `Avatar`, `Chip`, `Text`, `BrandMark`… |
| Molecules | `molecules/*.css` | `molecules/*.ts` | `Field`, `Card`, `PageHeader`, `Tabs`, `Table`, `Choices`, dialogs, `NavItem`, `EmailListItem`, `RichEditor`, `RecipientField`, toast… |
| Organisms | `organisms/*.css` | `organisms/*.ts` | `AppShell`, `AuthPanel`, `Page`, `Mailbox`, `Reading`, `ReadingHeader`, `ReplyDock`. |
| Pages | — | `web/app.ts`, `web/pages/`, `web/styleguide.ts` | Behaviour only, assembled from components; wording comes from the translation files. |

Rules, enforced by `test/unit/design-system.test.ts`:

- a colour or a font is written as a literal only in `tokens.css`, or in a brand's `theme.css`;
- components use semantic tokens only, never `--brand-*`;
- pages write neither class names nor HTML elements: they call components;
- dependencies only point downwards (an atom never imports a molecule);
- a brand theme may only set tokens that exist;
- the default brand declares every brand input and `tokens.css` none: each is written once.

CSS cascade layers (`@layer`) make the hierarchy effective: a molecule always wins over an atom, and `theme.css`, loaded outside any layer, wins over everything without `!important`. The default brand's is also bundled with the tokens, in their layer, so a brand that leaves an input out keeps the default's ([decision 0015](../../doc/decisions/0015-the-default-brand-declares-the-brand-inputs.md)).

To add a component: the function in `web/ui/<tier>/<component>.ts`, its style in `public/design/<tier>/<component>.css` (listed in `public/design/index.css`), an example in `web/styleguide/<tier>.ts`.

The aims of the design, its tokens and components, and how each screen is put together are in [`doc/4-design.md`](../../doc/4-design.md).
