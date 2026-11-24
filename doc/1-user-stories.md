# saras — user stories

One story per feature the application has today, written from the code (`web/pages/`, `src/tooling/http/`, `src/domain/mailboxes/fetch-mailbox.ts`, `src/domain/sorting/`) and the README. Each story lists the behaviour as built, so it can be used as an acceptance checklist.

How the screens are designed and built is in [the design document](4-design.md).

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
| [J. Boards and attributes](#j-boards) | US-90 – US-96 |
| [B. Mailboxes](#b-mailboxes) | US-10 – US-17 |
| [C. Sorting and the four boxes](#c-sorting-and-the-four-boxes) | US-20 – US-27 |
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
- The connection is tested before anything is saved; a failure shows the server's own message. When direct TLS was asked of a port that starts in clear (587, 143), it says so instead, and what to untick.
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
- With the folder, I choose what is fetched from it: the emails received in the last day, 7, 14 or 30 days (never further back than the server keeps emails), and whether only those I have not read yet in my mailbox. Until I choose, it is the last `SYNC_DAYS` days, read or not. I can change it later from **Mailboxes**, with the folder.
- A fetch takes the most recent of those emails first, at most `SYNC_MAX_EMAILS` at a time; what was fetched before stays. When it leaves older ones for the next fetches, it says how many are still to come.
- Each mailbox shows its watched folder, when it was last fetched, how many emails are to handle, and its last error if any.

### US-16 — Disconnect a mailbox
**As** a member, **I want** to disconnect a mailbox, **so that** saras stops reading it and forgets what it stored from it.

- A confirmation states that the emails and replies stored in saras are deleted and the mailbox itself is not touched.
- For a shared mailbox, only administrators can.

### US-17 — Change a connected mailbox, and renew its access
**As** a member, **I want** to look at and change how a mailbox I manage is set up — the name its replies show, what is fetched from it, how saras reaches it — and give saras access to it again after a password change or once the access I granted was withdrawn or ran out, **so that** I correct it without disconnecting it and losing its emails.

- From **Mailboxes**, **Edit** on a mailbox I manage opens its page. The list also says, beside the folder, how far back each mailbox is fetched and whether only unread mail.
- **Name shown to recipients**: shown beside the address on replies; empty, replies show the address alone.
- **What is fetched**: the folder, how far back, read or not; changed on the page that chooses them (US-16).
- **How saras reaches it**: for a mailbox connected by its servers, the IMAP and SMTP servers, their ports, the user name and the password. The password saras has is never shown; left empty, it is kept. For Google or Microsoft, a new sign-in there.
- The address of a mailbox cannot be changed: another address is another mailbox.
- The new access is tested before it is saved. Signing in to another mailbox than the one being renewed is refused.
- The folder watched and the emails kept do not change; the mailbox's last error is cleared and it is fetched at once.

---

## C. Sorting and the four boxes

### US-20 — Set plainly automated mail aside
**As** a member, **I want** newsletters, notifications and no-reply senders set aside without any AI, **so that** they neither clutter my list nor cost anything.

- Header rules catch: no-reply and notification addresses, mailing lists, automatic replies, bulk mail, my own messages, and (over IMAP) what I already answered in my mail client.
- These emails go to **No reply needed** with the rule's reason, and never reach an LLM.
- An organisation can turn the rule off, or change it: it is the rule of the attribute **Stands in** (US-94).

### US-21 — The AI does not sort
**As** a member, **I want** every remaining email of the folder I watch to be "to handle" unless a rule of ours or one of us says otherwise, **so that** no email is read by the AI to be sorted, and I can always tell why an email is where it is.

- Everything that passed the rules is in **To handle**. No LLM decides whether an email needs a reply, nor how urgent it is: rules do (US-94), and members (US-24, US-95).
- An email the AI sorted, when it could, stays where it put it, marked **The AI** with its reason.

### US-23 — Work through four boxes
**As** a member, **I want** my emails in four lists — To handle, No reply needed, Replied, Ignored — each with its count, **so that** I always know what is left.

- The navigation shows the four boxes and how many emails each holds.
- A list row shows the sender, the date (time today, date otherwise), the subject, the first line, the mark Draft, its values for the organisation's own attributes (US-95), and the shared mailbox it came from.
- On a large screen the list and the open email sit side by side; on a small one they alternate, with a Back link.
- An empty box says so and, for **To handle**, how to get emails.

### US-24 — Correct the sorting
**As** a member, **I want** to mark an email as needing no reply, ignore it, or move it back to "To handle", **so that** the final say is mine.

- From **To handle**: *No reply needed* and *Ignore*.
- From **No reply needed** and **Ignored**: *Move back to "To handle"*. The reply area stays closed there until I ask for it with *Reply anyway*.
- My decision is recorded as mine and shown as such on the email.

### US-25 — Read an email
**As** a member, **I want** to read the email with who sent it, to whom, when, and what came attached, **so that** I can answer without opening my mail client.

- Subject, sender (name and address), date (complete on hover), To and Cc, and the names of the attachments.
- An email that was written in HTML is shown as it was written: its layout, fonts, colours and links, in a frame that scrolls on its own. "Text only" shows its plain text instead, which is what an email without HTML shows.
- Shown as written, an email runs nothing and loads nothing from anywhere: an image hosted elsewhere is not loaded, since it would tell the sender that I opened the email, and I am told when one was held back. Images the email carries in its own HTML are shown. A link opens in a tab of its own.
- An attachment opens from its name: it is read from the mailbox at that moment, in a tab of its own when it is an image, a PDF or plain text, and saved otherwise. Only its name, type and size are kept.
- Known limitations: no HTML is kept of a mailbox connected by Microsoft sign-in, and attachments open only for a mailbox connected by its servers (see the deviations).
- Past the retention period the content is erased and the email says so.

---

### US-26 — Search a list
**As** a member, **I want** to find an email in a box or a board by a few words, **so that** I need not scroll for it.

- A field above the list searches it as I type; `/` reaches it from anywhere but a field, Escape clears it.
- Every word must be found in who sent the email (name or address), its subject or its text, whatever the case. The words found are marked, and the first lines shown are taken around the first word.
- The count says how many of the list match. The search is kept in the address, so a list searched can be shared or come back to; opening an email keeps it.
- From a box, one click searches every box. A board is searched among what it shows. An email whose text was erased past retention is still found by its sender and subject. Nothing is sent to an AI.

### US-27 — Act on several emails at once
**As** a member, **I want** to tick several emails and say at once that they need no reply, or give them a value, **so that** a morning's newsletters or a client's thread take one gesture.

- A box before each email, shown on hover and on every email once one is ticked; Shift ticks every email from the last one ticked.
- Above the list, while any is ticked: how many, a box that ticks every email shown or none, the moves the box allows (No reply needed, Ignore, Move back to "To handle"), and **Set**, which gives every attribute's values, or none, to all of them. The reading pane says the same while no email is open.
- When every email shown is ticked and the list holds more, I can select all of them: the server is then told the list (its box or board, and what is searched), never each email.
- A replied email stays where it is. A value set so is mine, as when set on one email. Only emails I may see are touched.

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

- I choose the prompt in a list; the one that suits the email by its attributes is preselected and marked.
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
- Administrators see these reasons per prompt (US-52); I am told so in **Settings → AI & privacy**.

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

- "When to use it" is what members read to choose a prompt.
- **The emails it suits**: conditions on the attributes of an email, as a list I add to (Topic is Sales; Priority is High). An email suits a prompt when it has one of the values given for every attribute named. Among the prompts an email suits, the one that names the most attributes is the best; the first of the list when several do. A prompt with no condition suits every email alike, and is never preferred. The list of prompts shows what each suits.
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

### US-61 — One model and one key for the organisation
**As** a member, **I want** to see which AI works for my organisation, **so that** I know what my email is sent to without having anything to set up.

- The model and the key are the organisation's, chosen by its administrators (US-63): the same for every member. A member has no model or key of their own.
- **Settings → AI & privacy** shows me the model in force and when the AI writes, above what the product guarantees (US-70).
- A model without a zero-data-retention provider is refused at the first request, with an explanation.

### US-62 — Choose my language
**As** a member, **I want** the interface in my language, **so that** I work comfortably.

- English by default, French provided; chosen in **Settings** and on the sign-in page, else taken from the browser.
- Dates follow my regional format. What the server writes for me (the "On …, … wrote:" line) follows my language.
- The reply itself is always in the language of the email received.

### US-63 — Configure the organisation
**As** an administrator, **I want** to set my organisation's name, when the AI writes, and its own model and key, **so that** every member works the same way at the organisation's expense.

- Settings has three tabs. **You**: my name and signature, my password, the language, deleting my account. **Organisation** (administrators): its name, deleting it. **AI & privacy**: the AI and what is guaranteed about it, together.
- In **AI & privacy**, an administrator sets the model (empty: the server's) and the organisation's OpenRouter key (encrypted, never shown again, removable). When the AI writes is chosen where it applies, and the tab leads there: in **Writing** (US-66). The tab shows it as it stands now, with what the AI is sent then, beside the model and the key. A request uses the organisation's key, else the server's.

### US-66 — Choose when the AI writes
**As** an administrator, **I want** to choose when the AI writes a proposal of reply, **so that** it does as much, or as little, before a member opens an email as suits us.

- The last step of getting started asks one choice: when the AI writes a proposal for an email to handle. When a member asks; at fetch, to review in saras; at fetch, also filed in the mailbox's Drafts folder (the email then moves to **Replied** as a draft).
- Each choice says what the AI is sent. Those that write at fetch cannot be made without a key.
- Afterwards, it is changed in **Configuration → Writing** (the page of the prompts), under the list. Settings says so and leads there.
- At the end of getting started, what the first fetch brought in is prepared as chosen.
- Which prompt an email is offered follows from its attributes, not from the AI: sorting gives the email its attributes (by rules, by hand), and each prompt says which values it suits. The prompt that suits best is preselected and marked for who writes; when none does, the first of the list is offered. Changing what a prompt suits, or an attribute of the email, changes it at once.
- A proposal written at fetch is written as the mailbox's owner (their signature and corrections), with the prompt that suits the email best or else the organisation's first; at most ten per fetch and mailbox.
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

- **Settings → AI & privacy** states, with the AI in force: when it writes and what it is sent then, that every AI request demands zero retention, the local retention period, the encryption of secrets, that nothing is sent without validation, and who sees my correction reasons.

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
- The content of attachments is never stored nor sent to the AI: opening one reads it from my mailbox, for me. Automated mail never reaches the AI.
- No email is sent to the AI to be sorted. Unless my organisation has proposals written at fetch (US-66), no email content leaves the server until I ask for a proposal.

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

- `/styleguide.html`, built from the same components as the application, at its own address on any running instance.

### US-82 — Follow the visitor's light or dark preference
**As** a member, **I want** the interface to follow my system's light or dark mode, **so that** it is comfortable at any hour.

- Both schemes are derived from the brand; a brand may force one.

### US-83 — Add or correct a translation
**As** an operator, **I want** every word of the interface in a translation file, **so that** I can add a language or fix a wording without a rebuild.

- One JSON file per language (Tolgee format, ICU messages); tests keep languages complete and consistent.

### US-84 — Deploy simply
**As** an operator, **I want** to run saras with one command, with an embedded database to try it and a PostgreSQL server for real use, **so that** hosting it myself is not a project.

- `npm start` with embedded PostgreSQL, or the Docker image, on its embedded database or with a PostgreSQL server of the operator's. The schema is created at startup.
- On Kubernetes, a Helm chart ([`world/chart`](../world/chart/)) with the same two choices of database, and a third: a PostgreSQL server the chart runs beside saras.

### US-85 — Set the installation's policies
**As** an operator, **I want** to decide who may sign up, how often mail is fetched, how long content is kept, and which OAuth applications are available, **so that** the installation fits my context.

- Environment variables: sign-up policy, invitation validity, fetch interval and depth, retention, whether new organisations set automated mail aside, default model, server API key, Google and Microsoft OAuth applications.

### US-86 — Host several organisations
**As** an operator hosting organisations that are not mine, **I want** each one isolated and paying for its own AI usage, **so that** I can offer the tool as a service.

- Nothing crosses from one organisation to another: members, mailboxes, prompts, settings.
- With the server key left empty, each organisation uses its own key.
- The brand, the OAuth applications, the retention period and the fetch settings are the installation's, not the organisation's.

## J. Boards

### US-90 — Make a board
**As** a member, **I want** to make a board that shows the emails meeting conditions I choose, **so that** I look at my mail the way my work is organised (a client, a subject, what is urgent).

- **New board** in the menu, under **Boards**, above Configuration. A board has a name and a filter.
- The filter is made of the organisation's attributes (US-93: where the email stands, and the organisation's own) and of the facts of an email: the mailboxes it arrived in, how recently it was received, its sender (part of a name, an address or a domain), keywords (every word must appear in the subject or the text), and whether it has attachments.
- The conditions are a list I add to: a board starts with none, and **Add a condition** offers what it has no condition on yet, my attributes first, then the facts of the email. A condition on an attribute or on the mailboxes holds values I pick one by one, each a chip I can take away; a bin removes the whole condition.
- An email is shown when it meets every condition there; within a condition made of several values, any of them. A condition with no value keeps every email, as does a board with no condition.
- A condition on an attribute, on the mailboxes, on the sender or on keywords can be said the other way round, by choosing its linking word: **is not**, **does not contain**. The board then leaves out the emails that have one of the values picked, that arrived in one of the mailboxes, whose sender's name or address holds the text, or that hold any of the words. An email with no value for an attribute is not left out.
- Beside the conditions, the form says how many emails match now and shows the five most recent, a moment after each change and before anything is saved.
- A board is a view: it moves nothing, and deleting it leaves its emails where they are.

### US-91 — Work from a board
**As** a member, **I want** to read and answer emails from a board, **so that** I stay in my view while I work.

- A board lists its emails like a box does, most recent first, and its entry in the menu says how many it shows.
- Opening an email shows it beside the list, with the same actions and reply area as in a box; once it is dealt with, I am back on the board.

### US-92 — Share a board with the organisation
**As** an administrator, **I want** to share a board with every member, **so that** the team looks at its mail the same way.

- A board is its owner's alone unless an administrator shares it. A shared board is managed by administrators.
- Through a shared board, each member sees only the emails of mailboxes they may use.
- When the member who shared a board leaves, the board stays with the organisation.

### US-93 — Give emails our own attributes
**As** an administrator, **I want** to define the attributes we organise ourselves by (a topic, an assignee, urgent or not), **so that** boards can show our mail the way we work.

- **Configuration → Sorting** lists the organisation's attributes (the page was first called Attributes; its things are still attributes). One is pre-configured, with a name and values that are fixed, because the application relies on them: **Stands in** (to handle, no reply needed, replied, ignored). The others are the organisation's own. It starts with one, **Priority** (high, normal, low), named in the language of who created the organisation and set by hand: like any attribute I make, I rename it, change its values, give it a rule, or delete it.
- A new attribute is a choice among values I type, or a member of the organisation. Each value of a choice has a colour, chosen among seven from its dot. The values of **Stands in** start with theirs, and I change them the same way: with how it is decided, it is all I change of it. Where a value is shown (the list of attributes, an email, the lists of emails, a rule being tried) it is a chip in its colour.
- Each attribute says who decides it when an email is sorted: nobody (set by hand), or a rule. The AI decides none.
- On the form of an attribute, a tick box asks for a rule. Without it, members set it by hand. A “member” attribute has no values to type.

### US-94 — Sort with rules that cost nothing and say what they do
**As** an administrator, **I want** to write the rule that decides an attribute, **so that** sorting is transparent and uses no AI tokens.

- A rule is written in Elo (elo-lang.org). It is given the email (sender, recipients, subject, text, attachments, mailbox, date, a few headers) and answers one of the attribute's values, or nothing.
- The rule that sets automated mail aside is the rule of **Stands in**: it is there to read, and I can change it.
- **Try it on recent emails** shows what a rule would say of my twenty most recent emails, without changing any.
- The rule is written in an editor that knows Elo: colours, matching brackets, completion of its functions.
- The rule is checked against the type of the email as I write it, a moment after I stop: **Fits the email**, or the number of problems. A field an email does not have, a text used as a number, a condition that is not true-or-false is underlined where it is and said under the editor with its line and column. Where a field was probably meant (`subjet` for `subject`), one click writes it. A rule with a problem is refused when it is tried or saved.
- Beside the editor, **What it can answer** lists each value of the attribute as a rule writes it, then `null` and the answer that says why: a click writes one in the rule. A value is written as its label; one of **Stands in**, whose values are named in each reader's language, as its key (`'none'` for no reply needed). **What a rule can read** lists the fields of the email with their types: a click writes one in the rule. **Elo in brief** gives the few constructs most rules need. The editor and what sits beside it show only while a rule is asked for.
- A rule may answer `{value: …, reason: …}`: the reason is kept with the value and shown on the email. The form of a rule says so above the editor. The rule **Stands in** starts with gives its reasons as codes, which are said in each reader's language; a reason in one's own words is shown as written.
- Trying a rule shows, for each recent email, the value it has now beside what the rule says, and how many emails get each value. An email whose value was set by hand is marked as staying as it is.
- **Writing a rule** (from the list of attributes, or beside the editor) is a guide: the shape of a rule, what it can read, rules to start from that can be copied, Elo in brief, what is checked, and the skill for an AI assistant.
- **Download the skill for an AI agent**, beside the trial of a rule, gives a small archive (a folder with one `SKILL.md`) to hand to an AI assistant: it names the attribute and its values, says what a rule is given and must answer, and teaches enough Elo to write one. What the assistant writes is pasted in the editor and tried like any rule.
- A rule Elo cannot read is refused with Elo's own message. A rule that fails or runs too long on an email leaves the attribute undecided for that email.
- Rules apply to the emails fetched from then on. **Save and apply to the emails already kept** has a rule look again at those: it says how many it looked at and how many changed. Values set by hand stay; emails replied or placed by a member stay where they are; an email the rule of **Stands in** no longer places is to handle again.

### US-95 — Set an attribute by hand
**As** a member, **I want** to set or correct the value of an attribute on an email, **so that** it shows on the right boards whatever the rules said.

- Under the header of an email, a tool bar as wide as the email holds each attribute but **Stands in**: its name, its value as a chip, and the sign of who decided it (a rule, by hand), which its tooltip says in words; an attribute without a value is offered with a “+”.
- A click on an attribute opens its values to choose from, “no value” included, and says who decided the current one and why when that is known: the reason its rule gave.
- In a list of emails, each email shows its values for the organisation's own attributes, its priority among them.
- An email has no value for an attribute until a rule or a member gives it one: no priority either.
- A value I set is recorded as set by hand and is not overwritten by later sorting.
- Where an email stands is changed by acting on it: the sorting corrections, a reply.

### US-96 — Filter a board on any attribute
**As** a member, **I want** a board to filter on the organisation's attributes, **so that** a board is "Sales, to handle" or "Assigned to me".

- The board form has one line of values per attribute; within a line any ticked value matches, and a line with nothing ticked keeps every email.
