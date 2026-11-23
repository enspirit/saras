# Operations inventory

What saras does, as **state variables** and the **operations** that change them. Vocabulary: an operation has a domain pair (**DomPre → DomPost**, what it *is*) and required clauses (**ReqPre** guards, **ReqPost** further guarantees, **ReqTrig** what obliges it to run), each of which exists because of a rule.

The code is laid out the same way. Every operation below is one file, named after it and headed by its clauses:

| Where | What |
| --- | --- |
| `src/domain/<area>/<operation>.ts` | One operation: it fetches what it needs, decides with pure functions, then changes the state. |
| `src/domain/computations/` | The decisions and transformations, pure: no database, no network, no clock of their own. Unit-tested in `test/computations.test.ts`, `test/replying.test.ts` and the tests named after each subject (`reply-composition`, `automated-mail`, `sorting-gate`, `privacy`…). |
| `src/domain/state/` | Reading and writing the state variables. |
| `src/domain/observations/` | What members read: the queries behind the read-only routes, returning the shared types. |
| `src/domain/model/` | The state as it is kept: rows, credentials, what a mail provider knows how to do. |
| `shared/` | The domain objects as members see them, declared once for the server and the browser. |
| `src/domain/refusal.ts`, `world.ts` | A refusal and its kind (invalid, forbidden, not found, conflict…); what an operation acts in (`World`) and on behalf of whom (`Actor`). |
| `src/tooling/` | What is not the domain: HTTP (`http/server.ts`, and one file of routes per area: each route calls one operation or one observation), database driver and schema, mail protocols, the LLM client, sealing, configuration, messages. |
| `src/main.ts` | Wiring, and the server's own clock. |

The domain knows nothing of HTTP: an operation refuses with a kind, and `tooling/http/refusals.ts` turns the kind into a status.

