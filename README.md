# saras

A self-hosted web tool to answer email with the help of AI, without handing it the keys:

1. **Connect** one or more mailboxes: IMAP/SMTP, Gmail / Google Workspace (OAuth), Outlook / Microsoft 365 (OAuth).
2. **Identify** the emails that are waiting for a reply. Local rules discard newsletters and notifications; the AI triages the rest and suggests the most suitable prompt.
3. **Draft** a reply from a *system prompt* prepared by an administrator, chosen email by email (the suggested one, or another), with one-off instructions when needed.
4. **Send** in your name after review, or **save as a draft** in your mailbox to finish there. If you change the proposal you can say why: that reason is fed into your next drafts made with the same prompt.

Nothing is sent without explicit validation.

The interface is in French; code and documentation are in English.

## Roles

- The **first account created** is the administrator. They can appoint others in **Utilisateurs**; at least one always remains.
- Other accounts join **by invitation**: the administrator enters an address and gets a one-time link, valid for `INVITATION_DAYS` days (7 by default), which they pass on themselves — saras has no outgoing mailbox of its own. The invited person only chooses a password. Only a hash of the link is stored; inviting the same address again invalidates the previous link. `ALLOW_SIGNUP=true` reopens free sign-up.
- An administrator can **delete an account**: its connected mailboxes and stored emails are erased from saras; the prompts it created are kept.
- **Prompts are shared** by all users. Only administrators create and edit them; users see their name and description, not the instructions.
- A user's **corrections** only influence their own drafts. Administrators see the reasons given by everyone, prompt by prompt, to improve the instructions. They have no access to other users' emails.

## Drafts

"Enregistrer en brouillon" files the reply, attached to the original thread, in the mailbox's Drafts folder: over IMAP (the folder flagged `\Drafts`, or named Drafts / Brouillons), through the Gmail API, or through Microsoft Graph. Nothing is sent. What you change afterwards in your mail client is unknown to saras.

## Branding

The look is changed **without touching the code**, with a brand folder:

```sh
cp -r public/brand my-brand      # start from the default brand
BRAND_DIR=./my-brand npm start   # or BRAND_DIR in .env; with Docker, mount the folder
```

| File | Role |
| --- | --- |
| `theme.css` | A dozen variables: accent colour, background, text (light and dark), fonts, corner radius, light/dark mode. Everything else is derived from them. |
| `brand.json` | `name` (title, tab, wording), `tagline`, `logo` and `logoDark` (file names in the folder, optional). |
| `favicon.svg`, logos, fonts | Served from the folder. A web font is declared with `@font-face` in `theme.css`. |

A file missing from the folder falls back to the default brand's. `brands/example/` is a complete fictitious brand: `BRAND_DIR=./brands/example npm start`.

**`/styleguide.html`** shows every token and component with the brand in place: it is the page to watch while tuning `theme.css`.

## Design system

The interface follows the hierarchy tokens → atoms → molecules → organisms → pages, one layer per file, in CSS and in JavaScript alike:

| Tier | Styles (`public/design/`) | Components (`public/ui/`) | Content |
| --- | --- | --- | --- |
| Tokens | `tokens.css` | — | Brand inputs `--brand-*`, then semantic tokens `--color-*`, `--font-*`, `--space-*`, `--radius-*`… |
| Base | `base.css` | `dom.js` | HTML element defaults; the single element-creation function. |
| Atoms | `atoms.css` | `atoms.js` | `Button`, `Badge`, `Input`, `Select`, `Textarea`, `Checkbox`, `Notice`, `Text`, `BrandMark`… |
| Molecules | `molecules.css` | `molecules.js` | `Field`, `FormRow`, `Actions`, `Card`, `NavItem`, `EmailListItem`, `Message`, toast… |
| Organisms | `organisms.css` | `organisms.js` | `AppShell`, `AuthPanel`, `Page`, `Mailbox`, `ReadingHeader`. |
| Pages | — | `app.js`, `styleguide.js` | Behaviour and wording only, assembled from components. |

Rules, enforced by `test/design-system.test.js`:

- a colour or a font is written as a literal only in `tokens.css`;
- components use semantic tokens only, never `--brand-*`;
- pages write neither class names nor HTML elements: they call components;
- dependencies only point downwards (an atom never imports a molecule);
- a brand theme may only set tokens that exist.

