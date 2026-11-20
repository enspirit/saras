# saras

[![Tests](https://github.com/enspirit/saras/actions/workflows/test.yml/badge.svg)](https://github.com/enspirit/saras/actions/workflows/test.yml)

A self-hosted web tool to answer email with the help of AI, without handing it the keys:

1. **Connect** one or more mailboxes: IMAP/SMTP, Gmail / Google Workspace (OAuth), Outlook / Microsoft 365 (OAuth), and choose the one folder of each to watch (the inbox by default).
2. **Identify** the emails that are waiting for a reply: what is fetched from that folder passes a triage gate. By default the gate decides nothing and every email is to be handled; an LLM can do it instead.
3. **Draft** a reply from a *system prompt* prepared by an administrator, chosen email by email, with one-off instructions when needed.
4. **Send** in your name after review, or **save as a draft** in your mailbox to finish there. If you change the proposal you can say why: that reason is fed into your next drafts made with the same prompt.

Nothing is sent without explicit validation.

Everything is in English by default, and the interface is also available in French (see "Translations").

## Folders and triage

**One folder per mailbox.** After connecting a mailbox, the user chooses the folder to watch: the inbox, or any other (an IMAP folder, a Gmail label, an Outlook folder). Nothing is fetched before that choice, and only that folder ever is. Watching a folder you fill yourself — by hand or with your mail client's own rules — is the simplest way to decide what deserves a reply.

**The triage gate.** Every fetched email passes through a gate, which answers two questions: is a reply needed, and with which prompt. It is an abstraction (`src/triage/gate.ts`) with interchangeable strategies:

```ts
interface TriageGate {
  readonly name: string;
  decide(batch: { prompts: TriagePrompt[]; mails: TriageMail[] }): Promise<TriageDecision[]>;
}
```

- **In:** the prompts (id, name, description) and up to 20 mails, each with `from`, `to`, `cc`, `subject`, `body` and its attachments' names, types and sizes. Never the content of an attachment, and nothing else: no database, no mailbox.
- **Out:** per mail, `replyNeeded` and `promptId` (or `null` to let the user choose), plus an optional `reason` and `priority`.
- A mail the gate says nothing about, or a gate that fails, leaves the mail untriaged; it is presented again at the next fetch.

| `TRIAGE_STRATEGY` | What it does | Cost |
| --- | --- | --- |
| `none` (default) | Decides nothing: every mail of the watched folder is to be handled, and the user picks the prompt. | None. No email content leaves the server until a draft is asked for. |
| `ai` | An LLM decides and suggests a prompt. It reads the sender, subject, the first 1,500 characters of the text and the attachment names. | One LLM request per batch of 20 mails. |

To add a strategy (a rules engine, for instance), implement `TriageGate` and return it from `src/triage/index.ts`.

**Before the gate**, header rules set plainly automated mail aside (no-reply senders, mailing lists, automatic replies, bulk mail, and over IMAP what you already answered), so that no strategy spends anything on it. Those emails stay visible under "No reply needed" and can be moved back. `TRIAGE_SKIP_AUTOMATED=false` turns the rules off.

## Roles

- The **first account created** is the administrator. They can appoint others in **Users**; at least one always remains.
- Other accounts join **by invitation**: the administrator enters an address and gets a one-time link, valid for `INVITATION_DAYS` days (7 by default), which they pass on themselves — saras has no outgoing mailbox of its own. The invited person only chooses a password. Only a hash of the link is stored; inviting the same address again invalidates the previous link. `ALLOW_SIGNUP=true` reopens free sign-up.
- An administrator can **delete an account**: its connected mailboxes and stored emails are erased from saras; the prompts it created are kept.
- **Prompts are shared** by all users. Only administrators create and edit them; users see their name and description, not the instructions.
- A user's **corrections** only influence their own drafts. Administrators see the reasons given by everyone, prompt by prompt, to improve the instructions. They have no access to other users' emails.

## Drafts

"Save as draft" files the reply, attached to the original thread, in the mailbox's Drafts folder: over IMAP (the folder flagged `\Drafts`, or named Drafts or Brouillons), through the Gmail API, or through Microsoft Graph. Nothing is sent. What you change afterwards in your mail client is unknown to saras.

## Branding

The look is changed **without touching the code**, with a brand folder:

```sh
cp -r public/brand my-brand      # start from the default brand
BRAND_DIR=./my-brand npm start   # or BRAND_DIR in .env; with Docker, mount the folder
```

| File | Role |
| --- | --- |
| `theme.css` | A dozen variables: accent colour, background, text (light and dark), fonts, corner radius, light/dark mode. Everything else is derived from them. |
| `brand.json` | `name` (title, tab, wording), `tagline` (one text, or one per language: `{ "fr": "…", "en": "…" }`), `logo` and `logoDark` (file names in the folder, optional). |
| `favicon.svg`, logos, fonts | Served from the folder. A web font is declared with `@font-face` in `theme.css`. |

A file missing from the folder falls back to the default brand's. `brands/example/` is a complete fictitious brand: `BRAND_DIR=./brands/example npm start`.

**`/styleguide.html`** shows every token and component with the brand in place: it is the page to watch while tuning `theme.css`.

## Translations

Every word of the interface comes from a translation file; none is written in the code (a test enforces it).

- **Files:** `public/i18n/<language>.json`, one per language, plus `public/i18n/index.json`, which lists the languages and names the default one. English is the default and the source language; French is provided.
- **Format:** Tolgee's native JSON — keys nested on dots, values in ICU MessageFormat: `{name}` parameters, `{count, plural, one {…} other {…}}`, `{kind, select, …}`, and `<tag>…</tag>` for a part the interface renders as a link or in bold.
- **Language shown:** the user's choice (Settings → Language, also on the sign-in page), else the first browser language available, else the default. A missing translation falls back to the default language. Dates follow the reader's regional format.
- **Adding a language:** add `public/i18n/<tag>.json` and one line in `index.json`. No rebuild is needed.

In the code, `t('key', params)` returns a string and `tRich('key', params, { link: … })` returns nodes for messages with tags (`web/i18n.ts`). The formatter itself (`web/i18n/format.ts`) is a small dependency-free implementation of the ICU subset above.

`test/i18n.test.ts` checks that every language has exactly the keys of the source language, with the same parameters and tags; that every key used in the code exists; and that no key is left unused.

### With Tolgee

`.tolgeerc.json` maps the files for the [Tolgee CLI](https://docs.tolgee.io/tolgee-cli): with a project id and an API key (`TOLGEE_API_KEY`), `npx @tolgee/cli push` uploads the keys and `npx @tolgee/cli pull` brings translations back into `public/i18n/`. Tolgee's in-context editing SDK is not integrated.

### What the server writes

The server never sends sentences of its own to the interface: errors, triage verdicts made by rules and mailbox problems travel as a code with parameters (`src/messages.ts`, with their English text), which the interface translates under the `server.` keys. A test keeps the English file identical to the server's text and every language complete.

The server remembers each user's language (sent by the interface) for what it writes on their behalf:

- the reason the LLM gives for a triage verdict (with the AI strategy) is asked for in that language;
- the line introducing the quoted original in a reply ("On …, … wrote:") follows it, for the languages the server knows (English and French; English otherwise);
- the default prompts are created in the language of the first account (English and French sets are provided).

The prompts sent to the LLM are in English. The reply itself is always drafted in the language of the email received. Prompt names and descriptions are whatever the administrators wrote.

## Design system

The interface follows the hierarchy tokens → atoms → molecules → organisms → pages, one layer per file, in CSS and in JavaScript alike:

| Tier | Styles (`public/design/`) | Components (`web/ui/`) | Content |
| --- | --- | --- | --- |
| Tokens | `tokens.css` | — | Brand inputs `--brand-*`, then semantic tokens `--color-*`, `--font-*`, `--space-*`, `--radius-*`… |
| Base | `base.css` | `dom.ts` | HTML element defaults; the single element-creation function. |
| Atoms | `atoms.css` | `atoms.ts` | `Button`, `Badge`, `Input`, `Select`, `Textarea`, `Checkbox`, `Notice`, `Text`, `BrandMark`… |
| Molecules | `molecules.css` | `molecules.ts` | `Field`, `FormRow`, `Actions`, `Card`, `NavItem`, `EmailListItem`, `Message`, toast… |
| Organisms | `organisms.css` | `organisms.ts` | `AppShell`, `AuthPanel`, `Page`, `Mailbox`, `ReadingHeader`. |
| Pages | — | `app.ts`, `styleguide.ts` | Behaviour only, assembled from components; wording comes from the translation files. |

Rules, enforced by `test/design-system.test.ts`:

- a colour or a font is written as a literal only in `tokens.css`;
- components use semantic tokens only, never `--brand-*`;
- pages write neither class names nor HTML elements: they call components;
- dependencies only point downwards (an atom never imports a molecule);
- a brand theme may only set tokens that exist.

CSS cascade layers (`@layer`) make the hierarchy effective: a molecule always wins over an atom, and `theme.css`, loaded outside any layer, wins over everything without `!important`.

To add a component: the function in `web/ui/<tier>.ts`, its style in `public/design/<tier>.css`, an example in `web/styleguide.ts`.

## Privacy

This is the main design constraint.

| Guarantee | How |
| --- | --- |
| No retention and no training on the LLM side | Every OpenRouter request carries `provider: { "zdr": true, "data_collection": "deny" }` ([docs](https://openrouter.ai/docs/guides/routing/provider-selection)). It is hardcoded in `src/llm/openrouter.ts`, the only place where email content leaves the application, and cannot be disabled by configuration. |
| No silent fallback | If no provider of the chosen model satisfies both conditions, OpenRouter refuses the request and the application shows the error. |
| Minimisation | Only the folder you chose is fetched. By default no email is analysed by the LLM: content leaves the server only when you ask for a draft. Newsletters, mailing lists, `no-reply` addresses and automated messages are set aside by header rules and never reach it. |
| Encrypted secrets | IMAP/SMTP passwords, OAuth tokens and API keys are encrypted in the database (AES-256-GCM, key derived from `APP_SECRET`). Email content itself is stored in clear: protect the database accordingly. |
| Transport | Without direct TLS, STARTTLS is required for IMAP and SMTP (except for a local server): no password travels in clear. |
| Local retention | Email content is erased from the database after `RETENTION_DAYS` days (30 by default). |
| Logs | The server never logs the content of emails or requests. |

**What remains your responsibility** (the application cannot guarantee it for you):

- In your OpenRouter account (*Settings → Privacy*), keep logging of prompts and responses **disabled**. Per-request ZDR covers the model providers, not this account setting.
- Check that the chosen model has a ZDR provider; otherwise requests fail (on purpose).
- ZDR is a contractual commitment of the providers, relayed by OpenRouter: it cannot be verified technically from the application.

## Getting started

Requires Node.js ≥ 22.18.

```sh
npm install
cp .env.example .env
# set APP_SECRET (openssl rand -hex 32) and OPENROUTER_API_KEY
npm run build   # compiles the browser code
npm start
```

Open http://localhost:3000 and create the first account: it becomes the administrator, then sign-up closes. Connect a mailbox in **Mailboxes** and invite your colleagues from **Users**.

With Docker, which also starts a PostgreSQL server:

```sh
cp .env.example .env   # then set APP_SECRET, OPENROUTER_API_KEY and POSTGRES_PASSWORD
docker compose up -d
```

In production, put the application behind an HTTPS reverse proxy and set `BASE_URL=https://…` (the session cookie then becomes `Secure`).

### IMAP / SMTP

Works with any standard mailbox (OVH, Infomaniak, Fastmail, Proton Bridge, etc.). Prefer an application password. The connection is tested before it is saved.

### Google

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials): create a project, enable the Gmail API, create an OAuth client of type "Web application".
2. Authorised redirect URI: `{BASE_URL}/api/oauth/google/callback`.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Requested scopes: `gmail.readonly` and `gmail.compose` (drafts and sending). `gmail.readonly` is a "restricted" scope at Google: for internal use (Workspace, user type "Internal") or in testing mode with a few declared accounts no verification is needed; public distribution requires Google's security assessment.

### Microsoft

1. [Entra ID](https://entra.microsoft.com) → App registrations → New registration, platform "Web".
2. Redirect URI: `{BASE_URL}/api/oauth/microsoft/callback`.
3. Delegated Microsoft Graph permissions: `Mail.ReadWrite`, `Mail.Send`, `User.Read`, `offline_access`.
4. Create a client secret, set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` and, to restrict to your organisation, `MICROSOFT_TENANT`.

## Database

The database is PostgreSQL, used in one of two ways with the same schema and queries:

| Mode | When | Meant for |
| --- | --- | --- |
| **PostgreSQL server** | `DATABASE_URL` is set (`docker compose` sets it and starts the server) | Deployments |
| **Embedded PostgreSQL** ([PGlite](https://pglite.dev)) | `DATABASE_URL` is empty; files go to `DATA_DIR/postgres` | Trying the tool, development, tests |

The embedded mode runs PostgreSQL inside the application's own process: nothing to install, but a single connection and no outside access for backups or monitoring. Use a server for anything real. There is no automatic transfer between the two.

The schema is created at startup (`src/db.ts`). The tests run on the embedded database by default and on a server when `TEST_DATABASE_URL` is set; CI runs both.

## Configuration

Every variable is described in [`.env.example`](.env.example). The default model (`OPENROUTER_MODEL`) can be overridden per user in **Settings**, as can the OpenRouter key.

## How it works

```
mailbox ──► fetch the watched folder (IMAP / Gmail API / Graph)
              │
              ├─ header rules ──► "no reply needed"       (automated mail, never shown to a gate)
              │
              └─ triage gate, 20 at a time ──► "to handle" (+ suggested prompt, with the AI strategy)
                                        │
                        you pick the prompt, add instructions
                                        │
                                LLM draft (ZDR)
                                        │
                       you review, edit, explain (optional)
                                        │
              sent in your name, or filed as a draft (SMTP / IMAP / Gmail API / Graph)
```

- `src/triage/`: the triage gate, its strategies, and the header rules applied before it.
- `src/reply.ts`, `src/llm/prompts.ts`: pure decisions (shaping of the reply, prompt construction).
- `src/llm/openrouter.ts`: OpenRouter client, privacy policy enforced.
- `src/mail/`: one provider per kind of mailbox, same interface (`verify`, `listFolders`, `listNew`, `send`, `saveDraft`).
- `src/sync.ts`: fetch and triage; `src/app.ts`: HTTP API; `src/types.ts`: the shapes shared across the server.
- `web/`: the interface's TypeScript (see "Design system"); `public/`: its static files (HTML, CSS, default brand, translations).
- Data: PostgreSQL (see "Database").

The content of a received email is treated as untrusted data: it is delimited in the prompts and the model is told not to follow instructions it may contain. Human review before sending remains the real protection.

## TypeScript

Everything is TypeScript in strict mode.

- **Server and tests** run directly on Node.js, which strips the types itself: there is nothing to compile, `npm start` and `npm test` execute the `.ts` files. The code therefore only uses erasable syntax (no enums, no parameter properties), which the compiler enforces.
- **Browser code** is compiled by `npm run build` from `web/` to `public/js/` (not committed), one ES module per source file, without a bundler.
- `npm run typecheck` checks both. `npm run dev` rebuilds the browser code and restarts the server on change.
- `web/api.ts` describes the JSON returned by each route for the interface. It mirrors what `src/app.ts` builds, but the two are not checked against each other.

## Tests

```sh
npm test
```

The end-to-end tests start a real local IMAP server and a real local SMTP server, plus a stand-in for OpenRouter that records the requests it receives; among other things they check that every request carries the ZDR policy and that a newsletter never reaches the LLM.

GitHub Actions type-checks, builds and runs them on every push and pull request (`.github/workflows/test.yml`), on Node.js 22, without any secret: once on the embedded database and once against a PostgreSQL server.

## Known limitations

- The Gmail and Microsoft Graph connectors are covered by message-conversion tests but have not been exercised against the real services: validate them with your own OAuth credentials.
- Replies are plain text. Of received attachments only the name, type and size are kept and shown; their content is neither stored nor sent to the LLM.
- One folder per mailbox is fetched (the `SYNC_MAX_EMAILS` most recent over `SYNC_DAYS` days). For Outlook, only top-level folders are offered.
- "Already answered elsewhere" is only detected over IMAP (`\Answered` flag).
- No password reset and no two-factor authentication for the saras account.
- A Google mailbox connected before drafts were added must be reconnected (new scope).

## License

[MIT](LICENSE).