Where the code does not do what its own comments, the documentation or the interface say, it is listed under [Deviations](#deviations-and-open-questions) and left as it is.

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
| Sorting | Who says whether a fetched email needs a reply: nobody (`none`: all are to handle) or the AI (`ai`). | Backend | Members | `organizations.triage_strategy`; `Organization.sorting` in `shared/` |
| Writing | When a proposal is written for an email to handle: on demand (`none`), at fetch (`draft`), at fetch and filed in the mailbox's drafts (`mailbox`). | Backend | Members | `organizations.automation`; `Organization.writing` in `shared/` |
| Automated mail first | Whether plainly automated mail is set aside by rule before anything else. | Backend | Members | `organizations.skip_automated` |
| Organisation's AI | Its default model and its own key. | Backend | Administrators (key: presence only) | `organizations.model`, `.openrouter_key_enc` |
| Member | A person's account in one organisation: address, name, role, password. | Backend | Administrators, the member | `users.*`; `session.me` in the frontend |
| Member's settings | Language, signature, own model, own key. | Backend (language also Frontend) | The member | `users.language`, `.signature`, `.model`, `.openrouter_key_enc`; `localStorage` (language) |
| Second factor | The secret a member's authenticator app shares with the server, the last code step accepted, and their recovery codes. | Backend | The member (at set-up only) | `users.totp_secret_enc` (sealed), `.totp_last_step`, `.recovery_codes_json` (hashes) |
| Sign-in in progress | That a password was accepted and a second factor is awaited, for ten minutes. | Backend | Frontend | `sign_ins_in_progress`; the `signin` cookie |
| Password reset | A pending right to choose a new password, for an hour. | Backend | Whoever holds the link | `password_resets` (the token as a hash only) |
| Session | That a browser is signed in as a member, until when. | Backend | Frontend | `sessions`; the `sid` cookie |
| Attempt count | Wrong guesses of a password or an invitation token from one origin, in the last fifteen minutes. | Backend | Visitors (as a refusal) | in memory (`World.attempts`) |
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
| Board | A named view of emails: a filter on their attributes and on their facts (mailbox, how recent, sender, keywords, attachments), personal or shared. | Backend | Its owner; every member when shared | `boards` (the filter as JSON); `shared/board.ts` |
| Attribute | Something the organisation wants to know of each email: a choice among values, or a member. Two are pre-configured, with fixed values: "Stands in" and "Priority". Each says who decides it: nobody, a rule written in Elo, the AI, or the rule then the AI. | Backend | Members; administrators change them | `attributes`; for "Stands in", `organizations.skip_automated` and `.triage_strategy`; `shared/attribute.ts` |
| Value of an email for an attribute | The value, and who decided it: a rule, the AI, a member by hand. | Backend | Members who may use its mailbox | `emails.status`, `.priority`, `.attributes_json` |
| Mailbox contents | The messages, drafts and flags at the provider. | Mail provider | Backend, the member in their mail client | outside saras |

Accidental state, left out: fetches in flight (`running` in `fetch-mailbox.ts`), replies on their way to the mailbox (`World.handingOver`), the sign-in under way at a mail host (`sessions.oauth_state`), box counts cached in the frontend.

## Derived notions

| Notion | Definition | Where it lives |
| --- | --- | --- |
| May use a mailbox | It is in the member's organisation, and is theirs or shared. | `mayUse` (a SQL condition), `mailboxFor`, `emailFor` in `state/` |
| Manages a mailbox | Shared: the member is an administrator. Personal: it is theirs. | `manages` in `computations/mailboxes.ts` |
| Box | To handle = `needs_reply` or `pending`; No reply needed = `no_reply`; Replied = `sent`; Ignored = `ignored`. | `BOXES` in `shared/email.ts`; `computations/boxes.ts` counts by it |
| Sign-up is open | The operator allows it, or no account exists yet. | `signUpIsOpen` in `computations/access.ts` |
| Key in force | The member's own, else the organisation's, else the server's. Same order for the model. | `computations/key-in-force.ts` |
| Locked out | Ten wrong guesses from one origin within fifteen minutes. | `isLockedOut` in `computations/access.ts` |
| Proposal was edited | The final text differs from the proposed one, whitespace aside. | `wasEdited` in `computations/reply.ts`; a second version in `web/pages/reply-in-progress.ts` (`norm`) |
| Passage to complete | A passage in square brackets of 2 to 80 characters. | `TO_COMPLETE` in `web/pages/reply-in-progress.ts` only |
| Automated mail | Mailing-list headers, `no-reply` senders, bulk precedence. | `sorting/rules.ts` |

## Operations

Named after what they bring about. "Entry" gives the button and the route; the code is the file of the same name in `src/domain/<area>/`, where the clauses are written in full.

### Access

| Operation | Agent | DomPre → DomPost | ReqPre (guards) | ReqPost (also guaranteed) | Entry |
| --- | --- | --- | --- | --- | --- |
| **CreateOrganization** | Visitor | No member has this address → an organisation exists with this person as its administrator | Sign-up is open · address valid · password of 10+ characters · not locked out | One default prompt in their language · named after the address's domain when no name is given · a session is opened | "Create my account" · `POST /auth/signup` |
| **SignIn** | Visitor | No session → a session for this member | Address and password match · not locked out | A wrong guess counts towards the lock-out, without saying which of the two was wrong | "Sign in" · `POST /auth/login` |
| **SignOut** | Member | A session → none | | The cookie is cleared | sign-out button · `POST /auth/logout` |
| **InviteMember** | Administrator | Any → a pending invitation for this address, with a role and an expiry | Administrator · address valid · no member has this address | The link is returned once and only its hash kept · an earlier invitation to the same address is replaced | "Create the invitation link" · `POST /invitations` |
| **RevokeInvitation** | Administrator | A pending invitation → none | Administrator · of their organisation | | "Revoke" · `DELETE /invitations/:id` |
| **CheckInvitation** | Visitor | Any → the same; the attempt count of this origin may have grown | Not locked out · the link opens a pending, unexpired invitation | Tells the address and the organisation · a link that opens nothing counts as a wrong guess | opening an invitation link · `POST /invitations/check` |
| **AcceptInvitation** | Visitor | A pending, unexpired invitation → a member with its role; the invitation is gone | Password of 10+ characters · address not taken meanwhile · not locked out | A session is opened | "Create my account" on the invitation page · `POST /invitations/accept` |
| **AppointAdministrator** | Administrator | A member with role user → administrator | Administrator · same organisation | | "Make administrator" · `PUT /members/:id` |
| **RemoveAdministratorRole** | Administrator | An administrator → user | Administrator · not the last administrator | | "Remove the administrator role" · `PUT /members/:id` |
| **DeleteMember** | Administrator | A member → none | Administrator · not oneself (that is DeleteOwnAccount) | Their prompts, shared mailboxes and shared boards pass to whoever deletes them · their personal mailboxes go, with what was stored from them | red bin in Users · `DELETE /members/:id` |
| **ChangePassword** | Member | → the member's password is the new one; their other sessions are closed | The current password is given · the new one has 10+ characters · not locked out | A wrong current password counts as a wrong guess · the session that made the change stays | Settings → You → "Change password" · `PUT /auth/password` |
| **GiveSecondFactor** | Visitor | A sign-in in progress → a session for the member; the first time, the member has a second factor and recovery codes | Where the installation requires one (`MFA_ENABLED`) · the sign-in has not run out (ten minutes) · the code is the one of the moment, not used before — or a recovery code, then spent · not locked out | No session is opened on a password alone · a wrong code counts as a wrong guess · recovery codes are told once, kept as hashes · the secret is kept sealed | the code page after "Sign in", "Create my account" · `POST /auth/second-factor` |
| **ResetSecondFactor** | Administrator | A member → the same, without second factor or recovery codes; their sessions are closed | Administrator · same organisation | They set a new one up at their next sign-in | shield button in Users · `DELETE /members/:id/second-factor` |
| **RequestPasswordReset** | Visitor | → if the address is a member's, a link to a new password exists for them and was sent to that address | The server has mail of its own (`SMTP_URL`, `MAIL_FROM`) | Same answer whether the address is a member's or not · the link is good once, for an hour, kept as a hash · asking again within two minutes sends nothing | "Forgot your password?" · `POST /auth/password-reset` |
| **CreatePasswordResetLink** | Administrator | A member → a link to a new password exists for them | Administrator · same organisation | Told once, good once, for an hour | key button in Users · `POST /members/:id/password-reset` |
| **ResetPassword** | Visitor | A live link → the member's password is the new one; the link is spent; all their sessions are closed | The link is live · 10+ characters · not locked out | Nobody is signed in by it: the second factor is still asked · a link that opens nothing counts as a wrong guess | the page a link opens · `POST /auth/password-reset/check`, `PUT /auth/password-reset` |
| **DeleteOwnAccount** | Member | A member → none, with their sessions | The current password is given · not the organisation's last administrator · not locked out | Their prompts, shared mailboxes and shared boards pass to the longest-standing other administrator · their personal mailboxes go, with what was stored from them · a wrong password counts as a wrong guess | Settings → You → "Delete my account", then the confirmation · `DELETE /me` |
| **DeleteOrganization** | Administrator | An organisation → none, with its members, sessions, invitations, prompts, mailboxes and everything kept from them | Administrator · the current password is given · the organisation's name is given, as it is · not locked out | The mailboxes at the providers are untouched · the other members are not told · a wrong password counts as a wrong guess | Settings → Organisation → "Delete the organisation", then the confirmation · `DELETE /organization` |
| **ExpireSessions** | Backend | Sessions past their date → none | | | ReqTrig: hourly, and at start (`main.ts`) |

### Settings

`PUT /settings` and `PUT /organization` each carry several operations, one per field sent, applied in a fixed order.

| Operation | Agent | DomPre → DomPost | ReqPre | ReqPost | Entry |
| --- | --- | --- | --- | --- | --- |
| **SetOwnName** | Member | → the member's name | | | Settings → You · `PUT /settings` |
| **ChooseLanguage** | Member, Frontend | → the language in use | A tag we recognise, else English | | language picker; also sent by the frontend at start when it differs · `PUT /settings` |
| **ChooseOwnModel** | Member | → the member's model, or none (the organisation's applies) | Looks like `provider/model` | | Settings → You · `PUT /settings` |
| **SetSignature** | Member | → the member's signature | | | same |
| **SetOwnKey** / **RemoveOwnKey** | Member | → the member has a key / has none | | Stored sealed | same |
| **RenameOrganization** | Administrator | → the organisation's name | Administrator | An empty name changes nothing | Settings → Organisation · `PUT /organization` |
| **ChooseSorting** | Administrator | → fetched emails are sorted by nobody, or by the AI, from the next fetch on | Administrator · `none` or `ai` | What was fetched before stays as it was sorted | Settings → Organisation; step 1 of "Sorting and writing" in the tour · `PUT /organization` |
| **ChooseWriting** | Administrator | → proposals are written on demand, at fetch, or at fetch and filed in the mailbox's drafts | Administrator · one of those three | Nothing sends by itself | same; step 2 of "Sorting and writing" |
| **SetAsideAutomatedFirst** | Administrator | → the rule of "Stands in" is applied, or not | Administrator | | Settings → Organisation · `PUT /organization`; the same as choosing who decides "Stands in" |
| **SetOrganizationModel** | Administrator | → the default model, or none (the server's applies) | Administrator · looks like `provider/model` | | same |
| **SetOrganizationKey** / **RemoveOrganizationKey** | Administrator | → the organisation has a key / has none | Administrator | Stored sealed | same; the key step of the tour |

### Mailboxes

| Operation | Agent | DomPre → DomPost | ReqPre | ReqPost | Entry |
| --- | --- | --- | --- | --- | --- |
| **ConnectMailbox** | Member | This address (of this kind) is not connected in the organisation → a mailbox, personal or shared, with no watched folder | Credentials just seen to work, by one of the two ways below | Shared only when asked by an administrator, personal otherwise · credentials sealed · nothing is fetched yet | the common end of the two below (`connect-mailbox.ts`) |
| — **ByServers** | Member | as above | Address valid · both servers, their ports and a password given · the incoming server lets us in | | "Test and connect" · `POST /mailboxes/imap` |
| — **ByHostSignIn** | Member | as above; the session no longer remembers a sign-in under way | The server is set up for that host · the host reported no refusal · the answer is to the sign-in this session began · the host grants lasting access | | "Continue at …" · `GET /oauth/:kind/start` (BeginHostSignIn), then `/callback` |
| **RenewMailboxCredentials** | Member | A mailbox → the same, with new credentials; its last error is forgotten | Manages it · the new credentials were just seen to work, for that very mailbox | Folder watched, emails kept and owner unchanged · credentials sealed · ReqTrig: a mailbox that watches a folder is fetched at once | key button in Mailboxes, then "Renew access" · `PUT /mailboxes/:id/password` (a mailbox reached by its servers) or `GET /oauth/:kind/start?renew=:id` (the others) |
| **ChooseWatchedFolder** | Member | A mailbox → it watches this folder | Manages it · the folder exists at the provider | Its last error is forgotten · what was fetched from another folder is kept · ReqTrig: a fetch is started | "Watch this folder" · `PUT /mailboxes/:id/folder` |
| **DisconnectMailbox** | Member | A mailbox → none | Manages it | Its emails, proposals and replies go with it · the mailbox at the provider is untouched | red bin in Mailboxes · `DELETE /mailboxes/:id` |
| **FetchMailbox** | Member, Backend | A mailbox with a watched folder → the folder's new messages of the last days are stored as emails, each waiting to be sorted | May use it (when a member asks) · at most a set number per fetch · a message already known is left as it is | When asked for, plainly automated mail is set aside at once, by rule · then **SortWaitingEmails**, then **PrepareProposals** · the time and any failure are recorded · one fetch at a time per mailbox | "Fetch", "Fetch now" · `POST /mailboxes/:id/fetch`. ReqTrig: every `SYNC_INTERVAL_MINUTES`, for every mailbox with a folder; after ChooseWatchedFolder; after RenewMailboxCredentials |

### Sorting

| Operation | Agent | DomPre → DomPost | ReqPre | ReqPost | Entry |
| --- | --- | --- | --- | --- | --- |
| **SortWaitingEmails** | Backend | Emails waiting to be sorted → to handle, or no reply needed, with who decided, why, a priority and a suggested prompt | The organisation's strategy can decide (for `ai`: a key in force, as the mailbox's owner) | An email the strategy says nothing about stays waiting · if it fails, all stay waiting and the failure is recorded on the mailbox | part of FetchMailbox (`sorting/sort-waiting-emails.ts`) |
| **MarkNoReplyNeeded** | Member | An email not replied → no reply needed | May use its mailbox | The verdict becomes the member's | "No reply needed" · `POST /emails/:id/status` |
| **IgnoreEmail** | Member | An email not replied → ignored | same | same | "Ignore" · same route |
| **MoveBackToHandle** | Member | An email not replied → to handle | same | same | "Move back to 'To handle'" · same route |
| **SortAgainUnsorted** | Administrator | Emails to handle that no strategy sorted and that have no proposal → waiting to be sorted | Administrator | The next fetch sorts them the organisation's way | end of the tour's "Choose how it works" · `POST /organization/sort-again` |