CSS cascade layers (`@layer`) make the hierarchy effective: a molecule always wins over an atom, and `theme.css`, loaded outside any layer, wins over everything without `!important`.

To add a component: the function in `ui/<tier>.js`, its style in `design/<tier>.css`, an example in `styleguide.js`.

## Privacy

This is the main design constraint.

| Guarantee | How |
| --- | --- |
| No retention and no training on the LLM side | Every OpenRouter request carries `provider: { "zdr": true, "data_collection": "deny" }` ([docs](https://openrouter.ai/docs/guides/routing/provider-selection)). It is hardcoded in `src/llm/openrouter.js`, the only place where email content leaves the application, and cannot be disabled by configuration. |
| No silent fallback | If no provider of the chosen model satisfies both conditions, OpenRouter refuses the request and the application shows the error. |
| Minimisation | Newsletters, mailing lists, `no-reply` addresses and automated messages are discarded by rules on headers and never reach the LLM. |
| Encrypted secrets | IMAP/SMTP passwords, OAuth tokens and API keys are encrypted in the database (AES-256-GCM, key derived from `APP_SECRET`). |
| Transport | Without direct TLS, STARTTLS is required for IMAP and SMTP (except for a local server): no password travels in clear. |
| Local retention | Email content is erased from the database after `RETENTION_DAYS` days (30 by default). |
| Logs | The server never logs the content of emails or requests. |

**What remains your responsibility** (the application cannot guarantee it for you):

- In your OpenRouter account (*Settings → Privacy*), keep logging of prompts and responses **disabled**. Per-request ZDR covers the model providers, not this account setting.
- Check that the chosen model has a ZDR provider; otherwise requests fail (on purpose).
- ZDR is a contractual commitment of the providers, relayed by OpenRouter: it cannot be verified technically from the application.

## Getting started

Requires Node.js ≥ 22.

```sh
npm install
cp .env.example .env
# set APP_SECRET (openssl rand -hex 32) and OPENROUTER_API_KEY
npm start
```

Open http://localhost:3000 and create the first account: it becomes the administrator, then sign-up closes. Connect a mailbox in **Comptes mail** and invite your colleagues from **Utilisateurs**.

With Docker:

```sh
cp .env.example .env   # then edit
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

## Configuration

Every variable is described in [`.env.example`](.env.example). The default model (`OPENROUTER_MODEL`) can be overridden per user in **Réglages**, as can the OpenRouter key.

## How it works

```
mailbox ──► fetch (IMAP / Gmail API / Graph)
              │
              ├─ local rules ──► "no reply needed"        (never sent to the LLM)
              │
              └─ LLM triage (ZDR) ──► "to handle" + suggested prompt
                                        │
                        you pick the prompt, add instructions
                                        │
                                LLM draft (ZDR)
                                        │
                       you review, edit, explain (optional)
                                        │
              sent in your name, or filed as a draft (SMTP / IMAP / Gmail API / Graph)
```

- `src/triage.js`, `src/reply.js`, `src/llm/prompts.js`: pure decisions (triage, shaping of the reply, prompt construction).
- `src/llm/openrouter.js`: OpenRouter client, privacy policy enforced.
- `src/mail/`: one provider per kind of mailbox, same interface (`verify`, `listNew`, `send`, `saveDraft`).
- `src/sync.js`: fetch and triage; `src/app.js`: HTTP API; `public/`: interface (no build step, see "Design system").
- Data: SQLite in `DATA_DIR`.

The content of a received email is treated as untrusted data: it is delimited in the prompts and the model is told not to follow instructions it may contain. Human review before sending remains the real protection.

## Tests

```sh
npm test
```

The end-to-end tests start a real local IMAP server and a real local SMTP server, plus a stand-in for OpenRouter that records the requests it receives; among other things they check that every request carries the ZDR policy and that a newsletter never reaches the LLM.

## Known limitations

- The Gmail and Microsoft Graph connectors are covered by message-conversion tests but have not been exercised against the real services: validate them with your own OAuth credentials.
- Replies are plain text; received attachments are neither displayed nor sent to the LLM.
- Only the inbox is fetched (the `SYNC_MAX_EMAILS` most recent over `SYNC_DAYS` days).
- "Already answered elsewhere" is only detected over IMAP (`\Answered` flag).
- No password reset and no two-factor authentication for the saras account.
- A Google mailbox connected before drafts were added must be reconnected (new scope).
- Interface wording is in French and written directly in `public/app.js`; there is no translation layer yet.
