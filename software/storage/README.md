# storage

The seeds: the datasets the stack's database is put into, loaded by [`dbagent`](https://github.com/enspirit/dbagent). It is responsible for one thing: that a named state of saras can be reached with one command, on a laptop and under the suites.

It does not own the schema. saras migrates its database when it starts ([decision 0010](../../doc/decisions/0010-the-server-migrates-its-database-and-several-may-share-it.md)); the compose service `storage` waits for it, and a seed fills tables that are already there.

## Public interface

Its seeds, by id, and its tasks. Nothing else.

| Seed | Is | Load it with |
| --- | --- | --- |
| `demo` | One organisation, **Brightwater Consulting**: its administrator, a **Topic** attribute decided by a rule, a **Who** attribute set by hand, a rule for the **Priority** it started with, two boards, a prompt. Not its mailbox, whose access a seed cannot carry (see Status). A slice: everything in it has an id from 900001 on. | `emb run demo`: added to whatever the database holds, or put back as it was, then its mailbox connected |
| `empty` | Every table, with no row. The root every other seed inherits. | `emb run storage:db.seed`: **empties the database** |

Sign in to the demo with `demo@saras.example` and `saras-demo-password`.

```sh
emb run demo                   # the demo: this seed, then the mailbox of the stack connected to it
emb run storage:demo.rebuild   # rebuild data/demo by setting the organisation up through the API
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
| [`software/saras`](../saras/) | The schema, which it migrates when it starts. And the way to the demo's state: `scripts/demo-organisation.ts` sets the organisation up through the API, which is what `demo.rebuild` flushes. |

## Must not

1. **Be deployed, routed or published.** Its seed endpoint empties tables. The service has no published port and no image of ours.
2. **Empty a database without being asked twice.** Every task that installs asks for a word to be typed; the demo is applied, which empties nothing but the demo itself.
3. **Hold a secret that opens anything real.** What the demo seed carries is listed under Status, and is all of it.
4. **Hold what another agent controls.** The emails of the demo are the mailbox's ([`world/mailbox`](../../world/mailbox/)): saras fetches them, and the seed has none.
5. **Be written by hand.** A seed's rows are flushed from a state that was arrived at through the API: `demo.rebuild`. The hooks and `metadata.json` are authored.

## Harness

`emb run storage:demo.rebuild` is also its test: in a stack of its own, it installs `empty`, applies `demo` twice, and signs in as the demo account. CI runs `emb run demo` on the stack it started, which fails the day the seed no longer fits the schema.

## Status

> **In flight:** nothing.

- **The demo's mailbox is not in the seed.** The access to a mailbox is sealed with the server's `APP_SECRET`: a seed could carry it for one secret only. So the seed holds the organisation, and `emb run demo` connects the mailbox of the stack through the API, whatever the secret.
- **What the seed carries that looks like a credential**, and is one only for the demo: the hash of the published demo password.
- **Two tables are the server's alone, and in no seed**: `schema_migrations`, the ledger of what was applied to the schema, and `scheduled_tasks`, when what the server does on its own is next due. `empty` does not name them, so installing a seed leaves them as they are: emptied, the ledger would have the server apply every migration again. A new table of that kind is left out of `empty` the same way.
- **No suite starts from a seed yet.** `tests/webspicy` could now name one, but installing a seed empties the database, and on a laptop that is the development database. See its status.
