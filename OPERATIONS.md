# Operations inventory

What saras does, as **state variables** and the **operations** that change them, read from the code as it stands (`src/app.ts`, `src/sync.ts`, `src/main.ts`, `web/app.ts`). Vocabulary: an operation has a domain pair (**DomPre → DomPost**, what it *is*) and required clauses (**ReqPre** guards, **ReqPost** further guarantees, **ReqTrig** what obliges it to run), each of which exists because of a rule.

This is the shallow, complete pass: every operation is named with its domain pair, and its required clauses are sketched. The clause-by-clause tables (with the place of each clause in the code) are written area by area, when that area is refactored.

Nothing here changes behaviour. Where the code does not do what its own comments, the documentation or the interface say, it is listed under [Deviations](#deviations-and-open-questions) and left as it is.

## Agents

| Agent | Kind | Role |
| --- | --- | --- |
| Visitor | human | Someone not signed in: creates an organisation, signs in, accepts an invitation. |
| Member | human | Answers email: reads, writes, asks the AI, sends or files; connects and manages their own mailboxes; sets their own settings. |
| Administrator | human | A member who also invites and removes members, connects shared mailboxes, maintains the prompts, sets how the organisation works. |
| Operator | human | Hosts the installation: environment variables, brand folder. Acts outside the running system. |
| Backend | software | The saras server. Performs every operation below on behalf of a human, and some on its own (timers). |
| Frontend | software | The browser interface. Controls what is being written before it is submitted, and the language in use. |
| Mail provider | software | IMAP / SMTP server, Gmail, Microsoft Graph. Controls the mailbox itself. |
| Identity provider | software | Google, Microsoft: grants access to a mailbox by sign-in. |
| LLM | software | OpenRouter. Returns sorting decisions and proposed texts. |

## State variables

Essential state only: what another agent can observe.

| Variable | Meaning | Controlled by | Monitored by | Concrete copies |
| --- | --- | --- | --- | --- |
| Organisation | A team's private space: its name. | Backend | Members | `organizations.name` |
| Way of working | Who sorts fetched email (`none`, `ai`), whether automated mail is set aside first, whether proposals are written on demand, at fetch, or at fetch and filed in the mailbox. | Backend | Members | `organizations.triage_strategy`, `.skip_automated`, `.automation`; `Me.organization` in the frontend |
| Organisation's AI | Its default model and its own key. | Backend | Administrators (key: presence only) | `organizations.model`, `.openrouter_key_enc` |
| Member | A person's account in one organisation: address, name, role, password. | Backend | Administrators, the member | `users.*`; `state.me` in the frontend |
| Member's settings | Language, signature, own model, own key. | Backend (language also Frontend) | The member | `users.language`, `.signature`, `.model`, `.openrouter_key_enc`; `localStorage` (language) |
| Session | That a browser is signed in as a member, until when. | Backend | Frontend | `sessions`; the `sid` cookie |
| Attempt count | Wrong guesses of a password or an invitation token from one origin, in the last fifteen minutes. | Backend | Visitors (as a refusal) | in memory (`failures`) |
| Invitation | A pending right to join an organisation with a role, until a date. | Backend | Administrators, the invited person | `invitations` (the token as a hash only) |
| Mailbox | A connected address: kind, personal or shared, who manages it, its credentials. | Backend | Members who may use it | `accounts.*` (credentials sealed) |
| Watched folder | The one folder of a mailbox that is fetched. | Backend | Members who may use it | `accounts.folder`, `.folder_name` |
| Fetch state | When a mailbox was last fetched and what went wrong. | Backend | Members who may use it | `accounts.last_sync_at`, `.last_error` |
| Email | A received message as saras keeps it: who, what, when; erased past retention. | Backend | Members who may use its mailbox | `emails.*` |
| Email status | Where the email stands: waiting to be sorted, to handle, no reply needed, ignored, replied. | Backend | Members | `emails.status` |
| Triage verdict | Who sorted the email, why, its priority, the prompt suggested for it. | Backend | Members | `emails.triage_source`, `.triage_reason`, `.priority`, `.suggested_prompt_id` |
| Proposal | A text the AI wrote for an email: by which help, prompt and model. | Backend | Members | `drafts` |
| Reply in progress | What a member has written or changed in the reply area, its recipients, the reason for an edit. | Frontend | The member | the editor and fields of the composer (lost on leaving the page) |
| Reply | What was handed to the mailbox for an email: sent or filed as a draft, to whom, by whom, whether the proposal was edited and why. | Backend | Members | `replies` |
| Prompt | A way of replying: name, when to use it, instructions. | Backend | Administrators (members: name and description) | `prompts` |
| Mailbox contents | The messages, drafts and flags at the provider. | Mail provider | Backend, the member in their mail client | outside saras |

Accidental state, left out: fetches in flight (`running`), deliveries in flight (`sending`), the OAuth round-trip token (`sessions.oauth_state`), box counts cached in the frontend.

## Derived notions

| Notion | Definition | Where it lives today |
| --- | --- | --- |
| May use a mailbox | It is in the member's organisation, and is theirs or shared. | SQL fragment `canUse` in `app.ts` |
| May manage a mailbox | Shared: the member is an administrator. Personal: it is theirs. | `canManage` in `app.ts` |
| Box | To handle = `needs_reply` or `pending`; No reply needed = `no_reply`; Replied = `sent`; Ignored = `ignored`. | `BOXES` in `app.ts`, and again in `web/app.ts` |
| Sign-up is open | The operator allows it, or no account exists yet. | `publicInfo` in `app.ts` |
| Key in force | The member's own, else the organisation's, else the server's. Same order for the model. | `llm/settings.ts` |
| Locked out | Ten wrong guesses from one origin within fifteen minutes. | `guarded` in `app.ts` |
| Proposal was edited | The final text differs from the proposed one, whitespace aside. | `wasEdited` in `reply.ts`; a second version in `web/app.ts` (`norm`) |
| Passage to complete | A passage in square brackets of 2 to 80 characters. | `TO_COMPLETE` in `web/app.ts` only |
| Way of working | The four named combinations of sorting and proposals. | `WAYS` in `web/app.ts` only |
| Automated mail | Mailing-list headers, `no-reply` senders, bulk precedence. | `triage/rules.ts` |

## Operations

Named after what they bring about. "Entry" gives the button, the route and the code today.

### Access

| Operation | Agent | DomPre → DomPost | ReqPre (guards) | ReqPost (also guaranteed) | Entry |
| --- | --- | --- | --- | --- | --- |
| **CreateOrganization** | Visitor | No member has this address → an organisation exists with this person as its administrator | Sign-up is open · address valid · password of 10+ characters · not locked out | One default prompt in their language · named after the address's domain when no name is given · a session is opened | "Create my account" · `POST /auth/signup` |
| **SignIn** | Visitor | No session → a session for this member | Address and password match · not locked out | A wrong guess counts towards the lock-out, without saying which of the two was wrong | "Sign in" · `POST /auth/login` |
| **SignOut** | Member | A session → none | | The cookie is cleared | sign-out button · `POST /auth/logout` |
| **InviteMember** | Administrator | Any → a pending invitation for this address, with a role and an expiry | Administrator · address valid · no member has this address | The link is returned once and only its hash kept · an earlier invitation to the same address is replaced | "Create the invitation link" · `POST /invitations` |
| **RevokeInvitation** | Administrator | A pending invitation → none | Administrator · of their organisation | | "Revoke" · `DELETE /invitations/:id` |
| **AcceptInvitation** | Visitor | A pending, unexpired invitation → a member with its role; the invitation is gone | Password of 10+ characters · address not taken meanwhile · not locked out | A session is opened | "Create my account" on the invitation page · `POST /invitations/accept` |
| **AppointAdministrator** | Administrator | A member with role user → administrator | Administrator · same organisation | | "Make administrator" · `PUT /users/:id` |
| **RemoveAdministratorRole** | Administrator | An administrator → user | Administrator · not the last administrator | | "Remove the administrator role" · `PUT /users/:id` |
| **DeleteMember** | Administrator | A member → none | Administrator · not oneself | Their prompts and shared mailboxes pass to whoever deletes them · their personal mailboxes go, with what was stored from them | red bin in Users · `DELETE /users/:id` |
| **ExpireSessions** | Backend | Sessions past their date → none | | | ReqTrig: hourly, and at start · `housekeeping` in `main.ts` |

### Settings

`PUT /settings` and `PUT /organization` each carry several operations: one per field sent.

| Operation | Agent | DomPre → DomPost | ReqPre | ReqPost | Entry |
| --- | --- | --- | --- | --- | --- |
| **SetOwnName** | Member | → the member's name | | | Settings → You · `PUT /settings` |
| **SetSignature** | Member | → the member's signature | | | same |
| **ChooseOwnModel** | Member | → the member's model, or none (the organisation's applies) | Looks like `provider/model` | | same |
| **SetOwnKey** / **RemoveOwnKey** | Member | → the member has a key / has none | | Stored sealed | same |
| **ChooseLanguage** | Member, Frontend | → the language in use | A tag we recognise, else English | | language picker; also sent by the frontend at start when it differs · `PUT /settings` |
| **RenameOrganization** | Administrator | → the organisation's name | Administrator · not empty | | Settings → Organisation · `PUT /organization` |
| **ChooseSorting** | Administrator | → `none` or `ai` | Administrator · a known strategy | | same; "Choose how it works" in the tour |
| **SetAsideAutomatedFirst** | Administrator | → on or off | Administrator | | same |
| **ChooseProposals** | Administrator | → on demand, at fetch, or at fetch and filed | Administrator · a known value | | same; the tour |
| **SetOrganizationModel** | Administrator | → the default model, or none (the server's applies) | Administrator · looks like `provider/model` | | same |
| **SetOrganizationKey** / **RemoveOrganizationKey** | Administrator | → the organisation has a key / has none | Administrator | Stored sealed | same; the key step of the tour |
| **SortAgainUnsorted** | Administrator | Emails to handle that no strategy sorted and that have no proposal → waiting to be sorted | Administrator | | the tour only · `PUT /organization` with `resort: true` |

### Mailboxes

| Operation | Agent | DomPre → DomPost | ReqPre | ReqPost | Entry |
| --- | --- | --- | --- | --- | --- |
| **ConnectMailbox** | Member | This address (of this kind) is not connected in the organisation → a mailbox, personal or shared, with no watched folder | Address valid · servers, ports and password given, and the connection verified (IMAP) · or access granted at the identity provider, with a refresh token (Google, Microsoft) | Shared only when asked by an administrator, personal otherwise · credentials sealed · nothing is fetched yet | "Test and connect" · `POST /accounts/imap`; "Continue at …" · `GET /oauth/:kind/start` then `/callback` |
| **RenewMailboxCredentials** | Member | A mailbox they may manage → the same mailbox with new credentials | May manage it (else refused as already connected) | Its last error is cleared · over OAuth, fetching resumes if it has a folder | the same two entries, on an address already connected |
| **ChooseWatchedFolder** | Member | A mailbox → it watches this folder | May manage it · the folder exists at the provider | Its last error is cleared · a fetch is started | "Watch this folder" · `PUT /accounts/:id/folder` |
| **DisconnectMailbox** | Member | A mailbox → none | May manage it | Its emails, proposals and replies go with it · the mailbox at the provider is untouched | red bin in Mailboxes · `DELETE /accounts/:id` |
| **FetchMailbox** | Member, Backend | A mailbox with a watched folder → the folder's new messages of the last days are stored as emails, each waiting to be sorted | May use it · at most a set number per fetch · a message already known is left as it is | When asked for, plainly automated mail is set aside at once, by rule · then **SortWaitingEmails**, then **PrepareProposals** · the time and any failure are recorded | "Fetch", "Fetch now" · `POST /accounts/:id/sync`. ReqTrig: every `SYNC_INTERVAL_MINUTES`, for every mailbox with a folder; after ChooseWatchedFolder; after renewing over OAuth |

### Sorting

| Operation | Agent | DomPre → DomPost | ReqPre | ReqPost | Entry |
| --- | --- | --- | --- | --- | --- |
| **SortWaitingEmails** | Backend | Emails waiting to be sorted → to handle, or no reply needed, with who decided, why, a priority and a suggested prompt | The organisation's strategy can decide (for `ai`: a key in force, as the mailbox's owner) | An email the strategy says nothing about stays waiting · if it fails, all stay waiting and the failure is recorded on the mailbox | part of FetchMailbox · `triagePending` in `sync.ts` |
| **MarkNoReplyNeeded** | Member | An email not replied → no reply needed | May use its mailbox | The verdict becomes the member's | "No reply needed" · `POST /emails/:id/status` |
| **IgnoreEmail** | Member | An email not replied → ignored | same | same | "Ignore" · same route |
| **MoveBackToHandle** | Member | An email not replied → to handle | same | same | "Move back to 'To handle'" · same route |

