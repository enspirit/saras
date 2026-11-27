# Deviation candidates — what specifying the operations found

A report, not a decision. Writing the black-box specifications of [`tests/operations`](../tests/operations/) meant asking, of each clause of [the inventory](2-operations.md), whether the server does it. Where it does not, the specification says what the server does today, so that it passes, and the difference is listed here.

Each line is a question for the product's owner: is the rule right, and the server to change; or is the server right, and the inventory to follow? None was fixed, and none is in the inventory's own list of deviations yet. "File" is the specification that shows it: a file of `tests/operations/specification/`, in the `operations/` or the `observations/` of its area.

Found by reading the source and not shown by a case, when said so: *read, not run*.

## Access

| # | What the server does | What says otherwise | File |
| --- | --- | --- | --- |
| A1 | **SignIn does not require "no session".** A browser signed in as one member signs in as another: 200, a new session, and the earlier one stays open in the database. | Inventory: "No session → a session". | `access/SignIn.yml`, third example |
| A2 | **Checking a link to a new password is an entry of its own**, behind the brake on guessing: a link that opens nothing is 404 and counts as a wrong guess. | The inventory has no row for it: it appears only in the entry of ResetPassword. CheckInvitation got a row for the same reason. | `access/observations/CheckPasswordReset.yml` |
| A3 | **ChangePassword leaves a pending link to a new password good.** | No rule says either way. | `access/ChangePassword.yml` |
| A4 | **ResetPassword looks at the link before the password.** A short password with a dead link is 404 and a wrong guess, not 400. *Read, not run.* | Not said. | — |
| A5 | **A wrong password on `DELETE /api/me` and `DELETE /api/organization` is answered 401** to a member whose session stays open. Everywhere else 401 means signed out. | Not said. | `access/DeleteOwnAccount.yml`, `access/DeleteOrganization.yml` |
| A6 | **A request that changes something and carries no JSON is refused with 415**, a `DELETE` with nothing to say included. The interface always sends `{}`. | Not said anywhere. | — (the runner sends `{}`) |

## Members and invitations

| # | What the server does | What says otherwise | File |
| --- | --- | --- | --- |
| M1 | **RevokeInvitation refuses nothing.** A number nobody has, or an invitation of another organisation: 200, and nothing is revoked. | Inventory: "of their organisation"; the operation's header: "a pending invitation of the organisation". DeleteMember answers 404 in the same situation. | `access/RevokeInvitation.yml` |
| M2 | **AppointAdministrator accepts an administrator, and RemoveAdministratorRole a member who is not one**: 200, nothing changes. | Inventory: "A member with role user → administrator", "An administrator → user". The headers agree with the server. | `access/AppointAdministrator.yml`, `access/RemoveAdministratorRole.yml` |
| M3 | **`PUT /api/members/:id` with a role that is neither, or none, is 400 `members.invalidRole`.** | No row says it: it is the route's, not either operation's. | both files above |
| M4 | **InviteMember accepts a role that is not one**: `owner` invites as a user, 201. | Not said; and it is not what M3 does. | `access/InviteMember.yml` |
| M5 | **Shared boards pass on with the rest** when a member is deleted or leaves. | The headers of `delete-member.ts` and `delete-own-account.ts` name prompts and shared mailboxes only. The inventory and the code agree with each other. | `access/DeleteOwnAccount.yml` |

## Settings

| # | What the server does | What says otherwise | File |
| --- | --- | --- | --- |
| S1 | **ChooseLanguage checks a shape, not a language.** `zz` is kept as given; only what is not shaped like a tag becomes `en`. | Inventory: "a tag we recognise, else English". | `settings/ChooseLanguage.yml` |
| S2 | **`PUT /api/organization` treats a wrong type field by field.** `writing: null` is 400; a name, a model or a key that is not a text, and `skipAutomated` that is not a boolean, are ignored with 200. *The second half read, not run.* | Not said. | `settings/ChooseWriting.yml` |
| S3 | **The limits are in no document**: a name and an organisation's name are cut at 120 characters, a signature at 2000, a board's name at 80, an attribute's at 60; a key made of spaces removes the key. | Not said. | `settings/*.yml` |

