# 0001 — The server creates its schema

## Context

saras runs on PostgreSQL in two ways with one schema and one set of queries: a server, when `DATABASE_URL` is set, and an embedded PostgreSQL ([PGlite](https://pglite.dev)) inside the server's own process otherwise. The embedded one is what `npm start` and `npm run demo` use, and what the tests run on by default: nothing to install to try the tool (US-84).

The repository's layout otherwise expects the schema, the grants and the seeds to be files of a data component, applied by `dbagent` as a one-shot service the others wait for.

## Decision

The server creates its schema when it starts: `software/saras/src/tooling/db/schema.ts`, statements that can be run again. There is no migration service in the stack, and no `software/storage` component.

## Alternatives

- **`dbagent` owns the schema.** It reaches a PostgreSQL server over the network; the embedded database has no network face. The schema would exist twice, as Sequel migrations for the server and as SQL for the embedded mode, held equal by a test at best.
- **Drop the embedded mode.** Trying saras would need a PostgreSQL server, and so would the demo and every test run.

## Consequences

- The schema only ever grows by statements that are safe to run on a database that already has them. A change that is not (renaming a column, moving data) has no place to live yet.
- A black-box suite cannot reset the state through a seed endpoint: there is none. `tests/webspicy` therefore specifies only what reads and what refuses; the tests that need a known state start their own application, in `software/saras/test/integration/`.
- The server needs the right to create tables in production.

## What would reverse this

The first change of schema that cannot be written as a statement safe to repeat; or the day `tests/webspicy` is to specify an operation that succeeds in writing, and so needs to put the database in a named state. Either one is the moment to give the schema to `dbagent` for the server mode, and to decide then whether the embedded mode is created from the same files or let go.