### Replying

| Operation | Agent | DomPre → DomPost | ReqPre | ReqPost | Entry |
| --- | --- | --- | --- | --- | --- |
| **CheckTypos** | Member | A text in the reply area → a proposal: the same text, corrected | May use the mailbox · something is written · a key in force · the model has a zero-retention provider | The received email is not sent to the LLM · only what a reply may contain is kept of the answer | "Check typos" · `POST /emails/:id/assist` |
| **ImproveStyle** | Member | A text in the reply area → a proposal: the same text, reworded | same | same | "Improve style" · same route |
| **WriteWithPrompt** | Member | An email whose content is kept → a proposal written with a prompt, from the email and from what the member wrote | May use the mailbox · the prompt is the organisation's · a key in force · zero-retention provider | In the language of the email · ends with the member's signature · takes their past corrections on this prompt into account · only what a reply may contain is kept | "Write with" · same route |
| **PrepareProposals** | Backend | Emails to handle with content and no proposal → each has one | The organisation's writing is `draft` or `mailbox` · a key in force as the mailbox's owner · it has a prompt | With the prompt suggested at triage, else the organisation's first · at most ten per fetch, most recent first | part of FetchMailbox (`replying/prepare-proposals.ts`) |
| **FileProposalAsDraft** | Backend | A proposal just prepared → a draft in the mailbox; the email is replied, as a draft, by the mailbox's owner | The organisation's writing is `mailbox` · the email has someone to reply to | Recorded as not edited | part of PrepareProposals |
| **PutMyTextBack** | Member (Frontend) | A proposal shown, with the text it replaced → that text again | | | "Put my text back"; frontend only |
| **SendReply** | Member | An email not replied, with none of its replies in flight → replied: the reply is sent from the mailbox | May use the mailbox · the reply is not empty · at least one recipient · every address valid · the member confirmed (frontend) | Quoted and threaded on the original, HTML with a text alternative · flagged answered over IMAP · whether the proposal was edited, and the reason only if it was, are recorded with who replied | "Send", then the confirmation · `POST /emails/:id/send` |
| **FileReplyAsDraft** | Member | The same → replied, as a draft: the reply is in the mailbox's Drafts folder | The same, without the confirmation | Nothing is sent · the same record | "Save as draft" · `POST /emails/:id/file-as-draft` |

