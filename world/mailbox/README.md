# mailbox

**A member's mailbox, as the stack meets it.** saras reads and answers the email of mailboxes it does not hold: a mail provider is an agent we do not build, and no stack may talk to a real one. This one is an IMAP server holding twenty sample emails and an SMTP server that takes a reply and sends nothing. It is what makes the demo whole on one machine.

[`hoodiecrow-imap`](https://github.com/andris9/hoodiecrow) and [`smtp-server`](https://nodemailer.com/extras/smtp-server/), the two servers the tests of `software/saras` start themselves, with the sample emails.

## Public interface

- **IMAP on `127.0.0.1:1143`** and **SMTP on `127.0.0.1:1025`**, *as saras sees them*: the container runs in the network of the saras container, and listens on its loopback. User `testuser`, password `testpass`, no TLS. The address of the mailbox is `me@corp.example`.
- **Its content**: an inbox of twenty emails in English and in French — requests for quotes, invoices, problems, meetings, and the newsletters, notifications and automatic replies around them ([`emails.ts`](emails.ts)) — each dated from the moment the server starts; a `Sent` and a `Drafts` folder, empty.
- **What it was given to send**, in its log: `emb logs mailbox`.

It is connected to the demo organisation by `emb run demo` ([`bin/demo`](../../bin/demo)), which makes the container anew first: it keeps nothing, so that puts the mailbox back as it was.

## What it stands in for

| Third party | What saras expects of it | Held by |
| --- | --- | --- |
| A mail provider reached by its servers (IMAP, SMTP) | It lists its folders, gives the messages of one, takes a reply to send and a draft to file, and remembers what was answered. | `software/saras/test/integration/`, against servers each test starts itself |

Not Gmail and not Microsoft Graph, which saras reaches through their own APIs.

## Must not

1. **Send anything.**
2. **Be reached from anywhere but saras**: it listens on the loopback of the network it shares with it, and publishes no port.
3. **Be published or deployed**: `publish: false`.
4. **Keep anything**: what was sent, filed or flagged is forgotten when the container is made anew.

## Harness

None of its own. `emb run demo` fails when saras cannot connect it or fetches nothing from it, and CI runs it.

## Status

> **In flight:** nothing.

- **Why it shares the network of saras** rather than being a service beside it is [decision 0005](../../doc/decisions/0005-the-mailbox-of-the-stack-is-local-to-saras.md). One consequence to know: when the saras container alone is made anew (`emb up saras`), the mailbox is left in the network of the old one, until the next `emb up` or `emb run demo`.
- The server is a second copy of what `software/saras/test/support/mailbox.ts` sets up for the tests, which need a mailbox of their own per test.
- No suite uses it yet: `tests/webspicy` could specify ConnectMailbox and FetchMailbox against it.
