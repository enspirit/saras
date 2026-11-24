# 0010 — The server migrates its database, and several may share one

## Context

The server created its schema by running, each time it started, statements safe to run again ([decision 0001](0001-the-server-creates-its-schema.md)). That decision named what would reverse it: the first change that cannot be written so. It came as a column to remove: `emails.suggested_prompt_id`, which nothing reads since [decision 0009](0009-the-prompt-that-suits-follows-from-attributes.md).

saras is in production, and two more things are asked of it. That starting the latest image is still all an upgrade takes. And that a larger installation can run several servers on one database, which the timers and the guards a server kept in its own memory forbade: the chart ran one replica, and not as a value ([decision 0007](0007-a-helm-chart-for-operators.md)).

## Decision

**The schema is a list of migrations, and the server applies those a database lacks.** `software/saras/src/tooling/db/migrations/`, one file each, numbered, added at the end and never edited once released. What was applied is written in a ledger, `schema_migrations`. A migration is applied in a transaction of its own, under a lock of the database: servers that start together apply each once. The first, `0001-baseline`, is the schema as it stood, every statement still safe to run again: it adopts the databases that existed before.

**A migration leaves the version before it working.** While an upgrade is under way, servers of two versions share the database. What a version stops using is removed by a later migration, in a later release. For the same reason a server that finds migrations it does not know says so and starts: an upgrade can be taken back.

**What the server does on its own is due in the database, not in a server's memory.** `scheduled_tasks` holds when each task is next due; taking the turn is one statement, which one server wins. A restart does not start the count again.

**What must be done by one at a time is held by a lock of the database**: the fetch of a mailbox, the hand-over of a reply. A session's advisory lock on a PostgreSQL server, given up by a server that dies; the memory of the one process on the embedded database.

**One image, three roles**: `ROLES=migrate,web,clock`, all three unless said otherwise. One process is a whole installation, as before. Several may run with all three, or share them out; `migrate` alone applies the migrations and ends, and a process without it waits for the database to be migrated.

None of this is a setting that loosens a guarantee: whatever `ROLES` and the number of servers, a migration is applied once, a task runs once, a reply is sent once.

## Alternatives

- **`dbagent` owns the schema**, as decision 0001 foresaw. The embedded database has no network face, so the schema would exist twice; and an upgrade would be two things to start in order, where the image alone is what ships ([decision 0004](0004-saras-ships-as-an-image.md)).
- **A migration job run before the servers** (a Helm hook, an init container), the servers never migrating. It is what `ROLES=migrate` allows to whoever wants it. As the only way, it gives up "start the latest version and it works", and a hook runs before the PostgreSQL server of the release exists ([decision 0008](0008-the-chart-can-run-a-postgresql-server.md)).
- **One server keeps the clock, by its configuration**, the others not. Nothing then refuses two clocks, or none: the guarantee would be a setting. `ROLES` only says where the work is done.
- **A lease, as a column with a date**, for the fetch of a mailbox. A server that dies leaves it taken until the date passes, and whoever waits for it waits that long.
- **A leader elected among the servers.** More than three tasks an hour deserve.
- **Refusing to start on a database migrated by a newer version.** Safer against a version two releases old; it also refuses the way back from an upgrade that went wrong.

## Consequences

- A change of schema is a new file, and may be anything SQL can say in a transaction. The schema is no longer read in one place: it is what the migrations add up to.
- The server still needs the right to change its schema, unless a process with `ROLES=migrate` and credentials of its own is the only one that has it.
- The ledger and `scheduled_tasks` are in no seed: installing one leaves them as they are (`software/storage`).
- A PostgreSQL server sees more connections from each saras: beside its pool, up to five that hold locks.
- The brake on wrong guesses is still counted per server: with several, a visitor has as many times the guesses. Listed with the deviations in [`doc/2-operations.md`](../2-operations.md).
- The development stack watches the sources: a migration is applied to the development database when its file is saved, and is not applied again once edited.
- Nothing holds "leaves the version before it working" but whoever writes the migration.

## What would reverse this

A migration that cannot run in a transaction, or that takes longer than a server may take to start: it is then applied apart, by something that is not a server starting. Or work on the clock that one server cannot do within its turn: the tasks become a queue, with workers.