### Prompts

| Operation | Agent | DomPre → DomPost | ReqPre | ReqPost | Entry |
| --- | --- | --- | --- | --- | --- |
| **CreatePrompt** | Administrator | → a prompt of the organisation | Administrator · a name and instructions | | "Create the prompt" · `POST /prompts` |
| **AddReadyMadePrompt** | Administrator | A template the organisation does not have → a prompt with its content | same | | "Add" · `GET /prompts/ready-made` then `POST /prompts` |
| **EditPrompt** | Administrator | A prompt → with a new name, description, instructions | same · of their organisation | | "Save" · `PUT /prompts/:id` |
| **DeletePrompt** | Administrator | A prompt → none | Administrator · of their organisation | Emails, proposals and replies that named it keep going without it | red bin · `DELETE /prompts/:id` |

### Attributes

| Operation | Agent | DomPre → DomPost | ReqPre | ReqPost | Entry |
| --- | --- | --- | --- | --- | --- |
| **CreateAttribute** | Administrator | → the organisation has one more attribute | Administrator · a name · two values for a choice · decided by a rule: it has one, which Elo can read · not left to the AI (not yet) | Emails fetched from then on get its value from its rule | Configuration → Attributes → "New attribute" · `POST /attributes` |
| **EditAttribute** | Administrator | An attribute → decided this way; one the organisation made also has this name and these values | Administrator · the same as above | Of the two pre-configured ones only how they are decided changes · "Stands in": that is the organisation's two sorting settings | pencil in Attributes · `PUT /attributes/:key` |
| **DeleteAttribute** | Administrator | An attribute the organisation made → none | Administrator · not pre-configured | | "Delete the attribute" · `DELETE /attributes/:key` |
| **SortByRules** | Backend | An email just fetched → it has, for each attribute whose rule speaks of it, that value, as the rule's | | A rule that says nothing, fails or runs too long leaves the attribute undecided · "Stands in" undecided, the email waits to be sorted · a rule cannot mark an email as replied | part of FetchMailbox (`sorting/sort-by-rules.ts`) |
| **SortAgainByRule** | Administrator | An attribute decided by a rule, the emails kept → each has for it what the rule says now | Administrator · decided by a rule Elo can read | A value set by hand stays · a value the rule had given goes where it no longer speaks · "Stands in": emails replied, placed by a member, or fetched before their headers were kept stay; one the rule no longer places waits to be sorted, and the mailboxes are fetched at once | "Save and apply to the emails already kept" on the attribute · `POST /attributes/:key/sort-again` |
| **SetEmailAttribute** | Member | An email → it has this value for the attribute, as the member's, or none | May use the email's mailbox · a value of the attribute · not "Stands in" | Not overwritten by later sorting | the selects above an email · `PUT /emails/:id/attributes/:key` |

