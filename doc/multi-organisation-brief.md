# Brief — a person in several organisations, and boards across them

A plan, not yet a decision: nothing here is implemented. It says where the model must go, what can be done first without a member seeing any difference, and how the feature is built afterwards. Its purpose today is to tell which parts of the API are worth specifying now, and which will move.

Vocabulary and the present state are in [the specification of the operations](../tests/operations/), its [state](../tests/operations/specification/state.yml) and its [agents](../tests/operations/specification/agents.yml); the layout of the code in the [architecture](3-architecture.md).

## The aim

- A person belongs to several organisations, with a role in each.
- They work in one organisation at a time, as today, or look across: boards that show emails from mailboxes of different organisations.
- A mailbox is connected once on the installation.

## What was settled

| Question | Answer |
| --- | --- |
| What identifies a mailbox | Its address alone, across the installation, whatever its kind (IMAP, Google, Microsoft). |
| Where a mailbox lives | In exactly one organisation: its emails take their attributes, rules, prompts, key and writing setting from it. |
| May a refusal reveal that an address is connected elsewhere | Yes: it is only given once the credentials were seen to work. |
| Who gets a contested mailbox | Working credentials win over refused ones. When both work, the older organisation (`organizations.created_at`) wins. When the credentials held cannot be tried (timeout, provider down), nothing changes hands. |
| What happens to what the loser kept | Erased, not moved. The loser sees a mailbox disconnected, and is not told by whom. |
| Existing duplicates | There are none. The migration assumes it and fails whole if it is wrong. |
| The isolation guarantee | Restated, not dropped: a person sees what each of their memberships allows; a board across organisations is personal, never shared; an organisation's key never writes for another's mail. |

Each of these becomes a record in [`decisions/`](decisions/) when its part is built.

## 1. How the model must evolve

### Today

| Fact | Where |
| --- | --- |
| A person and their membership are one row: address, password and second factor, with `org_id` and `role`. | `users` |
| An address is a member of one organisation at most. | `users.email` is unique; InviteMember refuses a taken address |
| A session names a person; the organisation follows from the person. | `sessions.user_id`; `membersOnly` in `src/tooling/http/session.ts` |
| An operation acts on behalf of `Actor { member, organization }`. | `src/domain/world.ts`, received by about 70 files |
| A mailbox is unique per organisation and kind. | index `accounts_identity (org_id, kind, email)` |
| "May use a mailbox": in my organisation, and mine or shared. | `mayUse` in `src/domain/state/mailboxes.ts` |
| A board belongs to one organisation and one member; its filter names mailboxes and attributes by their numbers, which are unique across the installation. | `boards`, `shared/board.ts` |

### The target

| Object | Holds | Change |
| --- | --- | --- |
| Person | Address, password, second factor, language | `users`, without `org_id` and `role` |
| Membership | Person, organisation, role | New: `memberships (user_id, org_id, role)`, unique on the pair |
| Session | Person, and the organisation acted in | `sessions.org_id` added |
| Mailbox | Address unique on the installation, one organisation, owner, shared or not | Index on `accounts (email)` replaces `accounts_identity` |
| Board | As now; later, its organisation may be absent for a personal board across organisations | `boards.org_id` nullable, with the feature only |
| Email, attribute, prompt, invitation, proposal, reply | As now | None |

Signature and the order of boards stay with the person for now. Either may later belong to the membership; moving a column is cheap and blocks nothing.

### Derived notions, restated

| Notion | Today | Target |
| --- | --- | --- |
| Actor | Member and organisation | Person, membership (the role), organisation |
| May use a mailbox | In my organisation, mine or shared | In the organisation acted in, mine or shared. Across organisations: in an organisation I am a member of, mine or shared. |
| Administrator | `users.role = 'admin'` | The role of the membership in the organisation concerned |
| The organisation of an action on an email or a mailbox | The actor's | The mailbox's. The same today; the only right one across organisations. |

### Two rules that follow

