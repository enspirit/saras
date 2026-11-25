# Working on the design of saras

For a designer, alone or with an AI agent, who wants to improve the brand and the design system: how to run saras on a laptop, where to look, what to change, and how to know nothing broke.

What the design is — its aims, its rules, every token, every component, every screen — is [`doc/4-design.md`](doc/4-design.md). This page is how to work on it.

**You need** Node.js 22.18 or later, with npm, and git. No Docker, no `emb`, no database to install, no account anywhere.

## 1. Start it

```sh
cd software/saras
npm run design
```

One command, to leave running. It:

- installs the packages, the first time;
- makes the secret the server needs, the first time, and keeps it in `software/saras/.env`;
- bundles the interface, and again each time a file is saved;
- starts the server on http://localhost:3000, with its data in `software/saras/data/`;
- starts a mailbox of twenty sample emails beside it ([`world/mailbox`](world/mailbox/)), which listens on this machine only and sends nothing: saras reads mail it does not hold, so the demo needs a mail server;
- sets the demo organisation up and connects that mailbox to it, when they are not there yet.

It then prints the two addresses of section 2 and the account to sign in with: `demo@saras.example`, `saras-demo-password`. Ctrl-C stops everything.

The day after, the same command: the demo is still there. To start over, stop it, delete `software/saras/data/` and run it again. Neither that folder nor `.env` is committed.

It refuses to start when something already listens on its port, and says so: `PORT=3001 npm run design` takes another.

## 2. What to look at

| | Address | Shows |
| --- | --- | --- |
| **The style guide** | http://localhost:3000/styleguide.html | Every token, atom, molecule and organism, in its variants and states, with the brand in place. It is built from the same code as the application and needs no sign-in: the page to keep open while changing a token or a component. |
| **The interface** | http://localhost:3000 | The demo: fourteen emails to handle and six set aside, attributes with their coloured values, two boards, the reply area. |