### Replying

| Operation | Agent | DomPre → DomPost | ReqPre | ReqPost | Entry |
| --- | --- | --- | --- | --- | --- |
| **CheckTypos** | Member | A text in the reply area → a proposal: the same text, corrected | May use the mailbox · something is written · a key in force · the model has a zero-retention provider | The received email is not sent to the LLM · only what a reply may contain is kept of the answer | "Check typos" · `POST /emails/:id/assist` |
| **ImproveStyle** | Member | A text in the reply area → a proposal: the same text, reworded | same | same | "Improve style" · same route |
| **WriteWithPrompt** | Member | An email whose content is kept → a proposal written with a prompt, from the email and from what the member wrote | May use the mailbox · the prompt is the organisation's · a key in force · zero-retention provider | In the language of the email · ends with the member's signature · takes their past corrections on this prompt into account · only what a reply may contain is kept | "Write with" · same route |
| **PrepareProposals** | Backend | Emails to handle with content and no proposal → each has one | The organisation asked for it · a key in force as the mailbox's owner · it has a prompt | With the prompt suggested at triage, else the organisation's first · at most ten per fetch, most recent first | part of FetchMailbox · `prepareProposals` in `sync.ts` |
| **FileProposalAsDraft** | Backend | A proposal just prepared → a draft in the mailbox; the email is replied, as a draft, by the mailbox's owner | The organisation asked for it · the email has someone to reply to | Recorded as not edited | part of PrepareProposals |
| **PutMyTextBack** | Member (Frontend) | A proposal shown, with the text it replaced → that text again | | | "Put my text back"; frontend only |
| **SendReply** | Member | An email not replied, with none of its replies in flight → replied: the reply is sent from the mailbox | May use the mailbox · the reply is not empty · at least one recipient · every address valid · the member confirmed (frontend) | Quoted and threaded on the original, HTML with a text alternative · flagged answered over IMAP · whether the proposal was edited, and the reason only if it was, are recorded with who replied | "Send", then the confirmation · `POST /emails/:id/send` |
| **FileReplyAsDraft** | Member | The same → replied, as a draft: the reply is in the mailbox's Drafts folder | The same, without the confirmation | Nothing is sent · the same record | "Save as draft" · `POST /emails/:id/save-draft` |

