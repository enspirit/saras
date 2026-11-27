# storage

The seeds: the datasets the stack's database is put into, loaded by [`dbagent`](https://github.com/enspirit/dbagent). It is responsible for one thing: that a named state of saras can be reached with one command, on a laptop and under the suites.

It also draws the schema of that database, as pages to read: `emb run storage:db.spy`.

It does not own the schema. saras migrates its database when it starts ([decision 0010](../../doc/decisions/0010-the-server-migrates-its-database-and-several-may-share-it.md)); the compose service `storage` waits for it, and a seed fills tables that are already there.

## Public interface

Its seeds, by id, its tasks, and the pages of the schema. Nothing else.

| Seed | Is | Load it with |
| --- | --- | --- |
| `demo` | One organisation, **Brightwater Consulting**: its administrator, a **Topic** attribute decided by a rule, a **Who** attribute set by hand, a rule for the **Priority** it started with, two boards, a prompt. Not its mailbox, whose access a seed cannot carry (see Status). A slice: everything in it has an id from 900001 on. | `emb run demo`: added to whatever the database holds, or put back as it was, then its mailbox connected |
| `empty` | Every table, with no row. The root every other seed inherits. | `emb run storage:db.seed`: **empties the database** |
| `test/base` | The Background of the [operations suite](../../tests/operations/README.md), which says what it holds: two organisations, their members, a mailbox with its emails fetched, boards, prompts, attributes, an invitation and a link to a new password. Its hook gives the two tokens the suite knows, dates the emails from the day it is installed, and numbers from 5001 what is made after it. | The suite, before every case: **empties the database** |
| `test/unfetched`, `test/unconnected` | `test/base` with no email fetched; with no mailbox. They hold the tables they empty and nothing else. | The same |

Sign in to the demo with `demo@saras.example` and `saras-demo-password`.

```sh
emb run demo                   # the demo: this seed, then the mailbox of the stack connected to it
emb run storage:demo.rebuild   # rebuild data/demo by setting the organisation up through the API
emb run storage:test.rebuild   # rebuild data/test/base by arriving at the suite's Background through the API
emb run storage:db.repl        # psql on the stack's database
emb run storage:db.tables      # the tables, fewest dependencies first
emb run storage:db.spy         # the schema as pages: open software/storage/schema/spy/index.html
S=<seed> emb run storage:db.apply   # add a seed as a slice: nothing else is emptied
S=<seed> emb run storage:db.seed    # install a seed: EMPTIES every table first. Asks to type "empty"
S=<seed> emb run storage:db.flush   # write the database as a seed
```

`db.spy` has [SchemaSpy](https://schemaspy.org) read the schema of the stack's database, as the server migrated it, and write tables, columns, constraints and diagrams in `schema/spy/`, made anew each time and never committed. The development stack mounts `schema/`, so the pages are read from the checkout: the service publishes no port to serve them on. They say what the schema is and nothing of what the database holds, not even how many rows.

Other components reach it at `http://storage:9292`, on the compose network only: `POST /seeds/apply?id=demo`, `POST /seeds/install?id=empty`.

## Depends on

| | |
| --- | --- |
| `enspirit/dbagent` | The image, pinned in `docker-compose.base.yml`. It reads `data/`, mounted, and holds SchemaSpy, which writes in `schema/`, mounted by `docker-compose.devel.yml`. |
| PostgreSQL | The stack's database. |
| [`software/saras`](../saras/) | The schema, which it migrates when it starts. And the way to the demo's state: `scripts/demo-organisation.ts` sets the organisation up through the API, which is what `demo.rebuild` flushes. |
| [`tests/operations`](../../tests/operations/) | The way to the state of `test/base`: `backgrounds/base.ts` arrives at it through the API, which is what `test.rebuild` flushes. |
| [`world/mailbox`](../../world/mailbox/) | The mailbox `test/base` has connected and fetched. |

## Must not

1. **Be deployed, routed or published.** Its seed endpoint empties tables. The service has no published port and no image of ours.
2. **Empty a database without being asked twice.** Every task that installs asks for a word to be typed; the demo is applied, which empties nothing but the demo itself.
3. **Hold a secret that opens anything real.** What the demo seed carries is listed under Status, and is all of it.
4. **Hold what another agent controls.** The emails of the demo are the mailbox's ([`world/mailbox`](../../world/mailbox/)): saras fetches them, and the seed has none.
5. **Be written by hand.** A seed's rows are flushed from a state that was arrived at through the API: `demo.rebuild`, `test.rebuild`. The hooks and `metadata.json` are authored, and so is a file that says a table is empty (`[]`), which is all `test/unfetched` and `test/unconnected` hold.

## Harness

`emb run storage:demo.rebuild` is also its test: in a stack of its own, it installs `empty`, applies `demo` twice, and signs in as the demo account. CI runs `emb run demo` on the stack it started, which fails the day the seed no longer fits the schema. The seeds under `test/` are held by the operations suite, which installs one before every case.

## Status

> **In flight:** nothing.

- **The demo's mailbox is not in the seed.** The access to a mailbox is sealed with the server's `APP_SECRET`: a seed could carry it for one secret only. So the seed holds the organisation, and `emb run demo` connects the mailbox of the stack through the API, whatever the secret.
- **What the seed carries that looks like a credential**, and is one only for the demo: the hash of the published demo password.
- **Two tables are the server's alone, and in no seed**: `schema_migrations`, the ledger of what was applied to the schema, and `scheduled_tasks`, when what the server does on its own is next due. `empty` does not name them, so installing a seed leaves them as they are: emptied, the ledger would have the server apply every migration again. A new table of that kind is left out of `empty` the same way.
- **`rake db:spy`, run by hand in the container, prints the password of the database**: dbagent 3.11.0 echoes the command it gives SchemaSpy, `-p` and all. `emb run storage:db.spy` keeps that line from the terminal and from emb's log of the task; use it rather than the rake task.
- **The pages miss two things**, which SchemaSpy 6.2.4 asks PostgreSQL 16 for in the words of an older one, and says so in two errors each time: the comment of the database, and the routines. The schema has neither.
- **Under the suites the pages stay in the container**: only the development stack mounts `schema/`.
- **A seed under `test/` carries the access to a mailbox**, which the demo cannot: it is sealed with the `APP_SECRET` of `software/saras/env/test.env`, so it opens the mailbox of the stack under the suites, and nothing anywhere else.
