# saras — user stories

One story per feature the application has today, written from the code (`web/pages/`, `src/tooling/http/`, `src/domain/mailboxes/fetch-mailbox.ts`, `src/domain/sorting/`) and the README. Each story lists the behaviour as built, so it can be used as an acceptance checklist.

How the screens are designed and built is in [`design/`](design/README.md).

## Who uses saras

| Persona | Who they are | What they do here |
| --- | --- | --- |
| **Member** | Someone who answers email for a living: consultant, office manager, support agent. Not technical. | Works through the emails waiting for a reply, writes or lets the AI draft, reviews, sends. |
| **Administrator** | A member who also runs the organisation's account. The person who signed up, plus whoever they appoint. | Invites colleagues, connects shared mailboxes, writes the prompts, sets the organisation's AI settings. |
| **Invited person** | A colleague who received an invitation link. | Chooses a password and becomes a member. |
| **Operator** | Whoever hosts the installation (often the administrator of a single organisation; sometimes an IT provider hosting several). | Deploys, configures the environment, applies the brand. Works in files, not in the interface. |

## Index

| Area | Stories |
| --- | --- |
| [A. Access and organisation](#a-access-and-organisation) | US-01 – US-09, US-0A |
| [B. Mailboxes](#b-mailboxes) | US-10 – US-17 |
| [C. Triage and the four boxes](#c-triage-and-the-four-boxes) | US-20 – US-25 |
| [D. Writing and sending a reply](#d-writing-and-sending-a-reply) | US-30 – US-41 |
| [E. Prompts](#e-prompts) | US-50 – US-53 |
| [F. Settings](#f-settings) | US-60 – US-69 |
| [G. Privacy guarantees](#g-privacy-guarantees) | US-70 – US-74 |
| [H. Installation, brand and languages](#h-installation-brand-and-languages) | US-80 – US-86 |

---

## A. Access and organisation

### US-01 — Create an organisation
**As** the first person of a team, **I want** to sign up with my organisation's name, my email and a password, **so that** my team has its own private space and I can administer it.

- Signing up creates the organisation and makes me its administrator.
- I may give my name, which the other members then see in place of my address.
- An empty installation always accepts its first sign-up, and says so on the sign-in page; afterwards sign-up is open only if the operator allows it (`ALLOW_SIGNUP`).
- The password has at least 10 characters. An address has one account, in one organisation.
- One default prompt is created in my language (US-51), and I am taken through getting started (US-08), which begins with connecting a mailbox.

### US-08 — Be taken through getting started
**As** someone who just created an organisation, **I want** to be led from sign-up to a first email, **so that** I am ready in a few minutes without looking for the right pages.

- The path is shown at the top of each of its screens: connect a mailbox, choose the folder, give the AI its key (only when none is available), read the prompt, choose how it works, try it on a first email.
- It ends on the first email to handle, open, with a line saying what to try.
- An invited member only connects a mailbox and chooses its folder: the rest is the administrators' business.
- Every step can be left; what it sets stays reachable in **Mailboxes**, **Prompts** and **Settings**.

### US-02 — Sign in and sign out
**As** a member, **I want** to sign in with my email and password and sign out when I am done, **so that** only I reach my mailboxes.

- Wrong credentials give one message that does not say which of the two is wrong; repeated attempts are rate-limited.
- A lost session returns to the sign-in page from any screen.
- When sign-up is closed, the page tells newcomers to ask their administrator for an invitation.
- There is no password reset and no two-factor authentication (known limitation).

### US-09 — Sign in with a second factor
**As** a member of an installation that requires it, **I want** to confirm my sign-in with a code from an app on my phone, **so that** my password alone does not open my organisation's mail.

- The operator turns it on for everyone (`MFA_ENABLED=true`); there is then no session on a password alone, including right after creating an organisation or accepting an invitation.
- The first time, I scan a QR code in an authenticator app (or type its key), confirm with a code, and am shown eight recovery codes once.
- Afterwards I am asked for the app's six-digit code. A code is good once; a recovery code replaces it, once each.
- A wrong code counts towards the lock-out of US-02. A sign-in left waiting for ten minutes starts again with the password.
- If I lose my app and my recovery codes, an administrator resets my second factor from **Users**: I am signed out everywhere and set a new one up at my next sign-in.

### US-0A — Replace a lost password
**As** a member who lost their password, **I want** a link to choose a new one, **so that** I am not locked out.

- **Forgot your password?** on the sign-in page. Where the server has outgoing mail of its own (`SMTP_URL`, `MAIL_FROM`), I give my address and am sent a link; the page says the same whether the address has an account or not.
- Where it has none, the page tells me to ask an administrator, who creates the link from **Users** (key button) and hands it to me.
- The link is good once, for an hour. Choosing the new password signs me out everywhere; I then sign in with it, second factor included where required.
- On every password field of the sign-in, sign-up, invitation and new-password pages, an eye shows what I typed.

### US-03 — Invite a colleague
**As** an administrator, **I want** to create an invitation link for a colleague's address, with a role, **so that** they can join my organisation without my choosing their password.

- I enter an address and a role (User or Administrator) and get a one-time link, valid for `INVITATION_DAYS` days (7 by default).
- The link is shown once, with a Copy button; I pass it on myself, because saras has no outgoing mailbox of its own.
- Only a hash of the link is stored. Inviting the same address again invalidates the earlier link.
- An address that already has an account cannot be invited.

### US-04 — Accept an invitation
**As** an invited person, **I want** to open my link, give my name and choose a password, **so that** joining takes a few seconds.

- The page names the organisation and shows my address, which I cannot change.
- An invalid or expired link says so and offers the way to the sign-in page.
- After accepting I am signed in, on **Mailboxes**, and the token is gone from the address bar.

### US-05 — Follow and revoke pending invitations
**As** an administrator, **I want** to see the invitations that were not accepted yet, with their role and expiry, and revoke one, **so that** no forgotten link stays usable.

- Each pending invitation shows the address, the role, and when it expires or that it has expired.
- Revoke removes it at once.

### US-06 — Appoint and remove administrators
**As** an administrator, **I want** to give or remove the administrator role, **so that** the organisation is not run by me alone.

- Each member is listed with their role, the date they joined and the number of personal mailboxes they connected.
- At least one administrator always remains; removing my own role takes effect immediately.

### US-07 — Delete a member
**As** an administrator, **I want** to delete a member's account, **so that** someone who left no longer has access.

- A confirmation states the consequences: their personal mailboxes, emails and replies stored in saras are erased; the mailboxes themselves are untouched.
- The prompts and the shared mailboxes they created stay with the organisation.
- I cannot delete my own account from the list of users: that is done from my settings (US-68).

---

## B. Mailboxes

### US-10 — Connect a mailbox over IMAP / SMTP
**As** a member, **I want** to connect my mailbox with its IMAP and SMTP servers, **so that** saras can read the folder I choose and send in my name.

- I give the address, the name shown to recipients, an optional username, the password, and for each server its host, port and whether TLS is direct.
- For my first mailbox the address and the name are those I signed up with, and the servers are proposed from the address; I can change all of them.
- saras looks up who hosts my address's domain. When it is Google or Microsoft, I am pointed to signing in there (US-11, US-12), or told that my usual password will probably be refused when that is not set up.
- Changing a port sets "Direct TLS" accordingly (993 / 465 direct; otherwise STARTTLS, which is then required).
- The connection is tested before anything is saved; a failure shows the server's own message.
- The password is stored encrypted. An address is connected once per organisation: connecting it again is refused (see US-17 to renew its access).

### US-11 — Connect Gmail / Google Workspace
**As** a member, **I want** to connect my Google mailbox by granting access at Google, **so that** I never type its password into saras.

- The button is available when the operator configured a Google OAuth application; otherwise it is visibly unavailable, with the reason.
- Refusing or an expired authorisation brings me back to **Mailboxes** with the reason.
- Access asked: read the mailbox, create drafts, send.

### US-12 — Connect Outlook / Microsoft 365
**As** a member, **I want** to connect my Microsoft mailbox by granting access at Microsoft, **so that** I never type its password into saras.

- Same behaviour as US-11, through Microsoft Graph.
- Only top-level folders are offered for watching (known limitation).

### US-13 — Choose the folder to watch
**As** a member, **I want** to choose the one folder of my mailbox that saras watches, **so that** I decide what it sees — the whole inbox, or a folder I fill myself.

- Right after connecting, the mailbox asks for its folder; the inbox is first and preselected. Nothing is fetched before that choice.
- Only that folder is ever fetched (an IMAP folder, a Gmail label, an Outlook folder).
- I can change it later; what was fetched from the previous folder is kept.
- Choosing a folder starts a first fetch. The first time, I am taken to my emails once it is done; if no AI key is available and I am an administrator, I am first asked for the organisation's key, which I may give later.

### US-14 — Connect a shared mailbox
**As** an administrator, **I want** to connect an address such as contact@ as shared, **so that** every member, present and future, sees its emails and can reply from it.

- When connecting (by OAuth or IMAP) I choose "Shared by the team" rather than "Mine".
- Every member sees a shared mailbox in **Mailboxes** and its emails in the boxes; only administrators change its folder or disconnect it.
- A personal mailbox is seen by its owner only — administrators included.

### US-15 — Fetch new email
**As** a member, **I want** new emails fetched automatically and on demand, **so that** my list is current when I sit down to answer.

- The server fetches every `SYNC_INTERVAL_MINUTES` minutes (10 by default).
- **Fetch** at the top of a box fetches all my mailboxes and says how many emails arrived; **Fetch now** does it for one mailbox.
- A fetch takes the most recent emails of the watched folder (`SYNC_MAX_EMAILS` over `SYNC_DAYS` days).
- Each mailbox shows its watched folder, when it was last fetched, how many emails are to handle, and its last error if any.

### US-16 — Disconnect a mailbox
**As** a member, **I want** to disconnect a mailbox, **so that** saras stops reading it and forgets what it stored from it.

- A confirmation states that the emails and replies stored in saras are deleted and the mailbox itself is not touched.
- For a shared mailbox, only administrators can.

### US-17 — Renew access to a mailbox
**As** a member, **I want** to give saras access to my mailbox again after I changed its password, or after the access I granted was withdrawn or ran out, **so that** fetching resumes without losing anything.

- From **Mailboxes**, the key button of a mailbox I manage: a new password for a mailbox connected by its servers; a new sign-in at Google or Microsoft for the others.
- The new access is tested before it is saved. Signing in to another mailbox than the one being renewed is refused.
- The folder watched and the emails kept do not change; the mailbox's last error is cleared and it is fetched at once.

---

## C. Triage and the four boxes

### US-20 — Set plainly automated mail aside
**As** a member, **I want** newsletters, notifications and no-reply senders set aside without any AI, **so that** they neither clutter my list nor cost anything.

- Header rules catch: no-reply and notification addresses, mailing lists, automatic replies, bulk mail, my own messages, and (over IMAP) what I already answered in my mail client.
- These emails go to **No reply needed** with the rule's reason, and never reach an LLM.
- An organisation can turn the rules off (US-63).

### US-21 — No triage by default
**As** a member, **I want** every remaining email of the folder I watch to be "to handle" unless I say otherwise, **so that** no content leaves the server until I ask for a draft.

- With the default strategy (`none`), the gate decides nothing: everything that passed the rules is in **To handle**, and I pick the prompt myself.

### US-22 — Let the AI triage
**As** a member of an organisation that chose AI triage, **I want** the AI to tell which emails expect a reply, how urgent they are, and which prompt fits, **so that** I start with the right ones and the right tone.

- The AI reads the sender, the recipients, the subject, the first 1,500 characters and the names of the attachments — never their content.
- Per email it returns: reply needed or not, a one-sentence reason in my language, a suggested prompt, a priority.
- High-priority emails carry a **Priority** badge; the reason is shown above the email with who decided (AI, a rule, me).
- An email the AI did not decide about stays **Not triaged** in **To handle** and is presented again at the next fetch.

### US-23 — Work through four boxes
**As** a member, **I want** my emails in four lists — To handle, No reply needed, Replied, Ignored — each with its count, **so that** I always know what is left.

- The navigation shows the four boxes and how many emails each holds.
- A list row shows the sender, the date (time today, date otherwise), the subject, the first line, the marks Priority, Not triaged and Draft, and the shared mailbox it came from.
- On a large screen the list and the open email sit side by side; on a small one they alternate, with a Back link.
- An empty box says so and, for **To handle**, how to get emails.

### US-24 — Correct the triage
**As** a member, **I want** to mark an email as needing no reply, ignore it, or move it back to "To handle", **so that** the final say is mine.

- From **To handle**: *No reply needed* and *Ignore*.
- From **No reply needed** and **Ignored**: *Move back to "To handle"*. The reply area stays closed there until I ask for it with *Reply anyway*.
- My decision is recorded as mine and shown as such on the email.

### US-25 — Read an email
**As** a member, **I want** to read the email with who sent it, to whom, when, and what came attached, **so that** I can answer without opening my mail client.

- Subject, sender (name and address), date (complete on hover), To and Cc, and the names of the attachments.
- The body is shown as plain text and scrolls on its own when long.
- Attachments cannot be opened: only their name, type and size are kept.
- Past the retention period the content is erased and the email says so.

---

## D. Writing and sending a reply

### US-30 — Write in one rich-text reply area
**As** a member, **I want** one editor where I write a full reply or just a few notes, with basic formatting, **so that** I am never forced through the AI.

- Formatting: bold, italic, underline, bulleted and numbered lists, links, clear formatting. The toolbar shows which formats are active.
- What I write can be sent as it is.
- Pasted content is sanitised to the same few elements.
- Replies cannot carry attachments or images (known limitation).

### US-31 — Just check typos
**As** a member, **I want** the AI to correct spelling, grammar and punctuation and nothing else, **so that** my own words go out without mistakes.

- Only what I wrote is sent to the AI; the received email is not.
- The corrected text replaces mine and I can put mine back (US-34).
- With nothing written, I am told to write something first.

### US-32 — Improve style
**As** a member, **I want** the AI to rewrite what I wrote for clarity and tone, keeping the meaning and the facts, **so that** a hasty reply reads professionally.

- Only what I wrote is sent to the AI; the received email is not.
- Same replace-and-undo behaviour as US-31.

### US-33 — Apply a prompt
**As** a member, **I want** the AI to write the reply the way one of my organisation's prompts describes, from the email received and from my notes — or from nothing, **so that** I get a reply in the house style in seconds.

- I choose the prompt in a list; the one the AI suggested at triage is preselected and marked.
- What I wrote is treated as what the reply must say: notes, instructions or a draft to rework.
- The reply is written in the language of the email received, ends with my signature, and uses a placeholder in square brackets where information is missing rather than inventing it.
- Without any prompt in the organisation, I am told to create one (administrator) or ask for one (member). Without an API key, I am pointed to **Settings**.

### US-34 — Stay in control of a proposal
**As** a member, **I want** to see what produced a proposal, edit it freely, and get my own text back, **so that** the AI's help is never a one-way door.

- A note above the text says what was done, by which model and through which provider, and that I edited it once I have.
- Passages in square brackets are highlighted and counted next to Send, so that none is sent by oversight.
- "Put my text back" restores what the editor held before the AI replaced it.
- Reopening an email brings back its latest proposal.

### US-35 — Choose the recipients
**As** a member, **I want** To prefilled with the sender, and Reply to all one tick away, **so that** the right people get my answer.

- To is prefilled (the Reply-To address when there is one). Cc is empty.
- "Reply to all" appears when the email had other recipients, and fills Cc with them.
- Addresses are shown one by one and can be removed or added; an invalid address stops the sending with a message naming it.

### US-36 — Send after explicit validation
**As** a member, **I want** nothing to leave without my confirming the account and the recipients, **so that** no AI-written text is ever sent by accident.

- Send asks for confirmation, naming the mailbox it is sent from and the recipients.
- The reply goes out as HTML with a plain-text alternative, both quoting the original, attached to the original thread.
- The email moves to **Replied**; over IMAP it is flagged answered in the mailbox.

### US-37 — Save as a draft in my mailbox
**As** a member, **I want** to file the reply in my mailbox's Drafts folder instead of sending it, **so that** I can finish it in my usual mail client.

- The draft is attached to the original thread, in the Drafts folder (IMAP, Gmail or Microsoft Graph). Nothing is sent.
- The email moves to **Replied** with a **Draft** badge and a notice that it is waiting in my mailbox.
- What I change afterwards in my mail client is unknown to saras.

### US-38 — Say why I changed a proposal
**As** a member, **I want** to say in a few words why I changed what the AI wrote, **so that** my next proposals with the same prompt take it into account.

- The field appears only when I changed a proposal made with a prompt; it is optional.
- The reason is given to the AI for my next proposals with that prompt — mine only.
- Administrators see these reasons per prompt (US-52); I am told so in **Settings → Privacy**.

### US-39 — Look back at what was answered
**As** a member, **I want** to reopen an answered email and see what was sent, to whom and when, **so that** I can check or recall my answer.

- **Replied** shows the original, then the reply: sent or filed as a draft, the date, the recipients, whether the proposal was edited or kept as is, and the reason given for the change.

### US-40 — Share a mailbox without stepping on each other
**As** a member replying from a shared mailbox, **I want** an email answered by a colleague to leave everyone's list and show who answered, **so that** nobody answers twice.

- Emails of a shared mailbox carry its name in every list.
- A reply by one member moves the email to **Replied** for all, with "by …" on the reply.
- Trying to answer an email already handled is refused with a clear message.
- Each member keeps their own signature, and their corrections steer their own proposals only.

### US-41 — Answer from my phone
**As** a member away from my desk, **I want** the whole reply flow to work on a small screen, **so that** an urgent email does not wait.

- Below 860 px the four boxes become a bar at the bottom, with a **More** entry for everything else, and the list and the open email alternate.
- The reply area stays docked at the bottom, so that Send is in view.
- Every action of the large screen is available.

---

## E. Prompts

### US-50 — Write the organisation's prompts
**As** an administrator, **I want** to create, edit and delete prompts — a name, when to use it, and the instructions, **so that** replies follow our tone and our rules.

- "When to use it" is what the AI reads to suggest a prompt at triage.
- The instructions cover tone, structure and business rules; the common rules (language of the email, invent nothing, signature, format) are added automatically.
- Deleting asks for confirmation.

### US-51 — Start with sensible prompts
**As** an administrator of a new organisation, **I want** one ready-made prompt in my language and others I can add in one click, **so that** the tool is useful before I write anything, without prompts I never read.

- One prompt is created with the organisation: the standard professional reply, in English or French.
- Four more are offered as templates in **Prompts** and when getting started: appointment scheduling, polite refusal, customer support, acknowledgement of receipt. A template can be added once.
- They are ordinary prompts afterwards: I edit or delete them freely.

### US-52 — Learn from how prompts are used
**As** an administrator, **I want** to see how often each prompt was used, how often its proposals were edited, and the reasons members gave, **so that** I can fold recurring corrections into the instructions.

- Each prompt shows its number of replies and how many were edited.
- Editing a prompt lists, beside its instructions, the corrections made to its proposals, with their author and date.

### US-53 — Use prompts without seeing their recipe
**As** a member, **I want** to choose among the organisation's prompts by name, **so that** I use the house style without having to manage it.

- Members see the name and the description of each prompt, not the instructions, and have no **Prompts** page.

---

## F. Settings

### US-60 — Set my signature
**As** a member, **I want** to save my signature, **so that** every proposal ends with it, exactly as I wrote it.

- Free text over several lines, added as is at the end of each proposal made with a prompt.
- On the same page I set my name, shown to the other members in place of my address.

### US-61 — Use my own model and API key
**As** a member, **I want** to choose another OpenRouter model and enter my own key, **so that** I use the model I prefer and pay for my own usage.

- Model: an identifier "provider/model"; empty means the organisation's default.
- Key: stored encrypted, never shown again, removable. A request uses my key, else the organisation's, else the server's.
- A model without a zero-data-retention provider is refused at the first request, with an explanation.

### US-62 — Choose my language
**As** a member, **I want** the interface in my language, **so that** I work comfortably.

- English by default, French provided; chosen in **Settings** and on the sign-in page, else taken from the browser.
- Dates follow my regional format. What the server writes for me (triage reasons, the "On …, … wrote:" line) follows my language.
- The reply itself is always in the language of the email received.

### US-63 — Configure the organisation
**As** an administrator, **I want** to set my organisation's name, what the AI does at sorting and at writing, and its own model and key, **so that** every member works the same way at the organisation's expense.

- Name; sorting and writing (US-66 — with the cost of AI sorting and what the AI is sent stated); whether automated mail is set aside first; default model; the organisation's OpenRouter key (encrypted, removable).

### US-66 — Choose what the AI does at sorting and at writing
**As** an administrator, **I want** to choose what the AI does at each of the two steps an email goes through, **so that** it does as much, or as little, before a member opens an email as suits us.

- The page explains the two steps and asks one choice for each. **1. Sorting** — when emails are fetched, which need a reply: nobody sorts (every email of the watched folder is to handle), or the AI sorts. **2. Writing** — when the AI writes a proposal for an email to handle: when a member asks; at fetch, to review in saras; at fetch, also filed in the mailbox's Drafts folder (the email then moves to **Replied** as a draft).
- Each choice says what the AI is sent. The choices that need the AI cannot be made without a key.
- The two choices are independent, and are also in **Settings → Organisation**.
- At the end of getting started, what the first fetch let through unsorted is sorted again as chosen.
- A proposal written at fetch is written as the mailbox's owner (their signature and corrections), with the prompt suggested at sorting or else the organisation's first; at most ten per fetch and mailbox.
- Nothing is ever sent automatically: sending is always a member's confirmed action.

### US-67 — Change my password
**As** a member, **I want** to change the password I sign in with, **so that** I can replace one I no longer trust.

- In **Settings → You**: my current password, and a new one of at least 10 characters.
- My other sessions are signed out; the one I am using stays.
- A wrong current password is refused, and counts towards the lock-out of US-02.

### US-68 — Delete my account
**As** a member, **I want** to delete my own account, **so that** I can leave saras without asking anyone.

- In **Settings → You**: my password, then a confirmation.
- My personal mailboxes are disconnected and what saras kept from them is erased; the mailboxes themselves are not touched.
- The prompts I created and the shared mailboxes I connected stay with the organisation, in the hands of its longest-standing other administrator.
- The organisation's last administrator cannot: they first appoint another, or delete the organisation (US-69).

### US-69 — Delete the organisation
**As** an administrator, **I want** to delete my organisation, **so that** nothing of ours is left in saras when we stop using it.

- In **Settings → Organisation**: the organisation's name typed in full and my password, then a confirmation.
- Every member's account, every mailbox connection, the prompts and everything saras kept are erased; every member is signed out. The mailboxes themselves are not touched.

### US-64 — See the privacy guarantees in force
**As** a member, **I want** to read, in the application, what happens to my emails, **so that** I can trust it — and explain it to a client who asks.

- **Settings → Privacy** states: the retention policy sent with every AI request, the triage strategy in force and what it reads, the local retention period, the encryption of secrets, that nothing is sent without validation, and who sees my correction reasons.
- A standing line in the navigation reminds that zero data retention is enforced on every AI request.

### US-65 — Be told when the AI cannot help
**As** a member, **I want** to be told plainly when no API key is configured or the AI refuses, **so that** I know what to fix or whom to ask.

- Without any key: a warning in **Settings** and in the reply area, with a link.
- AI failures are explained in my language: key refused, no credit, rate limit, no zero-data-retention provider for the model, service unreachable.

---

## G. Privacy guarantees

These are behaviours of the system rather than screens, but they are what the product sells, and the interface must keep making them visible.

### US-70 — Zero data retention, enforced
**As** a member handling confidential email, **I want** every AI request to demand no retention and no training, and to fail rather than fall back, **so that** my correspondents' data is never kept by a model provider.

- Every OpenRouter request carries `zdr: true` and `data_collection: deny`; this is hardcoded and cannot be configured away.
- If no provider of the model satisfies both, the request is refused and the error is shown.

### US-71 — Send the AI as little as possible
**As** a member, **I want** the AI to receive only what the action needs, **so that** exposure is minimal.

- Checking typos and improving style send only my text. Applying a prompt sends the email, the prompt and my text.
- The content of attachments is never stored nor sent. Automated mail never reaches the AI.
- With the default triage, no email content leaves the server until I ask for a proposal.

### US-72 — Forget old email
**As** a member, **I want** the content of emails erased from saras after a set period, **so that** it does not become a second archive of my mailbox.

- Content is erased after `RETENTION_DAYS` days (30 by default; 0 keeps it). The erased email remains listed and says its content is gone.

### US-73 — Keep secrets encrypted
**As** a member, **I want** my mailbox password, OAuth tokens and API keys encrypted at rest, **so that** a leaked database does not open my mailbox.

- AES-256-GCM with a key derived from `APP_SECRET`. A saved key is never displayed again.

### US-74 — Never trust incoming content
**As** a member, **I want** received emails and AI output treated as untrusted, **so that** a malicious email can neither hijack the AI nor inject markup into my reply.

- Received content is delimited in prompts and the model is told not to follow instructions in it.
- Whatever the AI returns, and whatever is stored or sent, is rebuilt from a short list of allowed elements; the interface sanitises again before displaying.

---

## H. Installation, brand and languages

### US-80 — Put the tool in my company's colours
**As** an operator, **I want** to change the name, logo, colours, fonts and corner radius from a folder, **so that** the tool looks like ours without touching the code.

- A brand folder holds `theme.css` (a dozen variables, light and dark), `brand.json` (name, tagline per language, logos, and optionally a byline, a credit and a European-hosting statement for the sign-in page) and assets. A missing file falls back to the default brand.
- Everything else in the interface derives from those variables.

### US-81 — Check the brand on a style guide
**As** an operator tuning a brand, **I want** one page showing every token and component with my brand applied, **so that** I can judge the result at a glance.

- `/styleguide.html`, built from the same components as the application, linked from **Settings → Appearance** for administrators.

### US-82 — Follow the visitor's light or dark preference
**As** a member, **I want** the interface to follow my system's light or dark mode, **so that** it is comfortable at any hour.

- Both schemes are derived from the brand; a brand may force one.

### US-83 — Add or correct a translation
**As** an operator, **I want** every word of the interface in a translation file, **so that** I can add a language or fix a wording without a rebuild.

- One JSON file per language (Tolgee format, ICU messages); tests keep languages complete and consistent.

### US-84 — Deploy simply
**As** an operator, **I want** to run saras with one command, with an embedded database to try it and a PostgreSQL server for real use, **so that** hosting it myself is not a project.

- `npm start` with embedded PostgreSQL, or `docker compose up` with a PostgreSQL server. The schema is created at startup.

### US-85 — Set the installation's policies
**As** an operator, **I want** to decide who may sign up, how often mail is fetched, how long content is kept, and which OAuth applications are available, **so that** the installation fits my context.

- Environment variables: sign-up policy, invitation validity, fetch interval and depth, retention, default triage strategy for new organisations, default model, server API key, Google and Microsoft OAuth applications.

### US-86 — Host several organisations
**As** an operator hosting organisations that are not mine, **I want** each one isolated and paying for its own AI usage, **so that** I can offer the tool as a service.

- Nothing crosses from one organisation to another: members, mailboxes, prompts, settings.
- With the server key left empty, each organisation uses its own key.
- The brand, the OAuth applications, the retention period and the fetch settings are the installation's, not the organisation's.
