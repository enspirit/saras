# 0002 — One component for the server and its interface

## Context

`software/` holds what we write and ship, one directory per component, each with its contract. saras is one npm package: the server (`src/`), the browser code (`web/`), the domain objects both use (`shared/`), and the tests of all three. The pure decisions are already apart, in `src/domain/computations/`, and the browser is already a client of the API with no other path to the server.

## Decision

One component, `software/saras`, with one image. The lines inside it are held by tests rather than by packages: `shared/` imports nothing and is the only thing the server and the browser have in common, the browser imports nothing of the server, the domain knows nothing of HTTP (`tests/harness`, `test/unit/shared-types.test.ts`).

## Alternatives

- **A domain library** (`software/core`: `shared/` and the computations), **an API** and **a web interface**, as three workspace packages. It makes each boundary an install error instead of a test, at the price of a workspace, of a build order, and of a Dockerfile that knows all three, for a product one person can read in an afternoon.

## What would reverse this

A second thing that ships and needs the domain: another client of the computations (a command-line tool, a worker with its own image), or an interface built and deployed apart from the server. The computations still importing from the tooling (`text.ts`, `html.ts`, `crypto.ts`…) is what to untangle first.
