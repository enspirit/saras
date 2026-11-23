# storage

The seeds: the datasets the stack's database is put into, loaded by [`dbagent`](https://github.com/enspirit/dbagent). It is responsible for one thing: that a named state of saras can be reached with one command, on a laptop and under the suites.

It does not own the schema. saras creates its tables when it starts ([decision 0001](../../doc/decisions/0001-the-server-creates-its-schema.md)); the compose service `storage` waits for it, and a seed fills tables that are already there.

## Public interface

Its seeds, by id, and its tasks. Nothing else.

| Seed | Is | Load it with |
| --- | --- | --- |
| `demo` | One organisation, **Brightwater Consulting**, as `npm run demo` sets it up: its administrator, a shared mailbox with twenty sample emails already fetched and sorted, a **Topic** attribute decided by a rule, a **Who** attribute set by hand, a rule for the priority, two boards. A slice: everything in it has an id from 900001 on. | `emb run storage:demo`: added to whatever the database holds, or put back as it was |
| `empty` | Every table, with no row. The root every other seed inherits. | `emb run storage:db.seed`: **empties the database** |

Sign in to the demo with `demo@saras.example` and `saras-demo-password`.

```sh
emb run storage:demo           # add the demo organisation, or put it back as it was
emb run storage:demo.rebuild   # rebuild data/demo from what `npm run demo` sets up
emb run storage:db.repl        # psql on the stack's database
emb run storage:db.tables      # the tables, fewest dependencies first
S=<seed> emb run storage:db.apply   # add a seed as a slice: nothing else is emptied
S=<seed> emb run storage:db.seed    # install a seed: EMPTIES every table first. Asks to type "empty"
S=<seed> emb run storage:db.flush   # write the database as a seed
```

Other components reach it at `http://storage:9292`, on the compose network only: `POST /seeds/apply?id=demo`, `POST /seeds/install?id=empty`.

## Depends on

| | |
| --- | --- |
| `enspirit/dbagent` | The image, pinned in `docker-compose.base.yml`. It reads `data/`, mounted. |
| PostgreSQL | The stack's database. |
| [`software/saras`](../saras/) | The schema, which it creates when it starts. And what the demo *is*: `scripts/demo/` holds the sample emails and the setup, and `scripts/demo-onto.ts` plays them onto a running server. |

## Must not

1. **Be deployed, routed or published.** Its seed endpoint empties tables. The service has no published port and no image of ours.
2. **Empty a database without being asked twice.** Every task that installs asks for a word to be typed; `demo` is applied, which empties nothing but the demo itself.
3. **Hold a secret that opens anything real.** What the demo seed carries is listed under Status, and is all of it.
4. **Hold a literal date that matters.** `data/demo/after_seeding.sql` moves the emails so that the latest was received an hour ago.
5. **Be written by hand.** A seed's rows are flushed from a state that was arrived at through the API: `demo.rebuild`. The hooks and `metadata.json` are authored.

## Harness

`emb run storage:demo.rebuild` is also its test: in a stack of its own, it installs `empty`, applies `demo` twice, and signs in as the demo account. CI applies `demo` to the stack it started (`emb run storage:demo`), which fails the day the seed no longer fits the schema.

## Status

> **In flight:** nothing.

- **The demo cannot fetch or send yet.** Its mailbox is the mail server `npm run demo` starts beside itself, and the stack has none: the mailbox shows a problem at the next fetch, and a reply is refused. Reading, sorting by rules, attributes, boards and (with a key) what the AI writes all work. A mail server in the stack is the next step; saras refuses one that is neither on `127.0.0.1` nor speaking TLS, which is what it has to solve.
- **What the demo seed carries that looks like a credential**, and is one only for the demo: the hash of the published demo password; and the mailbox's access, sealed with the development `APP_SECRET` of `software/saras/env/devel.env`, to a mail server that no longer exists. With an `APP_SECRET` of your own in `.env`, that access cannot be opened, which changes nothing until the stack has a mail server.
- **No suite starts from a seed yet.** `tests/webspicy` could now name one, but installing a seed empties the database, and on a laptop that is the development database. See its status.
- `npm run demo` still exists, and is what the seed is made from.