## Mailboxes

| # | What the server does | What says otherwise | File |
| --- | --- | --- | --- |
| B1 | **Connecting asks the outgoing server too.** A wrong SMTP port is 400 `mailboxes.connectionFailed`. | Header and inventory: "the incoming server lets us in". | `mailboxes/ConnectMailboxByServers.yml` |
| B2 | **A fetch of a mailbox with no folder is not kept as its last error.** *Read, not run*: it needs a Background with no folder chosen. | The header of `fetch-mailbox.ts`: "says so as its last error". | — |
| B3 | **ChangeMailboxServers replaces a user name left empty by the address**, while a password left empty is kept. | Not said. | `mailboxes/ChangeMailboxServers.yml` |
| B4 | **RenewMailboxCredentials refuses an empty password**, 400 `mailboxes.passwordRequired`. | Neither the header nor the inventory lists that precondition. | `mailboxes/RenewMailboxCredentials.yml` |
| B5 | **The inventory's deviation 14 looks out of date**: a mailbox whose servers changed no longer needs disconnecting; ChangeMailboxServers does it in place. | Inventory, deviation 14. | `mailboxes/ChangeMailboxServers.yml` |
| B6 | **No folder named is 400 `mailboxes.unknownFolder`**, and only after the mail server was asked for its folders. `mailboxes.folderRequired` is only ever told in what a fetch answers. | Not said. | `mailboxes/ChooseWatchedFolder.yml` |

The inventory's deviation 4 (a member asking for a shared mailbox gets a personal one, silently) is confirmed and specified as it is.

## Emails, sorting, replying

| # | What the server does | What says otherwise | File |
| --- | --- | --- | --- |
| E1 | **A refusal of `GET /api/emails/:id/html` is JSON served as `text/html`.** The route sets the type before it looks for the email. A visitor's 401 is proper JSON. | Every other refusal is JSON. The specification shows these as examples answered 404, since what is answered is not a refusal a client can read as one. | `emails/observations/ReadEmailAsWritten.yml` |
| E2 | **`GET /api/emails/:id` tells more than its type declares**: `accountId`, `folder`, `providerId`, `messageId`, `threadId`, `refs`, `replyTo`. | `shared/email.ts`, `EmailWithItsReply`. | `emails/observations/ReadEmail.yml` |
| E3 | **A correction keeps the rule's reason.** An email a rule set aside and a member then moved reads as the member's, with the rule's reason. | Header: "the verdict is recorded as the member's". | `sorting/*.yml` |
| E4 | **`changed` counts the emails named and not replied, not those that changed.** Ignoring an email already ignored answers `changed: 1`. The same in SetAttributeOfSelection: 20 where 6 had a value. | `shared/email.ts`: "how many changed". | `sorting/CorrectSortingOfSelection.yml`, `attributes/SetAttributeOfSelection.yml` |
| E5 | **No key in force is answered 502**, though the client builds that refusal with 400: every refusal of the LLM is turned into 502. | `openrouter.ts` against `refusals.ts`. | `replying/CheckTypos.yml` |
| E6 | **An ignored email, or one needing no reply, can be replied to**, and who sorted it stays. An unknown `box` is the emails to handle. A search does not look at recipients, and takes `%` as it is. | Not said. | `replying/SendReply.yml`, `emails/observations/ListEmails.yml` |

The inventory's deviations 5 (a correction does not check where the email stands) and 6 (AI help is not refused on a replied email) are confirmed, each by an example. Deviation 7 (the confirmation before sending is the interface's) shows as a precondition no counterexample violates.

## Attributes

