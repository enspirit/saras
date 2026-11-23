# saras — design

How the interface of saras is designed and built: what it aims for, the rules it follows, its tokens and components, and how each screen is put together. The features themselves are in the [user stories](1-user-stories.md) (`US-xx` below).

There are no screenshots here on purpose. **`/styleguide.html`** on any running instance renders every token and every component with the brand in place, from the same code as the application, so it cannot go out of date.

## 1. What the design is for

saras is a self-hosted web tool to answer email with the help of AI, without handing the AI the keys.

- **Who uses it:** small professional teams handling client email. Members answer, all day, mostly on a laptop and sometimes on a phone; one or two administrators set the tool up. Not technical users.
- **What it sells:** privacy. The design has to make that feel true: calm, precise, and open about what the AI did and what it was shown.
- **Tone:** a quiet professional tool, closer to a good mail client than to an "AI product". No sparkle icons, no gradients, no chat bubbles. The AI is an assistant in the margin.
- **Where it runs:** on the customer's own server, usually under the customer's own brand.

Principles that follow:

1. **The next action is on screen.** Reading an email and sending its reply never requires scrolling to find Send.
2. **A decision sits with what it is about.** Decisions about an email are with the email; decisions about the reply are with the reply.
3. **The AI is named and reversible.** Text it wrote is marked as such, with what produced it and a way back.
4. **Privacy has one sign.** A lock marks every statement about what is, or is not, sent to the AI.
5. **Complete sentences.** The wording is plain and precise; it may be short, never vague.
6. **A brand is more than a tint.** Surfaces, borders, muted text and shadows all derive from the brand's own inputs.

## 2. Rules the design lives within

| Rule | Consequence |
| --- | --- |
| **No framework, no bundler.** Plain CSS files and TypeScript functions that build DOM nodes. | A component is a function plus a few CSS rules. |
| **Strict layering**: tokens → base → atoms → molecules → organisms → pages. | Pages hold behaviour only: they write no class name and create no element. Anything visual is a component. |
| **Literals only in `tokens.css`.** | Every colour and font is a token. Components read semantic tokens (`--color-*`), never brand inputs (`--brand-*`). |
| **Brandable.** A brand sets about a dozen inputs; the rest is derived with `color-mix()` and `light-dark()`. | Every screen must hold when accent, canvas, ink, fonts and radius change. Status colours keep their meaning across brands. |
| **Light and dark** from the same tokens, following the visitor's system. | Nothing is designed for one scheme only. |
| **Content-Security-Policy `default-src 'self'`.** | Fonts and icons are self-hosted; there is no inline `style` attribute and no asset from another site. |
| **All wording in translation files** (English, French), ICU format. | No text in code. French runs 20–30 % longer: nothing is sized for English. |
| **Accessibility:** WCAG 2.1 AA contrast in both schemes, visible focus, everything reachable by keyboard. | Labels wrap their controls; icon-only buttons carry a name; dialogs are native `<dialog>` elements. |

`test/unit/design-system.test.ts` and `test/unit/i18n.test.ts` enforce the layering, the token rules and the wording rules.

## 3. Structure

```
public/design/                      web/ui/
  index.css      @layer order         dom.ts        h(): the one element-creation function
  tokens.css     every literal        atoms/        one file per component
  base.css       element defaults     molecules/
  atoms/         one sheet per        organisms/
  molecules/     component            brand.ts      loads name, tagline, logo, sign-in extras
  organisms/                          sanitize.ts
public/brand/                       web/
  theme.css      the brand inputs       app.ts        starts the application, shows the page of each address
                                        pages/        one file per thing a person does
  brand.json     name, tagline, logos   styleguide.ts the living style guide
brands/
  example/       a fictitious firm: green accent, serif headings, 2 px radius
  klaro/         the Klaro Cards brand: purple, Poppins (self-hosted), sign-in extras
```