Observations: `GET /attributes`; `POST /attributes/try` (what a rule would say of the member's twenty most recent emails, changing none). `POST /attributes/check` (what is wrong in a rule being written, each problem with its line, its column and the field probably meant: `computations/rule-problems.ts`). `GET /attributes/:key/skill` hands an AI agent what it needs to write the rule of that attribute (`computations/rule-writing-skill.ts`).

A rule is type-checked against the email it is given: `EMAIL_FOR_RULES` in `shared/attribute.ts` is that type, in Elo's own notation, read by the checker (`tooling/elo.ts`) and shown beside the editor.

The rule "Stands in" starts with is in `computations/default-rules.ts`: what used to be built-in header rules, now written in Elo and open to change.

### Boards

| Operation | Agent | DomPre → DomPost | ReqPre | ReqPost | Entry |
| --- | --- | --- | --- | --- | --- |
| **CreateBoard** | Member | → the member has one more board, with this name and filter | A name · only an administrator makes it shared | The filter is kept reduced to the attributes we know · a board shows each member only the emails of mailboxes they may use | "New board" in the menu · `POST /boards` |
| **EditBoard** | Member | A board → with this name, this filter, shared or not | Manages it (its owner; a shared one, an administrator) · a name · only an administrator shares | | pencil on the board · `PUT /boards/:id` |
| **DeleteBoard** | Member | A board → none | Manages it | The emails it showed are untouched | "Delete the board" in its form · `DELETE /boards/:id` |

Observations: `GET /boards` (the boards a member sees, each with how many emails it shows them), `GET /boards/:id/emails`.

### Retention

| Operation | Agent | DomPre → DomPost | ReqTrig | Entry |
| --- | --- | --- | --- | --- |
| **ErasePastRetention** | Backend | Emails older than the retention period, with content → their content, proposals and reply texts are erased; the triage row and the reasons for corrections are kept | Hourly, and at start, when a retention period is set | `retention/erase-past-retention.ts`, from `main.ts` |

### Observations

Routes that only read state: `GET /public`, `/me`, `/mailboxes`, `/mailboxes/:id/folders` (asks the provider), `/mail/host` (asks the DNS), `/prompts`, `/prompts/ready-made`, `/prompts/:id/corrections`, `/members`, `/invitations`, `/emails`, `/emails/:id`. None changes state. Their queries are in `src/domain/observations/`.

### Chains

Sequences of operations that the interface or the server runs as one story.

| Chain | Operations |
| --- | --- |
| A fetch | FetchMailbox → SortWaitingEmails → PrepareProposals (→ FileProposalAsDraft) |
| Getting started | CreateOrganization → ConnectMailbox → ChooseWatchedFolder → FetchMailbox → (SetOrganizationKey) → EditPrompt, AddReadyMadePrompt → ChooseSorting + ChooseWriting → SortAgainUnsorted → FetchMailbox |
| Answering | (WriteWithPrompt \| CheckTypos \| ImproveStyle)* → SendReply \| FileReplyAsDraft |

## Computations

Pure, in `src/domain/computations/` unless said otherwise.

| File | What it decides or transforms |
| --- | --- |
| `access.ts` | Is sign-up open; may this account be opened (address, password length); is the address free; the name of a new organisation; the role an invitation gives; may the last administrator be demoted; may one delete oneself; is this origin locked out. |
| `mailboxes.ts` | Who manages a mailbox; shared or personal; is the address already connected; what is given to connect by servers; the same servers with a new password; is it the very mailbox to renew; is the folder one of the mailbox's; what a session remembers of a sign-in at a host, and whether an answer is to it. |
| `settings.ts` | Is this a model identifier; a way of sorting; a way of writing. |
| `sorting.ts` | May an email be sorted again by a member. |
| `replying.ts` | The proposal as HTML; is something written; is the email's content kept; may the reply be handed over (recipients, text, status, none in flight); what a hand-over records (edited or not, the reason kept or dropped); which prompt a prepared proposal uses. |
| `reply.ts` | Who to reply to, the subject, the threading headers, the quoted body; whether the proposal was edited. |
| `prompts.ts` | What a prompt must contain. |
| `given.ts` | What a client gives, reduced: clipped text, addresses, a language tag. |
| `emails.ts` | A stored row as an email, and as the sorting gate is given it. |
| `key-in-force.ts` | Member, organisation, configuration → the key and model in force. |
| `llm-prompts.ts` | An email, a prompt, a text → what is sent to the LLM. |
| `sorting/gate.ts`, `ai.ts`, `rules.ts` | The AI's answer as decisions we trust; automated mail by its headers. |
| `tooling/llm/openrouter.ts` (`buildChatRequest`, `explainError`) | The request with its privacy clause; an error as a problem. |
| `tooling/html.ts`, `text.ts` | What a reply may contain; text ↔ HTML. |
| `tooling/mail/lookup.ts` (`classifyMx`, `domainOf`), `gmail.ts`, `graph.ts` | MX names → who hosts the mail; a provider's message → an email. |
| `web/mail-presets.ts` (`serversFor`) | An address → servers to propose. |

Still buried, in the frontend (`web/pages/`):

| Decision | Buried in |
| --- | --- |
| Passages to complete; whether the member edited the proposal | `TO_COMPLETE`, `norm` in `web/pages/reply-in-progress.ts` |
| Where the tour goes next | `pathOf`, `leaveStep` in `web/pages/getting-started/path.ts` |

## Deviations and open questions

Recorded, not fixed. Each is a decision for the product's owner.

### Deviations

1. **The lock-out is per origin, not per address.** US-02 says "per address"; the code counts by origin, the IP address (`req.ip`). Behind a proxy that does not forward the client's address, everyone shares one count. The table of counts is never emptied.
2. **Expired invitations are not forgotten.** The comment on the hourly housekeeping says "forget expired sessions and invitations"; only sessions are deleted. Expired invitations stay listed until revoked.
3. **An address can be connected twice in one organisation.** "An address is connected once per organisation" is enforced per kind: the same address can be connected over IMAP and again by Google or Microsoft sign-in, and its emails would then be fetched twice.
4. **Asking for a shared mailbox without being an administrator is not refused**: a personal one is connected instead, silently.
5. **The three triage corrections do not check where the email stands.** `POST /emails/:id/status` accepts any of the three statuses on any email not replied: an email to handle can be "moved back to handle", which only relabels its verdict as the member's. The interface never offers it.
6. **AI help is not refused on an email already replied.** `POST /emails/:id/assist` has no guard on the status. The interface offers no reply area there.
7. **"Explicit validation" before sending lives in the frontend only.** The guarantee is a confirmation dialog; the API sends on one call. This is by nature for a human confirmation, but it means the guarantee is a property of the interface, not of the server.
8. **A ready-made prompt can be added more than once through the API.** "Can be added once" holds because the list of templates hides those already present by name; `POST /prompts` does not check.
9. *(Settled.)* A sole administrator could never leave. **DeleteOrganization** now lets them; **DeleteOwnAccount** is still refused to the last administrator.
10. **A proposal prepared at fetch for an email with nobody to reply to is not filed**, and the email stays to handle with its proposal, without any sign of why (`prepare-proposals.ts`, way `mailbox`).
11. **Two definitions of "the member edited the proposal"**: the frontend's (`norm`: whitespace collapsed) decides whether the reason is asked; the backend's (`wasEdited`) decides whether it is kept. They can disagree.
12. **Fetching is done as the mailbox's owner**, including for a shared mailbox: their key, model and language sort it, and their signature and corrections write the prepared proposals, whoever reads them.
13. **A settings request is applied field by field.** `PUT /settings` and `PUT /organization` run one operation per field, in order; a field that is refused stops there, and those before it stay applied, although the request as a whole is answered as refused.
14. **Renewing by password keeps the servers.** A mailbox whose servers changed is disconnected and connected again, which forgets what was kept from it.

## Decisions

Taken by the product's owner on the questions the inventory raised. Each one that changed behaviour was made as its own change, apart from the moves that only relocated code.

| # | Question | Decision | Status |
| --- | --- | --- | --- |
| 1 | Connecting an address already connected renewed its credentials. | **RenewMailboxCredentials** is an operation of its own, on the mailbox. **ConnectMailbox** refuses an address already connected. | Done. A second connection is refused where it was accepted; the mailbox list offers "Renew access". |
| 2 | Sorting again what the first fetch let through was a flag on the organisation's settings. | **SortAgainUnsorted** is an operation of its own, with its own entry. | Done: `POST /organization/sort-again`. |
| 3 | Sorting and proposals were two settings; the interface showed four ways of working. | First merged into one way of working of four values; then **reversed**: the four ways did not explain themselves. An email goes through two steps, sorting then writing, and the organisation chooses what the AI does at each: **ChooseSorting** and **ChooseWriting**. | Done. The two choices are independent: writing at fetch without sorting is possible again. |
| 4 | The reply in progress is lost when the member leaves the page. | It stays in the browser. Nothing unsent reaches the server. | Nothing to do. |
| 5 | Checking an invitation link counts a wrong token towards the lock-out. | **CheckInvitation** is an operation. | Done: listed and filed as one. |
| 6 | Nothing changed a password, deleted one's own account, or deleted an organisation. | **ChangePassword**, **DeleteOwnAccount** (refused to the last administrator; what the member made passes to the longest-standing other administrator), **DeleteOrganization** (confirmed by the password and the organisation's name). | Done, all three. |

### Open questions

- **DeleteOrganization tells nobody.** The other members find themselves signed out. saras sends no email of its own today; telling them would be its first.
- **A shared mailbox that changes owner changes voice**: it is fetched with its owner's key, model, signature and corrections (deviation 12), so DeleteMember and DeleteOwnAccount silently change who sorts and writes for it.
- Deviations 1 to 14 (9 aside), each of which is a rule to confirm or a behaviour to change.
- The frontend asks for each operation through a function named after it (`web/api/`), and its pages are named after what a person does (`web/pages/`). Its own decisions (`TO_COMPLETE`, `norm`, `pathOf`) could still be brought out as pure functions with unit tests.
- Black-box specifications of the operations (webspicy) are still to write; the HTTP tests in `test/` play that part for now.
