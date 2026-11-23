# fakesmtp

**The outgoing mail server, as the stack meets it.** saras writes a few messages of its own, such as the link of a lost password, and hands them to a mail server: an agent we do not build. No stack may hand them to a real one. This one accepts everything, delivers nothing, and shows what it was given.

[`fake-smtp-server`](https://github.com/ReachFive/fake-smtp-server), and nothing of ours but its packaging.

## Public interface

- **SMTP on `fakesmtp:25`**, on the compose network, without authentication. saras is pointed at it by `SMTP_URL` in [`software/saras/env/devel.env`](../../software/saras/env/devel.env), and again under the suites.
- **What it was given**, on port 1080: a page on a laptop, [http://localhost:1080](http://localhost:1080) (`FAKESMTP_PORT`), and an API on the compose network, `GET` and `DELETE http://fakesmtp:1080/api/emails`.
- Its tasks:

```sh
emb run fakesmtp:mails   # what it was given to send: when, to whom, the subject
emb run fakesmtp:purge   # forget them
```

## What it stands in for

| Third party | What saras expects of it | Held by |
| --- | --- | --- |
| The server's own outgoing mail server (`SMTP_URL`, `MAIL_FROM`) | It takes the letter of a lost password and delivers it to the member. | `software/saras/test/integration/lost-password.test.ts`, against an SMTP server the test starts itself |

It does not stand in for a member's mailbox: saras sends a member's replies through the mailbox's own servers, and refuses one that is neither local nor speaking TLS.

## Must not

1. **Deliver anything.**
2. **Be published or deployed**: `publish: false`, and no stack but those of this repository names it.
3. **Publish a port under the suites**: its page is published by `docker-compose.devel.yml` only.

## Harness

None of its own. That saras reaches it is seen by asking for a lost password in the stack, then `emb run fakesmtp:mails`.

## Status

> **In flight:** nothing.

- It offers an upgrade to TLS with a certificate that expired long ago, so the address saras is given says not to take it: `smtp://fakesmtp:25?ignoreTLS=true`.
- `fake-smtp-server` is unmaintained; `package.json` overrides its `mailparser`, whose version 2 fails every message on Node 18 and later.
- No suite reads what it was given yet: `tests/webspicy` could specify RequestPasswordReset with it, once it can start from a seed.