### Prompts

| Operation | Agent | DomPre → DomPost | ReqPre | ReqPost | Entry |
| --- | --- | --- | --- | --- | --- |
| **CreatePrompt** | Administrator | → a prompt of the organisation | Administrator · a name and instructions | | "Create the prompt" · `POST /prompts` |
| **AddReadyMadePrompt** | Administrator | A template the organisation does not have → a prompt with its content | same | | "Add" · `GET /prompts/templates` then `POST /prompts` |
| **EditPrompt** | Administrator | A prompt → with a new name, description, instructions | same · of their organisation | | "Save" · `PUT /prompts/:id` |
| **DeletePrompt** | Administrator | A prompt → none | Administrator · of their organisation | Emails, proposals and replies that named it keep going without it | red bin · `DELETE /prompts/:id` |

### Retention

| Operation | Agent | DomPre → DomPost | ReqTrig | Entry |
| --- | --- | --- | --- | --- |
| **ErasePastRetention** | Backend | Emails older than the retention period, with content → their content, proposals and reply texts are erased; the triage row and the reasons for corrections are kept | Hourly, and at start, when a retention period is set | `purgeOldContent` in `db.ts` |

### Observations

Routes that only read state: `GET /public`, `/me`, `/accounts`, `/accounts/:id/folders` (asks the provider), `/mail/host` (asks the DNS), `/prompts`, `/prompts/templates`, `/prompts/:id/corrections`, `/users`, `/invitations`, `/emails`, `/emails/:id`, and `POST /invitations/check`. None changes state.

