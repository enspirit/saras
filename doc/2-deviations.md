# Deviations, decisions, open questions

Where saras does not do what its own comments, the documentation or the interface say; what the product's owner decided; what is still to decide. What saras does is specified, operation by operation, in [`tests/operations`](../tests/operations/), where a specification that shows a deviation says so in a comment (`Deviation 5 of doc/2-deviations.md`). What specifying the operations found, and is not in this list yet, is in the [deviation candidates](deviation-candidates.md).

Each deviation is recorded, not fixed: a decision for the product's owner. Their numbers stay.

## Deviations

1. **The lock-out is per origin, not per address, and per server.** US-02 says "per address"; the code counts by origin, the IP address (`req.ip`). Behind a proxy that does not forward the client's address, everyone shares one count. The table of counts is never emptied. It is kept in each server's memory: on an installation of several servers, an origin has as many times the guesses.
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
12. **Proposals are prepared as the mailbox's owner**, including for a shared mailbox: their signature and corrections write them, whoever reads them.
13. **A settings request is applied field by field.** `PUT /settings` and `PUT /organization` run one operation per field, in order; a field that is refused stops there, and those before it stay applied, although the request as a whole is answered as refused.
14. **Renewing by password keeps the servers.** A mailbox whose servers changed is disconnected and connected again, which forgets what was kept from it.
15. **An email is shown as written, and its files open, for some kinds of mailbox only.** No HTML is kept of a mailbox connected by Microsoft sign-in: Graph is asked for the text of a message and gives one body. Attachments open for a mailbox connected by its servers; for Gmail and Microsoft the names are shown and lead nowhere (`emails.attachmentsNotRead`). An email fetched before its HTML was kept shows as text.
16. **A mailbox connected by Google or Microsoft sign-in is never fetched further than its most recent emails.** Each fetch looks at the `SYNC_MAX_EMAILS` most recent messages of the days chosen and keeps those it does not have: older ones never come, whatever the days chosen, and a fetch says none is to come. A mailbox reached by its servers goes back a fetch at a time, and says how many are left (`gmail.ts`, `graph.ts`, `imap/folders.ts`).

## Decisions

Taken by the product's owner on the questions the inventory of the operations raised, before the operations were specified. Each one that changed behaviour was made as its own change, apart from the moves that only relocated code.

| # | Question | Decision | Status |
| --- | --- | --- | --- |
| 1 | Connecting an address already connected renewed its credentials. | **RenewMailboxCredentials** is an operation of its own, on the mailbox. **ConnectMailbox** refuses an address already connected. | Done. A second connection is refused where it was accepted; the mailbox list offers "Renew access". |
| 2 | Sorting again what the first fetch let through was a flag on the organisation's settings. | **SortAgainUnsorted** is an operation of its own, with its own entry. | Done, then gone with the AI's sorting (7). |
| 3 | Sorting and proposals were two settings; the interface showed four ways of working. | First merged into one way of working of four values; then **reversed**: the four ways did not explain themselves. An email goes through two steps, sorting then writing, and the organisation chooses what the AI does at each: **ChooseSorting** and **ChooseWriting**. | Done. The two choices are independent: writing at fetch without sorting is possible again. Since 7, one choice is left: **ChooseWriting**. |
| 4 | The reply in progress is lost when the member leaves the page. | It stays in the browser. Nothing unsent reaches the server. | Nothing to do. |
| 5 | Checking an invitation link counts a wrong token towards the lock-out. | **CheckInvitation** is an operation. | Done: listed and filed as one. |
| 6 | Nothing changed a password, deleted one's own account, or deleted an organisation. | **ChangePassword**, **DeleteOwnAccount** (refused to the last administrator; what the member made passes to the longest-standing other administrator), **DeleteOrganization** (confirmed by the password and the organisation's name). | Done, all three. |
| 7 | Emails could be sorted by nobody, by rules, or by the AI. | The AI no longer sorts: rules do, and members ([decision 0011](decisions/0011-the-ai-does-not-sort.md)). **ChooseSorting**, **SortWaitingEmails** and **SortAgainUnsorted** are gone, and so is the state of an email waiting to be sorted. | Done. |
| 8 | Two attributes were pre-configured, "Stands in" and "Priority", though the application relied on the first only. | The priority is one of the organisation's own attributes: a new organisation starts with it, and renames it, changes its values or deletes it. Only "Stands in" is pre-configured, and its colours are the organisation's ([decision 0014](decisions/0014-the-priority-is-an-attribute-of-the-organisation.md)). | Done. |

## Open questions

- **DeleteOrganization tells nobody.** The other members find themselves signed out. saras sends no email of its own today; telling them would be its first.
- **A shared mailbox that changes owner changes voice**: its proposals are prepared with its owner's signature and corrections (deviation 12), so DeleteMember and DeleteOwnAccount silently change who writes for it.
- Deviations 1 to 15 (9 aside), each of which is a rule to confirm or a behaviour to change.
- The frontend asks for each operation through a function named after it (`web/api/`), and its pages are named after what a person does (`web/pages/`). Its own decisions (`TO_COMPLETE`, `norm`, `pathOf`) could still be brought out as pure functions with unit tests.
- What needs the LLM, a second factor or the server's own clock is not specified in [`tests/operations`](../tests/operations/): it is held by the HTTP tests of `software/saras/test/integration/` alone.