CSS cascade layers (`@layer tokens, base, atoms, molecules, organisms`) make the hierarchy effective: a later layer wins whatever the selectors. `theme.css` is loaded outside any layer and wins without `!important`.

## 4. Tokens (`public/design/tokens.css`)

Three tiers: **brand inputs** → **semantic tokens** → **component tokens** declared on the component itself (`--btn-bg`, `--card-padding`, `--badge-text`…).

| Group | Tokens | Notes |
| --- | --- | --- |
| Brand inputs | `--brand-accent`, `--brand-on-accent`, `--brand-canvas`, `--brand-ink` (and `-dark` of each), `--brand-font-body`, `--brand-font-heading`, `--brand-radius`, `--brand-color-scheme`, `--logo-height` | Default: accent `#1f5fbf` / `#7fb0ff`, canvas `#f6f5f1` / `#15171b`, ink `#1d1f24` / `#e8e9ec`, system font stack, radius 8 px. |
| Surfaces and text | `--color-bg`, `--color-surface`, `--color-surface-sunken`, `--color-text`, `--color-text-soft`, `--color-text-muted`, `--color-border`, `--color-border-strong`, `--color-line`, `--color-hover`, `--color-scrim` | All mixes of ink into canvas. `line` is a hairline inside a surface; `sunken` is the navigation; `scrim` veils the page behind a dialog. |
| Accent | `--color-accent`, `--color-on-accent`, `--color-accent-soft`, `--color-focus` | Soft is 12 % accent on surface. |
| AI | `--color-ai`, `--color-ai-border` | The surface under text the AI proposed, until the user takes it over. |
| Sign-in ground | `--color-brand-panel`, `--color-on-brand-panel`, `--color-on-brand-panel-soft`, `--color-brand-panel-line`, `--color-brand-panel-ok` | The accent taken down to a deep tone; the same in both schemes. |
| Status | `--color-ok`, `--color-warn`, `--color-danger`, `--color-on-danger`, a `-soft` of each, `--color-warn-border` | |
| Type | `--font-body`, `--font-heading`, `--font-mono`, `--font-icon`; `--text-xs` 12, `-sm` 13, `-md` 14, `-lg` 18, `-xl` 22, `-2xl` 28; `--leading`, `--leading-tight`; weights 400 / 500 / 600 / 700 | Body text is 14 px. |
| Space | `--space-1` … `--space-8` = 4, 8, 12, 16, 20, 24, 32, 40 | 4 px grid. |
| Sizes | `--control-sm` 28, `-md` 36, `-lg` 44; `--icon-sm` 14, `-md` 16, `-lg` 20 | Height of a control; size of an icon. |
| Shape | `--radius-sm`, `--radius-md` (the brand's), `--radius-lg`, `--radius-pill`, `--border-width`, `--focus-width` | |
| Elevation | `--shadow-1` (card, table, panel), `--shadow-2` (the docked reply area), `--shadow-3` (dialog), `--shadow-overlay` (toast) | Tinted with the brand's ink. |
| Motion | `--duration-fast` 120 ms, `--duration-base` 200 ms, `--duration-spin`, `--ease` | Motion confirms an action; it never performs. |
| Layout | `--nav-width`, `--list-width`, `--content-width` 1000, `--form-width` 640, `--auth-width`, `--dialog-width`, `--z-sticky`, `--z-overlay` | |

## 5. Components

### Atoms (`atoms/*.ts`, `atoms/*.css`)

| Component | What it is |
| --- | --- |
| `Icon`, `Spinner` | One glyph of the icon font; something in progress. |
| `Button`, `ButtonLink`, `setBusy` | Variants: default, primary, danger (a destructive action at rest), destructive (the same about to happen), ghost, link, tool. Sizes small, medium, large. Optional icon, icon-only, block, flush. Busy: a spinner replaces the icon, the label and width stay. |
| `Input`, `Select`, `Textarea`, `Checkbox` | One field style; invalid state through `aria-invalid`. The checkbox is drawn; the select keeps its native arrow. |
| `Badge` | accent, ok, warn, danger, neutral. |
| `Notice` | A tinted paragraph: info, ok, warn, danger. |
| `Avatar` | A person as initials, or a mailbox as an icon. |
| `Chip` | One value among several, removable; optional icon. |
| `TodoMark` | A passage left to complete. |
| `Text`, `Muted`, `Small`, `Strong`, `Code`, `Link`, `Heading`, `List`, `Prose`, `RichText`, `SrOnly` | Text. `Prose` is a plain-text mail body; `RichText` is sanitised HTML. |
| `BrandMark`, `Spacer` | The brand's name or logo; a push to the end of a row. |

### Molecules (`molecules/*.ts`, `molecules/*.css`)

| Component | What it is |
| --- | --- |
| `Field`, `CheckField`, `FormRow`, `Form`, `Actions`, `Block` | Label, control, hint or error; rows of fields; rows of buttons. |
| `Card`, `CardSection` | A surface for one subject; a titled part of it. `form` keeps it to a readable width. |
| `PageHeader`, `Tabs`, `Steps` | Title, introduction, breadcrumb and actions of a page; its parts, each with an address; a short path and where one is on it. |
| `Table`, `Person`, `Remark`, `Facts` | The same facts about several things; who (or which mailbox) with one fact; what someone said; label and value line by line. |
| `Choices` | One among a few, each explained, as cards or as rows. |
| `Callout`, `Features`, `EmptyState`, `Loading` | Something to know, with room for a control; points of equal weight with their sign; what an empty region says; a screen on its way. |
| `confirmDialog`, `promptDialog` | A question before something happens, in a native dialog. Destructive ones focus Cancel. |
| `NavItem`, `Assurance` | A navigation entry with icon and count; the standing privacy statement. |
| `EmailListItem` | Sender, tags and time; subject and shared mailbox; first words. |
| `RichEditor` | Squire with an icon toolbar. It can show an `AiNote` and tint its text as a proposal, and highlight passages matching a pattern without changing the text. |
| `RecipientField` | Addresses as removable chips, with a place to type one more. |
| `AiNote`, `AiHelp`, `PromptPick`, `ReasonField`, `Caution` | The parts of the reply area that concern the AI (see 6.2). |
| `Panel`, `Message` | A record with its facts; a mail body. |
| Toast (`createToast`), `Swatch` | One message at a time, at the top, clear of the reply area; a colour token in the style guide. |

### Organisms (`organisms/*.ts`, `organisms/*.css`)

| Component | What it is |
| --- | --- |
| `AuthPanel` | The brand's ground with what it guarantees, and a form beside it. |
| `AppShell` | Navigation and main area. Below 860 px the boxes become a bar at the bottom. |
| `Page`, `Columns` | A centred scrolling column; main content with an aside. |
| `Mailbox` | List on one side, reading pane on the other; they alternate on a small screen. |
| `Reading`, `ReadingHeader` | An open email: header, scrolling content, and what is docked under it. |
| `ReplyDock`, `ClosedDock` | The reply area; the line that stands for it when no reply is expected. |

## 6. Screens

### 6.1 Shell (US-23, US-41)

The four boxes come first, each with an icon and its count. Configuration (Mailboxes, Prompts, Users, Settings) is a quieter group under its title. At the bottom: the privacy statement with its lock, then who is signed in (name, organisation) and an icon button to sign out.

Below 860 px the boxes are a bar at the bottom of the screen, with a fifth entry, **More**, that leads to a page listing the configuration pages, who is signed in and Sign out.

### 6.2 Reading and replying (US-25, US-30 to US-40)

The reading pane has three parts: a header, the email's text, and the reply area docked at the bottom. The text scrolls on its own; when room is short the reply area gives way first and its writing area scrolls, so Send stays in view.

- **Header.** Subject, then the decisions about the email: *No reply needed* and *Ignore* while it waits, *Move back to "To handle"* once set aside. Under it the sender (avatar, name, address), "To … · Cc …", attachments as chips, and a short date with the full date as a tooltip. Last, the triage verdict: who sorted it, and why.
- **Recipients.** To and Cc as removable chips on one line, with *Reply to all* when the email had other recipients.
- **Editor.** One writing area, with an icon toolbar.
- **Proposal.** When the AI wrote the text, a note above it says what was done and with which model, and holds *Put my text back*. The text is tinted until the user edits it; the note then adds that it was edited.
- **To complete.** Passages in square brackets, which prompts use where information is missing, are highlighted in the text and counted next to Send. The highlight goes through the browser's highlight registry: the text that is sent is untouched.
- **Why.** After editing a proposal made with a prompt, one line under the text asks why, and says what the answer is for and who reads it.
- **Help from the AI.** One row: *Check typos*, *Improve style*, and *Write with* joined to the list of prompts. The prompt suggested at triage carries a *Suggested* label. A line with the lock says that typos and style do not send the email received.
- **Actions.** *Send* and *Save as draft*. Sending opens a dialog that lists From, To and Cc.

An email in **No reply needed** or **Ignored** shows one line in place of the reply area, with *Reply anyway*. An email in **Replied** shows the reply as a panel under the email: sent or filed as a draft, by whom and when, To, Cc, the reason given for an edit, and whether the proposal was edited.

### 6.3 Boxes (US-20 to US-24)

The list header gives the box's name, how many emails it holds, when mail was last fetched, and a fetch button. A row has three lines: sender with its tags (*Priority*, *Not triaged*, *Draft*) and the time; the subject, with the short name of the shared mailbox when there is one; the first words.

An empty box says so with an icon and a sentence, and links to Mailboxes when none is connected. With no email open, the reading pane names how many are in the box and what to do.

### 6.4 Arriving (US-01 to US-04)

Sign-in, sign-up and the invitation page share one layout that fills the window. On the brand's ground: the name or logo, the tagline, and the guarantees with their signs. Beside it: the form, centred, with the language picker in the corner. Sign-up and the invitation ask for a name, shown to other members in place of the address.

A brand can add three things to this screen through `brand.json`: a byline next to the name, a credit under the form, and a statement that the installation and its AI are hosted in Europe.

### 6.5 Connecting a mailbox (US-10 to US-16)

Getting started is a path, shown at the top of each of its screens (US-08). It is built to take whoever creates an organisation from sign-up to a first email in a few minutes: sign-up leads straight to it, each step asks only for what nobody else can know, and the things a newcomer would not find alone (the prompt, how the tool works) are shown rather than left in the navigation. An invited member only goes through the first two steps.

1. **Connect.** Administrators first choose whose mailbox it is: *Mine* or *Shared by the team*. Then where it is hosted: Google, Microsoft, or another provider. A provider the server is not set up for is disabled and says why. Another provider asks for address, password and display name, with server settings in their own section; Google and Microsoft lead to the provider. For a first mailbox the address and the name come from sign-up. The server asks the address's domain who hosts its mail (its MX records): an address at Google or Microsoft is steered to signing in there when the installation offers it, and told why a password will probably not do when it does not; for other known hosts the servers are filled in, and the usual names are proposed otherwise. The connection is tested before anything is saved.
2. **Folder.** The mailbox's own folders as a list, the inbox first and preselected. The button waits for the first fetch, so that the next screen has emails in it.
3. **AI key**, only when no key is available and the person is an administrator: the organisation's OpenRouter key, with a link to where one is created, or *Later*.
4. **Prompt** (administrators): the organisation's one default prompt, to read and adjust, with the other ready-made prompts beside it to add in one click.
5. **How it works** (administrators): four ready-made ways, each a card saying what the AI does and what it is sent. *I decide everything*; *The AI sorts, I write*; *Proposals waiting for me*; *Drafts in my mailbox*. None sends anything. Applying one sorts again what the first fetch let through, and prepares proposals if asked.
6. **A first email.** The first email to handle, open, with a line in the reply area saying what to try.

Once connected, **Mailboxes** is a table: mailbox, folder watched, last fetched, to handle. *Fetch now* is labelled; changing the folder and disconnecting are icon buttons. A connection error shows as a callout above the table.

### 6.6 Administration (US-05 to US-07, US-50 to US-53)

- **Prompts** is a table of name, description and use, followed by the choice of when the AI writes, then the ready-made prompts not yet added. A prompt is edited on its own address, with a breadcrumb back; what members changed in its proposals, and why, sits beside the instructions.
- **Users** is a table of members (name, role, joined, personal mailboxes) and one of pending invitations. *Invite someone* opens the form; the fresh link appears as a callout with Copy.

A destructive action at rest is a red icon button. It is always confirmed in a dialog whose red button says what will happen.

### 6.7 Settings (US-60 to US-65)

One tab per audience, each with its own address.

- **You:** name and signature, with one Save; password, language and deleting one's account, each in a card of its own.
- **Organisation** (administrators): its name, and deleting it.
- **AI & privacy:** the model and the key, beside what the AI does at sorting and at writing with what it is sent at each; then the guarantees as five titled points with their signs, and the one setting that is the user's part.

## 7. Brands

A brand is a folder, named by `BRAND_DIR`: the look is changed without touching the code. A file missing from the folder falls back to the default brand's.

| File | Role |
| --- | --- |
| `theme.css` | The inputs of section 4, a dozen variables: accent colour, background, text (light and dark), fonts, corner radius, light/dark mode. Everything else is derived from them. |
| `brand.json` | `name` (title, tab, wording), `tagline` (one text, or one per language: `{ "fr": "…", "en": "…" }`), `logo` and `logoDark` (file names in the folder, optional). For the sign-in page, optionally: `byline` and `credit` (one text, or one per language) and `euHosting` (`true` when the installation and the AI it calls are hosted in Europe: the page then says so). |
| `favicon.svg`, logos, fonts | Served from the folder. |

`/styleguide.html` shows every token and component with the brand in place: it is the page to watch while tuning `theme.css`. Start from the default brand: `cp -r public/brand my-brand`, then `BRAND_DIR=./my-brand npm start`; with Docker, mount the folder.

| Brand | Folder | What it shows |
| --- | --- | --- |
| Default | `public/brand/` | Neutral: blue accent, warm off-white canvas, system fonts. |
| Example | `brands/example/` | A fictitious firm: green accent, serif headings, 2 px radius, a logo. |
| Klaro Cards | `brands/klaro/` | Purple accent, violet ink, Poppins self-hosted; byline, credit and European-hosting statement on sign-in. |

```bash
BRAND_DIR=./brands/klaro npm start
```

Fonts of a brand live in its folder and are declared with `@font-face` in its `theme.css`. Icons are Lucide (ISC licence), pinned to an exact version in `package.json` and copied next to the compiled interface by `npm run build`; the glyph codes in `atoms.css` belong to that version.

## 8. Adding to the design

- **A component:** the function in `web/ui/<tier>/<component>.ts`, its style in `public/design/<tier>/<component>.css` (listed in `public/design/index.css`), an example in `web/styleguide/<tier>.ts`.
- **An icon:** its name in the `IconName` type and its glyph code in `atoms/icon.css`, taken from the pinned Lucide version.
- **A token:** in `tokens.css`, derived from the brand inputs where it is a colour.
- **Wording:** a key in the section's file under `public/i18n/en/` and `public/i18n/fr/`; the tests check that both have it and that it is used.

## 9. Known limits

- The select keeps the browser's own arrow.
- Toasts show one message at a time, at the top of the screen.
- On a phone, tables scroll sideways inside their frame.
- The prompt list shows replies and edits, not which corrections an administrator has yet to read.