### Chains

Sequences of operations that the interface or the server runs as one story.

| Chain | Operations |
| --- | --- |
| A fetch | FetchMailbox → SortWaitingEmails → PrepareProposals (→ FileProposalAsDraft) |
| Getting started | CreateOrganization → ConnectMailbox → ChooseWatchedFolder → FetchMailbox → (SetOrganizationKey) → EditPrompt, AddReadyMadePrompt → ChooseSorting + ChooseProposals + SortAgainUnsorted → FetchMailbox |
| Answering | (WriteWithPrompt \| CheckTypos \| ImproveStyle)* → SendReply \| FileReplyAsDraft |

## Computations

Pure today, and where they are.

| Function | Input → output | Where |
| --- | --- | --- |
| `replyRecipients`, `replySubject`, `replyReferences`, `composeReplyBody` | An email, an address → who to reply to, the subject, the threading headers, the quoted body | `reply.ts` |
| `wasEdited` | Proposed text, final text → whether it changed | `reply.ts` |
| `heuristicTriage` | An email → set aside, with a reason, or nothing | `triage/rules.ts` |
| `runGate` and the reading of the AI's answer | Decisions as text → decisions we trust | `triage/gate.ts`, `triage/ai.ts` |
| `buildPromptMessages`, `buildTyposMessages`, `buildStyleMessages` | An email, a prompt, a text → what is sent to the LLM | `llm/prompts.ts` |
| `buildChatRequest`, `explainError` | → the request with its privacy clause; an error as a problem | `llm/openrouter.ts` |
| `llmSettings` | Member, organisation, configuration → the key and model in force | `llm/settings.ts` |
| `sanitizeHtml`, `stripCodeFence`, `textToHtml`, `htmlToText` | Text transformations | `html.ts`, `text.ts` |
| `classifyMx`, `domainOf` | MX names → who hosts the mail | `mail/lookup.ts` |
| `gmailToEmail`, `graphToEmail`, `rowToEmail` | A provider's message, a row → an email | `mail/*.ts`, `sync.ts` |
| `serversFor` | An address → servers to propose | `web/mail-presets.ts` |

