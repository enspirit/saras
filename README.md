# saras

[![Tests](https://github.com/enspirit/saras/actions/workflows/test.yml/badge.svg)](https://github.com/enspirit/saras/actions/workflows/test.yml)

A self-hosted web tool to answer email with the help of AI, without handing it the keys:

1. **Connect** one or more mailboxes: IMAP/SMTP, Gmail / Google Workspace (OAuth), Outlook / Microsoft 365 (OAuth), and choose the one folder of each to watch (the inbox by default).
2. **Identify** the emails that are waiting for a reply. By default every email of that folder is to be handled; rules you write, or an LLM, can sort them instead.
3. **Write** the reply in a rich-text editor — in full, or as a few notes — and, if you wish, let the AI check the typos, improve the style, or write it with a *prompt* prepared by an administrator.
4. **Send** in your name after review, or **save as a draft** in your mailbox to finish there.

Nothing is sent without explicit validation. The interface is in English and in French.

## What it does

- **Organisations.** Everything lives inside an organisation, and nothing crosses from one to another. Signing up creates one; its other members join by invitation. A second factor (TOTP) can be required of everyone.
- **Mailboxes, personal or shared.** A member connects their own address, which only they see. An administrator may connect a shared one (contact@, info@…), which every member reads and replies from.
- **Sorting.** Plainly automated mail (newsletters, no-reply senders, automatic replies) is set aside before anything else. What an organisation wants to know of each email is an *attribute*, decided by nobody, by a rule written in [Elo](https://elo-lang.org) (which costs no tokens), or by the AI. *Boards* are saved views filtered on them.
- **Writing.** One reply area. Send what you wrote as it is, or ask the AI to check typos, to improve the style, or to apply one of the organisation's prompts. When you change a proposal you can say why: the reason steers your next ones.
- **Your brand.** A folder with a `theme.css`, a `brand.json` and a logo changes the look without touching the code (`BRAND_DIR`, see [the design](doc/4-design.md#7-brands)); `/styleguide.html` shows it in place.

Each of these is told in full in the [user stories](doc/1-user-stories.md).

## Privacy

This is the main design constraint.

| Guarantee | How |
| --- | --- |
| No retention and no training on the LLM side | Every OpenRouter request carries `provider: { "zdr": true, "data_collection": "deny" }` ([docs](https://openrouter.ai/docs/guides/routing/provider-selection)). It is hardcoded, and cannot be disabled by configuration. If no provider of the chosen model satisfies both, the request is refused and the error shown: there is no silent fallback. |
| Minimisation | Only the folder you chose is fetched. Checking typos and improving style send only your own text, never the email received. By default no email is analysed by the LLM: content leaves the server only when you ask for a proposal. An organisation's administrators may choose otherwise (sorting by the AI, proposals prepared at fetch). Mail set aside as automated never reaches it. |
| Encrypted secrets | Mailbox passwords, OAuth tokens and API keys are encrypted in the database (AES-256-GCM, key derived from `APP_SECRET`). Email content itself is stored in clear: protect the database accordingly. |
| Transport | A mail server is given a password over TLS only, unless it is one of the server's own machine. |
| Local retention | Email content is erased from the database after `RETENTION_DAYS` days (30 by default). |
| Logs | The server never logs the content of emails or requests. |

**What remains your responsibility:**

- In your OpenRouter account (*Settings → Privacy*), keep logging of prompts and responses **disabled**. Per-request ZDR covers the model providers, not this account setting.
- Check that the chosen model has a ZDR provider; otherwise requests fail (on purpose).
- ZDR is a contractual commitment of the providers, relayed by OpenRouter: it cannot be verified from the application.
- Where the model runs is yours to choose. To keep inference in Europe, set `OPENROUTER_BASE_URL=https://eu.openrouter.ai/api/v1`: OpenRouter then sends requests only to provider endpoints in Europe, and refuses a model that has none there. Your OpenRouter plan must include in-region routing, and the chosen model must be served in Europe.

The content of a received email is treated as untrusted data: it is delimited in the prompts and the model is told not to follow instructions it may contain. Human review before sending remains the real protection.

## Trying it with sample emails

With Docker and [`emb`](https://github.com/enspirit/emb):

```sh
npm install -g @enspirit/emb
emb up          # saras, a PostgreSQL server and a mailbox of sample emails, on this machine
emb run demo    # prints the address and the account to sign in with
```

The demo organisation has a mailbox of twenty sample emails, a few attributes with their rules, and two boards. Replies you send go nowhere, and nothing leaves the machine; `emb run demo` again puts everything back as it was. With `OPENROUTER_API_KEY` in a `.env` at the root of the repository, the AI is the real one.

## Installing it

From a checkout, with Node.js ≥ 22.18, on an embedded database:

```sh
cd software/saras
npm install
cp .env.example .env   # set APP_SECRET (openssl rand -hex 32) and OPENROUTER_API_KEY
npm run build
npm start
```

Or as a Docker image, with the same variables in a `.env`. [`enspirit/saras`](https://hub.docker.com/r/enspirit/saras) is published for amd64 and arm64: `latest` follows `main`, and a release has its own tag (`1.2.3`, `1.2`).

```sh
docker run -d --name saras -p 127.0.0.1:3000:3000 --env-file .env -v saras-data:/data enspirit/saras
```

To build it yourself, from the root of a checkout: `docker build --target saras-production -t saras software/saras`.

Or on Kubernetes, with the Helm chart of [`world/chart`](world/chart/), whose README gives the commands.

Open http://localhost:3000 and create your organisation: you become its administrator, then sign-up closes. Connect a mailbox in **Mailboxes** and invite your colleagues from **Users**.

For real use:

- **A PostgreSQL server**, named by `DATABASE_URL`. Without it saras runs an embedded PostgreSQL ([PGlite](https://pglite.dev)) kept in `DATA_DIR`: nothing to install, but a single connection and no outside access for backups. The schema is created at startup; there is no transfer between the two.
- **An HTTPS reverse proxy** in front, and `BASE_URL=https://…` (the session cookie then becomes `Secure`).

Every variable is described in [`software/saras/env/base.env`](software/saras/env/base.env), with its default.

### Connecting mailboxes

- **IMAP / SMTP** works with any standard mailbox (OVH, Infomaniak, Fastmail, Proton Bridge…). Prefer an application password. The connection is tested before it is saved.
- **Google**: in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), enable the Gmail API and create an OAuth client of type "Web application", with `{BASE_URL}/api/oauth/google/callback` as redirect URI; set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The scopes asked for are `gmail.readonly` and `gmail.compose`. The first is "restricted" at Google: fine for internal use or in testing mode, while public distribution requires Google's security assessment.
- **Microsoft**: in [Entra ID](https://entra.microsoft.com), register an application of platform "Web", with `{BASE_URL}/api/oauth/microsoft/callback` as redirect URI and the delegated Graph permissions `Mail.ReadWrite`, `Mail.Send`, `User.Read`, `offline_access`; set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` and, to restrict to your organisation, `MICROSOFT_TENANT`.

## Known limitations

- The Gmail and Microsoft Graph connectors are covered by message-conversion tests but have not been exercised against the real services: validate them with your own OAuth credentials.
- Replies cannot carry attachments or images, and received emails are shown as plain text. Of received attachments only the name, type and size are kept; their content is neither stored nor sent to the LLM.
- One folder per mailbox is fetched, the `SYNC_MAX_EMAILS` most recent at a time. For Outlook, only top-level folders are offered.
- "Already answered elsewhere" is only detected over IMAP (`\Answered` flag).
- A Google mailbox connected before drafts were added must be reconnected (new scope).

## Working on it

[`HACKING.md`](HACKING.md) says how the repository is laid out, how to run the stack and the tests, and where each thing is documented.

## Third-party software

Bundled unmodified in what the browser loads, their licence notices kept at the end of the bundle: [Squire](https://github.com/fastmail/Squire), the rich-text editor (MIT); [DOMPurify](https://github.com/cure53/DOMPurify), the HTML sanitiser (Apache-2.0 or MPL-2.0); [CodeMirror 6](https://codemirror.net) with [Elo](https://elo-lang.org)'s language support, for the rule editor (MIT); `qrcode-generator` (MIT). The server's dependencies are listed in [`software/saras/package.json`](software/saras/package.json); all are under permissive licences.

## License

[MIT](LICENSE).