- **A role is read from the membership, an organisation from the thing acted on.** Nothing reads `member.org_id` or `member.role` directly once the prerequisite is done.
- **Filters keep naming things by numbers unique on the installation.** An attribute or a mailbox is never named in a filter by a key that only means something inside one organisation.

## 2. Can the prerequisite be done with nothing changing for a member?

Almost. The prerequisite is two pieces of work, and they do not answer alike.

### 2a. Person, membership, session — yes, entirely

| Step | What |
| --- | --- |
| Migration | `memberships`, filled from `users (id, org_id, role)`; `sessions.org_id`, nullable, filled from the person. |
| State | A session is opened with the organisation of the person's membership. `membersOnly` builds the actor from the session's organisation and the membership. |
| Domain | `Actor` gains the membership; every reading of `member.role` (about 20) and of `member.org_id` goes through it. |
| Guards | Unchanged in effect: everyone still has exactly one membership, because InviteMember and CreateOrganization still refuse a taken address. |

No route is added, removed or renamed. No answer changes shape or status:

- `/members/:id` keeps naming a person, who is one member of the organisation acted in.
- `GET /me` keeps one `organization` and one `role`: those of the organisation acted in.
- Every route that says nothing of an organisation keeps meaning "in mine", which becomes "in the one my session is in".

So the integration suite and every specification of [`tests/operations`](../tests/operations/) written before this work must pass unchanged after it. That is the test of the work.

One cost is hidden from the API: while an upgrade is under way, a server of the previous version still writes `users.org_id` and `users.role` and opens sessions without an organisation. The new version must tolerate both until a later migration removes the old columns: a session without an organisation falls back to the person's only membership, and a trigger on `users` keeps `memberships` in step. This is covered by a migration test, not by the API.

### 2b. A mailbox connected once — no, for one case

| | Before | After |
| --- | --- | --- |
| Connecting an address already connected in another organisation | 201 | 409, `mailboxes.alreadyConnected` |
| Connecting an address already connected in the same organisation by another kind | 201 | 409, `mailboxes.alreadyConnected` |
| Everything else | | Unchanged |

It cannot be iso-functional because the rule itself is a new refusal. What stays put:

- No route changes, and no answer changes shape: the status and the code are the ones the same organisation already gets today.
- On the data as it is, no member sees a difference: the case does not occur.
- One existing test says the opposite and is turned around: `test/integration/separate-organisations.test.ts`, "The same mailbox may be connected by another organisation".

The migration is one statement, the unique index on `accounts (email)`, with the old index dropped. It is its own check: on a database holding a duplicate it fails, the migration is taken back whole, and the server does not start. To verify when it is written: that the address named in PostgreSQL's error detail does not reach a log.

During an upgrade, a server of the previous version lets the cross-organisation case through its own check and meets the index: a 500 where a 409 is due, for as long as both versions run.

Until the contest of section 3 exists, a mailbox held by the wrong organisation is released by that organisation, or by the operator.

### What this means for the coverage to write first

| Area | Routes | Later | Specify now |
| --- | --- | --- | --- |
| Emails, sorting, replying | `/emails…` | Unchanged within an organisation; an email may later say which organisation it is of | Fully |
| Attributes, prompts | `/attributes…`, `/prompts…` | Unchanged | Fully |
| Boards | `/boards…` | Unchanged within an organisation; a board without organisation is an addition | Fully |
| Mailboxes | `/mailboxes…`, `/oauth…`, `/mail/host` | Unchanged, but for connecting an address held elsewhere | Fully, leaving out the address connected in another organisation |
| Settings | `PUT /settings`, `PUT /organization`, `GET /me` | `GET /me` gains the list of the person's organisations; nothing is removed | Fully |
| Getting in | `/public`, `/auth/login`, `/auth/logout`, `/auth/second-factor`, `/auth/password…` | Unchanged | Fully |
| Creating an organisation | `POST /auth/signup` | Unchanged for a new person; an existing person will use another route | Fully |
| Invitations | `POST /invitations`, `/invitations/check`, `/invitations/accept` | Change: an address that already has an account may be invited, and accepts without choosing a password | The happy path only; not "no member has this address" |
| Members, as administrators manage them | `GET /members`, `PUT /members/:id` | Unchanged: roles stay per organisation | Fully |
| | `DELETE /members/:id`, `POST /members/:id/password-reset`, `DELETE /members/:id/second-factor` | Change: an administrator ends a membership, and loses the two powers over a person's credentials | Lightly, or not at all |
| Leaving | `DELETE /me`, `DELETE /organization` | Change in what they take with them: a person outlives an organisation they were not alone in | The refusals; the success lightly |

