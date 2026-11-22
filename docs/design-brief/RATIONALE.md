# Design rationale — what moved, and which problem it answers

Companion to the [design brief](README.md). Numbers such as **6.1 #3** point at the brief's section and the item of its "What we see" list. `US-xx` are the [user stories](../user-stories.md). Nothing a story requires was removed; where a feature moved, the row says where it went.

The interface is built from the design system in `public/design/` and `web/ui/`; every component below is shown on `/styleguide.html`.

## Across all screens (brief section 7)

| Problem | Answer |
| --- | --- |
| 7.1 No icons | One self-hosted icon font (Lucide, ISC licence), through the `Icon` atom. An icon never stands alone without a label or an accessible name. |
| 7.2 Flat typography | Base text goes from 15 to 14 px. Page titles, section titles and labels now differ in size, weight and colour; metadata is small and muted. |
| 7.3 One container | Card, table, panel, dock, callout and dialog each have their own surface. Three elevation steps and a hairline lighter than a border. |
| 7.4 One button | Three sizes; primary, default, ghost, danger and destructive; an icon slot; a busy state with a spinner. |
| 7.5 Native controls | `confirm()` and `prompt()` are replaced by a designed dialog. The checkbox is drawn. The select keeps its native arrow. |
| 7.6 Missing states | Busy buttons, inline field errors, hover and selected treatments, a start-up loading indicator. |
| 7.7 Verbose metadata | Short dates (time today, day and time otherwise, the full date as a tooltip). People by name, the address second. |
| 7.8 Wasted and cramped | Administration pages are centred and use tables. The reply area is docked, so its actions are on screen. |
| 7.9 Privacy has no visual language | A lock marks every privacy statement: the sidebar, the AI help, the sign-in screen, Settings → Privacy. |

## Reading and replying (6.1 — US-25, US-30 to US-40)

| What moved | Problem answered |
| --- | --- |
| The reply area is docked under the email. When room is short it gives way before the email does and its writing area scrolls. | #1 Send, Save as draft and the AI help are on screen at 1440 × 900 and on a phone. |
| "No reply needed" and "Ignore" are in the email's header. | #2 They are decisions about the email, taken before writing. |
| The three kinds of AI help sit in one row: Check typos, Improve style, Write with + the list of prompts. The suggested prompt carries a "Suggested" label. | #3 Three equals; the suggestion is no longer text inside a select option. |
| A proposal is tinted, under a note that says what the AI did and with which model. "Put my text back" is a button in that note. Once edited, the tint goes and the note says so. | #4 A proposal no longer arrives silently. |
| Passages in square brackets are highlighted in the text and counted next to Send. The highlight uses the browser's highlight registry: the text that is sent is not changed. | #5 Placeholders cannot be missed. |
| "You changed the proposal. Why?" appears directly under the edited text, with what it is for and who reads it. | #6 |
| Recipients are removable chips for To and Cc, on one line with "Reply to all". | #7 |
| Sending is confirmed in a dialog listing From, To and Cc. A link's address is asked in the same kind of dialog. | #8 |
| The toolbar is icons, with their names as tooltips and accessible names. | #9 |
| Buttons show a spinner while they work and keep their label and width. | #10 (toasts are unchanged) |
| The header shows the sender's name and avatar, "To … · Cc …" on one line, attachments as chips, a short date, and the triage verdict as a badge with its reason. | #11 |

## The boxes and the shell (6.2 — US-20 to US-24, US-39, US-40)

| What moved | Problem answered |
| --- | --- |
| List rows are three lines: sender, tags and time; subject; first words. Tags sit beside the sender. A shared mailbox is a short name with an icon, its full address as a tooltip. | #1 Rows went from 90–115 px to under 90 px, with the tags on the sender's line. |
| "Priority" uses the warning tone; "Not triaged" and "Draft" are neutral. | #2 |
| An empty box and an empty reading pane have an icon, a title and a sentence. With no mailbox connected, the empty box links to Mailboxes. | #3 |
| The list header shows how many emails the box holds and when mail was last fetched; Fetch is an icon button. | #4 |
| An email that needs no reply (or is ignored) shows one line and "Reply anyway" in place of the editor. "Move back to To handle" is in the header. | #5 The editor is one click away, not removed. |
| A sent reply is a panel: who and when, To, Cc and the reason for the edit as plain rows. "Proposal edited" is a neutral badge. | #6 |
| Boxes come first, with icons and counts; configuration is a quieter group under its title. The signed-in user is a name and an avatar; sign-out is an icon button. The ZDR line is a bordered statement with a lock. | #7 |
| Accounts have a name, asked at sign-up and on invitation, editable in Settings. Lists, "by …" and corrections show it, with the address as fallback. | #8 |

## Arriving and connecting (6.3 — US-01 to US-04, US-10 to US-16)

| What moved | Problem answered |
| --- | --- |
| Sign-in, sign-up and invitation fill the window: the brand's ground on one side, the form centred on the other. The language picker is in the corner. | #1 |
| The brand side carries the name, the tagline and the guarantees. A brand may add a byline, a credit and a European-hosting statement in `brand.json`. | #2 |
| Connecting is a path in three steps: connect, choose the folder, read. The first folder choice leads on to the emails. | #3 |
| "Mine" or "Shared by the team" is an explicit choice on the connection page (administrators only). | #4 A mailbox is no longer shared by a checkbox in another card. |
| A provider that is not set up is shown disabled, with the reason in plain text. | #5 |
| The IMAP form asks for address, password and name first; servers, ports and TLS are in their own section. The form lives on the connection page, not under the list. | #6 |
| A connected mailbox is a table row: "Fetch now" is labelled, change folder and disconnect are icon buttons. Dates are short. | #7 |

## Administration and settings (6.4 — US-05 to US-07, US-50 to US-53, US-60 to US-65)

| What moved | Problem answered |
| --- | --- |
| Pages are centred, up to 1000 px wide; forms keep to 640 px. Page titles carry an introduction; cards no longer compete with them. | #1 |
| Prompts are a table of name, description and use. Editing has its own address and a breadcrumb; members' corrections sit beside the instructions. | #2 |
| Members and pending invitations are two tables. Inviting is a button that opens the form; the fresh link is a callout with Copy. | #3 |
| Settings has one tab per audience: You, Organisation, Privacy. Each form has one Save. Appearance moved to Organisation. | #4 |
| Privacy is six titled guarantees, then "your part" (the OpenRouter logging setting), then the technical detail. | #5 |
| A destructive action at rest is a red icon button; its confirmation is a dialog with a solid red button, Cancel focused. | #6 |

## Small screens (6.5 — US-41)

The boxes are a bar at the bottom of the screen, with a "More" entry for configuration, who is signed in and sign-out. The editor toolbar fits on one line. The reply area is a sheet at the bottom: Send stays in view. Tables scroll sideways inside their frame.

## Dark scheme and brands (6.6 — US-80 to US-82)

Cards and panels now carry a shadow as well as a border, which separates them in dark; the surface colour itself is unchanged. A brand now changes more than the accent: borders, muted text, the sunken navigation and shadows all derive from its ink and canvas, the sign-in ground from its accent. `brands/klaro/` is the Klaro Cards brand, with Poppins self-hosted.

## Known gaps

- The select keeps its native arrow.
- Toasts are unchanged: one at a time, at the bottom.
- The prompt list shows replies and edits, not "corrections to read": the server does not record which ones an administrator has seen.
- The captures in `screenshots/` show the interface as it was before this work.
