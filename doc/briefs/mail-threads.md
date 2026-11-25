# Brief — seeing an email in its thread

> **Status:** not started. This brief says what has to change, in what order, and which routes are worth covering by tests before the work begins.

The goal: when a member reads an email, they see the conversation it belongs to (the messages before it, the replies sent from saras, and what came after) without leaving the reading pane.

This brief does **not** make the thread the unit of work. An email stays what a member sorts, gives attributes to and replies to ([US-23](../1-user-stories.md#us-23--work-through-four-boxes), [US-27](../1-user-stories.md#us-27--act-on-several-emails-at-once)). Grouping the boxes by thread is a separate decision, discussed in §3.4.

## What exists today

| | Gmail | Microsoft Graph | IMAP |
| --- | --- | --- | --- |
| `emails.message_id` | `Message-ID` header | `internetMessageId` | `Message-ID` header |
| `emails.thread_id` | Gmail `threadId` | `conversationId` | **always `null`** ([`imap/message.ts`](../../software/saras/src/tooling/mail/imap/message.ts)) |
| `emails.refs` | `References` header | `References` header | `References` header |

- All three are written at fetch ([`state/emails.ts`](../../software/saras/src/domain/state/emails.ts)), but only one thing reads them: building the threading headers of an outgoing reply ([`computations/reply.ts`](../../software/saras/src/domain/computations/reply.ts), [`mail/mime.ts`](../../software/saras/src/tooling/mail/mime.ts)).
- The API exposes none of the three: neither `EmailSummary` nor `EmailWithItsReply` in [`shared/email.ts`](../../software/saras/shared/email.ts) has a field for them.
- `In-Reply-To` is not kept.
- `thread_id` has no index.
- A reply sent from saras is a row of `replies`, with no `Message-ID` of its own. Nothing could match an answer to it.
- Only the watched folder is fetched. On Gmail, the query also leaves out `from:me`. The member's own messages sent from another client are therefore never in saras.
- The identity of an email is `(account_id, folder, provider_id)`. The same message can be kept twice if the watched folder changes.

---

## 1. How the domain and the data model must evolve

### 1.1 A thread key, computed the same way for every provider

A new pure computation, `src/domain/computations/threads.ts`, comes with a table of cases and no mock:

```
threadKey({ messageId, inReplyTo, refs }) →
  the first Message-ID of refs          (the root of the conversation)
  else inReplyTo                         (a client that sends only In-Reply-To)
  else messageId                         (a message that starts a conversation)
  else null                              (no identifier at all: a thread of one)
```

- The key is **ours, for every provider**. The provider's `thread_id` stays as it is and is used only to hand a reply to Gmail. Gmail and Graph group by subject as well as by headers, so trusting their ID would make the same conversation look different depending on the mailbox. This is a choice between real alternatives, so it gets a record in `doc/decisions/`. Gmail and Graph IDs are better when a message lost its `References` (some web clients do this). What would reverse the choice: evidence that this happens often in the mailboxes members connect.
- The key is normalised (angle brackets kept, lower case, whitespace trimmed), so `<A@x>` and `<a@x> ` match.
- A thread is **scoped to one mailbox** (`account_id`). Access in saras is per mailbox (`mayUse` in [`state/mailboxes.ts`](../../software/saras/src/domain/state/mailboxes.ts)): a member may use a shared mailbox but not a colleague's personal one. A thread spanning mailboxes would show one member what another member's mailbox received. Two mailboxes of the same organisation that both got a message have two threads, each showing what its own users may see. *Nothing of an organisation is reachable from another* holds trivially, and so does this narrower rule.

### 1.2 New columns (one additive migration)

| Table | Column | Why |
| --- | --- | --- |
| `emails` | `in_reply_to TEXT` | The second source of the thread key. Filled at fetch by all three providers. |
| `emails` | `thread_key TEXT` | The computed key. Indexed `(account_id, thread_key, date)`. |
| `replies` | `message_id TEXT` | The `Message-ID` our reply left with, so that an answer to it lands in the same thread, and so the reply can be placed in the thread. |

How `thread_key` is filled is a choice, given that [several servers may share the database](../decisions/0010-the-server-migrates-its-database-and-several-may-share-it.md) and the migration must leave the previous server working:

- **(a) A column written by the server**, computed by `threadKey()` at insert. Rows inserted by a server of the previous version during a rolling update get `NULL`. The query then needs a fallback (`COALESCE(thread_key, message_id)`), or a clock turn ([`clock.ts`](../../software/saras/src/tooling/clock.ts)) that fills the gaps.
- **(b) A `GENERATED ALWAYS AS (…) STORED` column.** Any server version fills it. The rule then lives in SQL, outside the table of cases in `computations/`.

The recommendation is (a): the rule of the code wants decisions in `computations/`. Add a backfill in the migration itself, plus the `COALESCE` fallback. The fallback keeps a message that was inserted by an old server findable, as a thread of one, until the next fetch.

The backfill for existing rows (`in_reply_to` is unknown for them) can be done in SQL: `split_part(refs, ' ', 1)`, else `message_id`.

### 1.3 Capturing our own Message-ID

| Provider | Where it comes from |
| --- | --- |
| IMAP / SMTP and Gmail | `buildRawReply` composes the message: read the `Message-ID` from the composer (or set one explicitly) and return it alongside the raw message. |
| Graph | `createReply` returns a draft. Its `internetMessageId` is in the answer. **To verify** that Graph keeps it when the draft is sent. |

`MailProvider.send` and `saveDraft` ([`model/mailbox.ts`](../../software/saras/src/domain/model/mailbox.ts)) then return `{ messageId: string | null }` instead of `void`. `handOver` writes it to `replies.message_id`.

### 1.4 Our side of the conversation: what counts as a message of a thread

A thread shows:

1. the emails kept in that mailbox with the same key;
2. the `replies` (mode `sent`) to any of those emails, placed by `sent_at`;
3. *(later, optional)* the messages of the mailbox's Sent folder with the same key.

Point 3 is the only one that changes the meaning of `emails`. Today every row is something received that waits to be sorted. A sent message would need a `direction` column (`'in' | 'out'`), and **every** observation of boxes, boards, counts, search and selection would have to leave `'out'` aside. On Gmail, `-from:me` would also have to go for that folder. This is why 3 is kept out of the prerequisites (§2) and out of the first version of the feature (§3).

### 1.5 Retention, privacy and logs

- [ErasePastRetention](../../software/saras/src/domain/retention/erase-past-retention.ts) blanks bodies and keeps rows. The thread of an old email therefore shows its senders, dates and subjects, without text. That is consistent with US-26 (an erased email is still found by sender and subject). Say it in the user story.
- `thread_key`, `message_id` and `in_reply_to` hold addresses' domains and sometimes local parts. They are **never** logged ([decision 0012](../decisions/0012-the-server-logs-json-lines-and-never-what-it-protects.md)) and never sent to the LLM. A log line about threads carries the email's number and a count, nothing else.
- Nothing about a thread is sent to an AI in this feature. Feeding the previous messages to the proposal prompt is a different change, with its own privacy review.

---

## 2. Can the prerequisite work be 100% iso-functional?

**Yes, for everything in §1.1–§1.3.** Neither the API, the interface nor what is sent changes. **No, for §1.4 point 3** (fetching the Sent folder).

### 2.1 Iso-functional: routes and webspicy unchanged

| Step | Why nothing outside changes |
| --- | --- |
| `threadKey()` and its table of cases | Pure, unused by any route. |
| Migration: `in_reply_to`, `thread_key`, `replies.message_id`, index, backfill | Additive and nullable. No `SELECT *` result reaches the API: `EmailSummary` and `EmailWithItsReply` list their fields. Check that `rowToEmail` and the observations do not spread rows into answers. |
| Providers fill `inReplyTo`; the fetch writes `thread_key` | Not exposed. Sorting rules look only at `MailHeaders`, which does not change. |
| `send` / `saveDraft` return the `Message-ID`; `handOver` stores it | The response of `POST /emails/:id/send` and `/file-as-draft` stays `{ wasEdited }`. |
| An observation `threadOf(email)` in `domain/observations/`, with integration tests | Not wired to a route yet. |

Two points need care to keep this claim honest:

- **The outgoing message must not change on the wire.** IMAP and Gmail already get a `Message-ID` from the composer. Reading it back changes nothing, but *setting* one ourselves would change the headers, though not their kind. Graph builds the message itself, and we only read the ID. Cover this with a test in [`handing-over-a-reply.test.ts`](../../software/saras/test/integration/handing-over-a-reply.test.ts): the raw message has the same headers before and after the change.
- **The migration test** ([`migrations.test.ts`](../../software/saras/test/integration/migrations.test.ts)) must show the previous server still inserting and reading emails on the new schema.

### 2.2 Not iso-functional: fetching the Sent folder

It cannot be made invisible. The new rows would appear in boxes, counts, boards, search, "select all of a view" and rule sorting, unless every one of those queries filters on `direction = 'in'`. That filter could be added first, as a pure refactoring, and those are exactly the routes worth covering beforehand. But choosing which folder holds the sent mail is a new setting on the mailbox: either a change to `PUT /mailboxes/:id/folder`, or a new route. Leave this out of the prerequisites.

---

## 3. Implementing the feature afterwards

### 3.1 API

Add **one new route** rather than growing `EmailWithItsReply`:

```
GET /emails/:id/thread  →  ThreadOfEmail
```

```ts
// shared/email.ts
export interface MessageOfThread {
  kind: 'received' | 'replied';          // 'sent' later, with §1.4 point 3
  emailId: number | null;                 // a received email the member may open
  fromName: string; fromAddr: string;
  date: string;
  subject: string;
  snippet: string;                        // '' past retention
  current: boolean;                       // the email asked for
}
export interface ThreadOfEmail { messages: MessageOfThread[] }   // oldest first, at most N
```

- It is refused as `notFound` exactly like `GET /emails/:id`, through `emailFor`, so the existing rule *what one may not see does not exist* carries over.
- It is a new operation: a row in [`doc/2-operations.md`](../2-operations.md) (observation **ShowThread**), its file in `src/domain/observations/`, and its webspicy specification under `formaldoc/api/emails/{id}/thread/get.yml`.
- `GET /emails/:id` and the lists stay exactly as they are. The tests written now keep passing as is.

### 3.2 Interface

- **Reading pane** ([`web/pages/reading.ts`](../../software/saras/web/pages/reading.ts)): above the email, a compact list of the thread's other messages (sender, date, first line). It is collapsed when the thread has more than a few messages. A received one opens that email; a reply expands its text.
- Words go in `public/i18n/`, in every language. The list uses existing components from the design system ([`doc/4-design.md`](../4-design.md)); a new component goes in the styleguide first.
- A user story, US-28 *See an email in its conversation*, goes in [`doc/1-user-stories.md`](../1-user-stories.md), with the retention behaviour of §1.5.

### 3.3 Later, if wanted: the Sent folder

`direction` on `emails`, the filter in every observation, a "sent folder" per mailbox, and Gmail's `-from:me` lifted for that folder. Then `kind: 'sent'` in `MessageOfThread`. This is its own brief.

### 3.4 Not in scope: the box lists grouped by thread

Showing one line per thread changes `EmailSummary` and `EmailsOfBox.counts`, what "select all of a view" means, and how a status is decided (is a thread "to handle" when its last message is?). It is a change to the unit of work, not a way of seeing it. Decide it separately, with a decision record.

---

## What to cover with tests now, and what to leave

The goal is to write API and e2e tests before the work without writing some of them twice.

| Route | Changes with this work? | Cover now? |
| --- | --- | --- |
| `GET /emails`, `GET /boards/:id/emails`, `POST /emails/selection/*` | No (unless §3.4 is chosen one day) | **Yes.** They are also what §2.2 would touch. |
| `GET /emails/:id` | No: the thread gets its own route | **Yes** |
| `GET /emails/:id/html`, `/attachments/:n` | No | Yes |
| `POST /emails/:id/status`, `PUT /emails/:id/attributes/:key` | No | Yes |
| `POST /emails/:id/send`, `/file-as-draft` | Response unchanged. The message on the wire must stay the same. | **Yes**, including the raw message's headers (§2.1) |
| `PUT /mailboxes/:id/folder`, `GET /mailboxes/:id/folders` | Only with the Sent folder (§3.3) | Yes, but expect to revisit them if §3.3 happens |
| `GET /emails/:id/thread` | New | Later, with the feature |

For webspicy, the obstacle is not these routes but the suite itself. It [cannot yet choose its start state](../../tests/webspicy/README.md#status), so it specifies nothing a member does. A database of its own, seeded with the demo, is the prerequisite to every row above. Until then, the same coverage fits in `test/integration/` (which already drives the API through [`test/support/client.ts`](../../software/saras/test/support/client.ts)). There is no browser end-to-end suite today. Playwright is available, but adding a suite is a choice for its own decision record.