The same split holds for end-to-end tests of the interface: the Users screen, the invitation page and the header naming the organisation will move; the boxes, the boards, the reply area, the mailboxes and the settings will not.

The black-box suite needed a start state of its own before it could specify anything that writes. It has one: see [`tests/operations`](../tests/operations/README.md).

## 3. How the feature is built afterwards

In an order where each step ships alone.

### 3a. The contest for a mailbox

ConnectMailbox, when the address is already connected and the credentials given work, tries the credentials held:

| The credentials held | Outcome |
| --- | --- |
| Refused by the provider | The mailbox passes to the newcomer's organisation. |
| Work, and the newcomer's organisation is the older | The same. |
| Work, and the holder's organisation is the older | Refused, as now. |
| Cannot be tried | Refused; nothing changes hands. |

Passing means the old mailbox is disconnected, with everything kept from it, and a new one connected. Several servers share the database: the passing is one transaction, decided there. No route changes: the same request is answered 201 where it was answered 409.

### 3b. Two gates, before anyone has a second membership

- **Administrators act on memberships, not on persons.** DeleteMember ends a membership; the person goes only when it was their last. ResetSecondFactor and CreatePasswordResetLink go, or are kept for a person whose only organisation is the administrator's: otherwise an administrator of one organisation resets a password and enters another.
- **Deleting an organisation spares its people.** DeleteOrganization removes memberships, and a person only when none is left. DeleteOwnAccount refuses while the person is the last administrator of any of their organisations.

Then the old columns go: `users.org_id` and `users.role`, the trigger, in a migration of their own, once no server of the previous version is left.

### 3c. Several memberships

| Operation | Change |
| --- | --- |
| InviteMember | The address may already have an account; it may not already be a member of this organisation. |
| AcceptInvitation | By someone signed in under that address: a membership is added, no password is chosen. |
| CreateOrganization | Also by a person already signed in: a new route, the sign-up unchanged. |
| SignIn | The session opens in the organisation the person last acted in. |
| New: choose the organisation acted in | Changes `sessions.org_id`, among the person's memberships. |
| New: leave an organisation | A person ends their own membership; not its last administrator. |
| `GET /me` | Also lists the person's organisations and their role in each. |

One browser acts in one organisation at a time, since the session carries it; two tabs in two organisations would need the organisation in the address of every route, which is the alternative not taken.

### 3d. Boards across organisations

- A board may have no organisation: it is then personal, and can never be shared.
- Its emails are those of every mailbox the person may use, in any of their organisations: `mayUse` in its wider form.
- Any operation on an email takes its organisation, its key, its prompts and its attributes from the email's mailbox. The session's organisation is not consulted.
- No session "above" the organisations is needed: such a board is reachable from wherever the person is.
- Conditions on status, mailbox, sender, keywords, age and attachments mean the same everywhere and work at once.
- A selection across organisations is acted on organisation by organisation.

### 3e. Attributes across organisations — open

Each organisation owns its attributes and their values ([decision 0014](decisions/0014-the-priority-is-an-attribute-of-the-organisation.md)). "Urgent, in all my organisations" has no meaning yet. The candidates: a filter naming one attribute per organisation; attributes of the person, mapped to each organisation's; or nothing, and such boards filter on facts and status only. This is a product question, and nothing above depends on its answer.

## Order

1. A start state for the black-box suite, then the coverage of the table in section 2.
2. A mailbox connected once (2b).
3. Person, membership, session (2a): every specification passes unchanged.
4. The contest (3a), the gates (3b), then 3c and 3d as wanted.