| # | What the server does | What says otherwise | File |
| --- | --- | --- | --- |
| T1 | **DeleteAttribute leaves boards, prompts and emails naming the attribute.** After Topic is deleted, the board Billing still filters on it and counts 3 emails, the prompt Quote still suits it, and emails are told with their value for it. | The header of `delete-attribute.ts`: "boards that filtered on it no longer do". | `attributes/DeleteAttribute.yml` |
| T2 | **Taking away the value of "Stands in" is accepted**: 200, nothing changes, and a selection even answers `changed: 2`. Only a value that is not empty is refused. | Inventory: 'not "Stands in"', for both operations. | `attributes/SetEmailAttribute.yml`, `attributes/SetAttributeOfSelection.yml` |
| T3 | **TryRule refuses a rule that fails on one of the recent emails**, 400, where SortAgainByRule takes the same failure as the rule saying nothing. An empty rule is refused by TryRule and found faultless by CheckRule. | The inventory names no refusal of TryRule. | `attributes/observations/TryRule.yml` |
| T4 | **TryRule on a kept choice uses the values typed, not those kept.** Given in another order, Billing emails get the other value; given none, every value is null. | Not said. | `attributes/observations/TryRule.yml` |
| T5 | **EditAttribute lets one of the organisation's own change kind**: Who, a member, becomes a choice. | The inventory speaks of name and values. | `attributes/EditAttribute.yml` |
| T6 | **EditAttribute on "Stands in" ignores a name, a kind or labels given**, with 200. | Nothing is refused; `attributes.systemFixed` is only DeleteAttribute's. | `attributes/EditAttribute.yml` |
| T7 | **`GET /api/attributes/skill`, with no key, is a second route** on the handler of `GET /api/attributes/:key/skill`. | The inventory names one. Not specified. | — |

## Boards and prompts

| # | What the server does | What says otherwise | File |
| --- | --- | --- | --- |
| P1 | **"The attributes we know" are any key that is `status` or a number.** A filter or what a prompt suits may name another organisation's attribute, or nobody's, and it is kept; values are not looked at. | The inventory's wording suggests the organisation's own. | `boards/EditBoard.yml`, `prompts/CreatePrompt.yml` |
| P2 | **Members are told what a prompt suits.** | The inventory's state table: "members: name and description". | `prompts/observations/ListPrompts.yml` |
| P3 | **EditBoard and EditPrompt replace the whole.** A name alone makes a shared board personal with an empty filter, and empties a prompt's description and what it suits. | Not said. | `boards/EditBoard.yml`, `prompts/EditPrompt.yml` |
| P4 | **An administrator who un-shares a board another administrator made loses it**: it stays with who made it. | The inventory's row lacks it; the header has it. | `boards/EditBoard.yml` |
| P5 | **A filter on where an email stands takes a box** (`todo`), not a status (`needs_reply`): the status is kept and shows nothing. | Not said. | `boards/observations/TryBoardFilter.yml` |
| P6 | **An organisation can delete its last prompt.** | The inventory is silent; PrepareProposals needs one. | `prompts/DeletePrompt.yml` |
| P7 | **EditPrompt looks at what is given before whose prompt it is**: a blank name on another organisation's prompt is 400, not 404. | Elsewhere what one may not see is not found, whatever else is wrong. | `prompts/EditPrompt.yml` |

The inventory's deviation 8 (a ready-made prompt can be added twice) is confirmed.

## In the sources only

- The comment on `boardsFor` in `observations/boards.ts` still says "the shared boards, then the member's own", which [decision 0016](decisions/0016-the-order-of-boards-is-each-member-s.md) replaced.
- The header of `create-prompt.ts` leaves the emails it suits out of its DomPost.

## What the coming change should know

Not deviations: things the specifications pin that [a person in several organisations](multi-organisation-brief.md) will meet.

- **The value of a "member" attribute is the person's number**, and `GET /api/attributes` tells every member the number and the address of each member, where `GET /api/members` is for administrators.
- **The heir of what a leaving administrator made** is found among the administrators of the organisation, the longest-standing first: `DeleteOwnAccount.yml` has an example for it.
- **`accountId` is told with an email** (E2).