Each page of the interface has an address, which a refresh keeps: `#/inbox`, `#/no-reply`, `#/replied`, `#/ignored`, `#/search`, `#/attributes`, `#/prompts`, `#/members`, `#/mailboxes`, `#/settings`, `#/welcome` (getting started), and the boards from the navigation. Sign out to see the sign-in screen. What each screen is meant to be is in [the design, section 6](doc/4-design.md#6-screens).

Look at every change four ways, since the design promises all of them:

- **Light and dark.** The interface follows the system. The browser's developer tools switch it without changing the system (in Chrome: Rendering → *Emulate CSS media feature prefers-color-scheme*).
- **Small screens.** Below 860 px the navigation becomes a bar at the bottom, and the list and the reading pane alternate.
- **French.** *Settings → You*, or the corner of the sign-in screen. French runs 20 to 30 % longer than English.
- **Another brand.** `BRAND_DIR=./brands/klaro npm run design`, or `./brands/example`: a component that only holds with the default accent, font or radius does not hold.

**The AI.** Without a key, *Check typos*, *Improve style* and *Write with* answer that no key is configured, and nothing leaves the machine. The style guide shows what the AI's proposals look like anyway. To see them in the interface, add `OPENROUTER_API_KEY=…` to `software/saras/.env` and start again: the sample emails, which are fictitious, are then sent to OpenRouter when you ask for a proposal.

## 3. Seeing a change

| You changed | To see it |
| --- | --- |
| A sheet under `software/saras/public/design/`, or a module under `software/saras/web/` | Refresh the page. |
| A brand folder: `theme.css`, `brand.json`, a logo | Refresh the page. |
| Wording, under `software/saras/public/i18n/` | `npm run build` in another terminal of `software/saras`, then refresh. |
| `.env`, or `BRAND_DIR` | Stop `npm run design` and start it again. |

A module that does not parse, or imports what does not exist, is said in the terminal of `npm run design`, and the page keeps the last bundle that built. The bundler checks no type: `npm run typecheck` does.

## 4. Where things are

Paths are in `software/saras/`. The structure is drawn in [the design, section 3](doc/4-design.md#3-structure).

| To change | Edit |
| --- | --- |
| A brand: accent, canvas, ink, fonts, corner radius, name, tagline, logo | A brand folder: `theme.css` and `brand.json`. The default one is [`public/brand/`](software/saras/public/brand/), whose `theme.css` is the one place where the inputs of the default brand are written; [`brands/example/`](software/saras/brands/example/) and [`brands/klaro/`](software/saras/brands/klaro/) are two more. See [Brands](doc/4-design.md#7-brands). |
| What everything derives from them: surfaces, borders, status colours, the type scale, spacing, sizes, shadows, motion | [`public/design/tokens.css`](software/saras/public/design/tokens.css), the only other file where a colour or a font is written. |
| The look of one component | Its sheet, `public/design/<tier>/<component>.css`, where `<tier>` is `atoms`, `molecules` or `organisms`. |
| What a component is made of, its variants | Its function, `web/ui/<tier>/<component>.ts`. |
| What the style guide shows of it | `web/styleguide/<tier>.ts`. |
| How a screen is put together | `web/pages/`. A page composes components: it writes no class name and creates no element. |
| The words | `public/i18n/en/` and `public/i18n/fr/`, both. |

A brand that leaves an input out keeps the default brand's: changing the default changes what every other brand did not say. To try a brand of your own without touching the default: `cp -r brands/example brands/mine`, then `BRAND_DIR=./brands/mine npm run design`.

Adding a component, an icon, a token or wording has its steps in [the design, section 8](doc/4-design.md#8-adding-to-the-design). What is known to be unfinished is in [section 9](doc/4-design.md#9-known-limits).

## 5. With an AI agent

Open the agent at the root of the checkout. [`CLAUDE.md`](CLAUDE.md) holds the rules of the repository for it; have it read this page and [`doc/4-design.md`](doc/4-design.md) as well. Where `CLAUDE.md` names `emb`, the commands of this page do, for a change to the design.

An agent reads the sources; it does not see the page unless it is given a browser. Without one, describe what you see or give it a screenshot, and look at the style guide yourself after each change.

Requests that work well name the tier and where the result should show:

- "List the semantic colour tokens whose contrast on `--color-surface` and on `--color-bg` is under WCAG AA, in light and in dark, for the three brands, and propose new mixes in `tokens.css`."
- "Give `Badge` a quieter variant: the function, the sheet, an example in the style guide, and its line in `doc/4-design.md`."
- "The rows of the email list are too tall on a phone. Change `email-list-item.css` only, with tokens that exist."
- "Make a brand for a law firm in `brands/mine`: dark green, a serif for headings, square corners. Then tell me which components lose contrast with it."

The rules that will stop a change are few. A test holds each of them and says what is wrong, but for the fourth, which the browser enforces by refusing the style:

- A colour or a font is a literal in `tokens.css` or in a brand's `theme.css`, and nowhere else; a component reads semantic tokens (`--color-*`), never brand inputs (`--brand-*`).
- Tiers depend downwards: atoms, molecules, organisms, pages. A sheet styles only the components of its own tier, and is listed in `public/design/index.css`.
- No sentence in the code: every word is a key in both languages.
- No inline `style` attribute and nothing loaded from another site: fonts and icons are in the repository.
- No file over 200 lines, no function over 20.

They are explained in [the design, section 2](doc/4-design.md#2-rules-the-design-lives-within). Two things are not style and are not the designer's to remove: the lock that marks every statement about what is sent to the AI, and the note that names what the AI wrote and offers the way back. Restyle them; keep them.

## 6. Before proposing a change

In `software/saras`:

```sh
npm run typecheck
npm run test:unit     # seconds: the tiers, the tokens, the wording, the sizes
npm test              # everything the server and its interface are held to
```

When a document changed, from `tests/harness`: `node check.ts`, which fails on a link that leads nowhere.

A change to a token or a component changes [`doc/4-design.md`](doc/4-design.md) in the same commit: its tables are the inventory. A commit message says, in a sentence, what is now true, then why (`git log` shows the manner). Open a pull request from a branch or a fork: GitHub Actions runs these checks and the rest, which need the Docker stack and are in [`HACKING.md`](HACKING.md).