Buried in handlers, to bring out as named pure functions:

| Decision | Buried in |
| --- | --- |
| May use / may manage a mailbox | `canUse` (SQL text), `canManage`, `wantsShared` in `app.ts` |
| Which box an email is in | `BOXES` in `app.ts` and in `web/app.ts` |
| Is sign-up open; is this origin locked out | `publicInfo`, `guarded` in `app.ts` |
| May this password, address, model identifier, role, status be accepted | inline in ten handlers of `app.ts` |
| May the last administrator be demoted; may one delete oneself | `PUT` and `DELETE /users/:id` |
| What a delivery records: edited or not, the reason kept or dropped | `deliver` in `app.ts` |
| Which prompt a prepared proposal uses; which emails are prepared | `prepareProposals` in `sync.ts` |
| Which emails a fetch stores, and with which first status | `store` in `sync.ts` |
| The four ways of working; which one an organisation is in | `WAYS`, `wayOf` in `web/app.ts` |
| Passages to complete; whether the member edited the proposal | `TO_COMPLETE`, `norm` in `web/app.ts` |
| Where the tour goes next | `pathOf`, `leave` in `web/app.ts` |

## Deviations and open questions

Recorded, not fixed. Each is a decision for the product's owner.

### Deviations

1. **The lock-out is per origin, not per address.** The comment in `app.ts` and US-02 say "per address"; the code counts by IP address (`req.ip`). Behind a proxy that does not forward the client's address, everyone shares one count. The table of counts is never emptied.
2. **Expired invitations are not forgotten.** The comment on the hourly housekeeping says "forget expired sessions and invitations"; only sessions are deleted. Expired invitations stay listed until revoked.
3. **An address can be connected twice in one organisation.** The rule stated in the code ("an address is connected once per organisation") is enforced per kind: the same address can be connected over IMAP and again by Google or Microsoft sign-in, and its emails would then be fetched twice.
4. **Asking for a shared mailbox without being an administrator is not refused**: a personal one is connected instead, silently.
5. **The three triage corrections do not check where the email stands.** `POST /emails/:id/status` accepts any of the three statuses on any email not replied: an email to handle can be "moved back to handle", which only relabels its verdict as the member's. The interface never offers it.
6. **AI help is not refused on an email already replied.** `POST /emails/:id/assist` has no guard on the status. The interface offers no reply area there.
7. **"Explicit validation" before sending lives in the frontend only.** The guarantee is a confirmation dialog; the API sends on one call. This is by nature for a human confirmation, but it means the guarantee is a property of the interface, not of the server.
8. **A ready-made prompt can be added more than once through the API.** "Can be added once" holds because the list of templates hides those already present by name; `POST /prompts` does not check.
9. **A sole administrator can never leave.** The last administrator cannot be given the user role, nobody can delete their own account, and no operation deletes an organisation. Possibly intended.
10. **A proposal prepared at fetch for an email with nobody to reply to is not filed**, and the email stays to handle with its proposal, without any sign of why (`prepareProposals`, mode `mailbox`).
11. **Two definitions of "the member edited the proposal"**: the frontend's (`norm`: whitespace collapsed) decides whether the reason is asked; the backend's (`wasEdited`) decides whether it is kept. They can disagree.
12. **Fetching is done as the mailbox's owner**, including for a shared mailbox: their key, model and language sort it, and their signature and corrections write the prepared proposals, whoever reads them.

### Open questions

1. Is **RenewMailboxCredentials** an operation in its own right, or should connecting an address already connected be refused and renewal offered on the mailbox?
2. Should **SortAgainUnsorted** stay a flag on `PUT /organization`, or become an operation with its own entry?
3. **ChooseSorting** and **ChooseProposals** are two operations today; the interface presents four *ways of working*. Is the way of working the real state variable, with one operation **ChooseWayOfWorking**?
4. Is the **reply in progress** meant to be lost when the member leaves the page, or should it be state the backend keeps?
5. `POST /invitations/check` is counted as an observation, yet a wrong token counts towards the lock-out. Is checking a token an operation (**CheckInvitation**) for that reason?
6. No route lets a member change their password or delete their own account. Missing operations, or out of scope?
