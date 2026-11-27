# 0001 — The server creates its schema

## Context

saras runs on PostgreSQL in two ways with one schema and one set of queries: a server, when `DATABASE_URL` is set, and an embedded PostgreSQL ([PGlite](https://pglite.dev)) inside the server's own process otherwise. The embedded one is what `npm start` uses, and what the tests run on by default: nothing to install to try the tool (US-84).

The repository's layout otherwise expects the schema, the grants and the seeds to be files of a data component, applied by `dbagent` as a one-shot service the others wait for.

## Decision

The server creates its schema when it starts: `software/saras/src/tooling/db/schema.ts`, statements that can be run again. There is no migration service in the stack.

`dbagent` is in the stack all the same, as `software/storage`, for the other half of what it does: the seeds. It waits for the server, since a seed needs its tables.

## Alternatives

- **`dbagent` owns the schema.** It reaches a PostgreSQL server over the network; the embedded database has no network face. The schema would exist twice, as Sequel migrations for the server and as SQL for the embedded mode, held equal by a test at best.
- **Drop the embedded mode.** Trying saras would need a PostgreSQL server, and so would the demo and every test run.

## Consequences

- The schema only ever grows by statements that are safe to run on a database that already has them. A change that is not (renaming a column, moving data) has no place to live yet.
- A seed is held to the schema by nothing but being loaded: CI applies the demo seed to the stack it started.
- A black-box suite can name the state it starts from, but installing a seed empties the database, which on a laptop is the development one. `tests/webspicy` therefore still specifies only what reads and what refuses; the tests that need a known state start their own application, in `software/saras/test/integration/`. (No longer so: since [decision 0017](0017-the-operations-are-specified-by-predicates.md) the black-box suite is `tests/operations`, which runs on a stack whose database is its own and specifies what changes the state too.)
- The server needs the right to create tables in production.

## What would reverse this

The first change of schema that cannot be written as a statement safe to repeat. That is the moment to give the schema to `dbagent` too, for the server mode, and to decide then whether the embedded mode is created from the same files or let go.

That change came, and the schema is now a list of migrations: [decision 0010](0010-the-server-migrates-its-database-and-several-may-share-it.md). The server still creates and changes its schema itself, on both databases, and `dbagent` still owns the seeds only: what is reversed here is "statements that can be run again".
