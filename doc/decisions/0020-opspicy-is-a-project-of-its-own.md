# 0020 — opspicy is a project of its own, and saras takes it as an image

## Context

[Decision 0017](0017-the-operations-are-specified-by-predicates.md) put what reads the specifications of the operations and runs them in `vendor/opspicy`, apart from the suite and knowing nothing of saras, and said that its leaving for a project of its own would be the same decision carried on.

It had outgrown the directory. Beside the runner it held an explorer, a server and an API, and more tests than the suite has files: 150 with no server, 73 in a real browser. All of it was built, checked and released by this repository: a change to the page of the explorer went through saras's review and saras's stack, and a second project wanting it would have copied it.

## Decision

opspicy lives at [github.com/enspirit/opspicy](https://github.com/enspirit/opspicy), with the history it had here, its own tests and its own releases. `vendor/` is gone.

saras takes it as **the image of one of its versions**, `enspirit/opspicy:<version>`, named once: `OPSPICY_IMAGE` in [`.env.commons`](../../.env.commons).

- The image of [`tests/operations`](../../tests/operations/) is built on it, and the suite is run in it, on the network of the stack, as before.
- The tasks that need no stack run it as a tool on the checkout, with `docker run`: reading the suite and type-checking its code (`operations:lint`), writing the explorer, serving it.
- `config.ts` imports its one type from where the image has it, and is type-checked there.
- Taking another version is changing that one line: `emb run lint` and `emb run test:operations` say what it changed.

## Alternatives

- **A git submodule in `vendor/opspicy`, at a tag.** Nothing to publish, and every path of this repository stays as it was. But a checkout and CI then need `--recursive`, a version is a commit, and the sources of a tool stay in the tree, where the next fix would be written, and lost.
- **Its package on npm**, `@enspirit/opspicy`, which exists: compiled when it is published, since Node refuses to run TypeScript under a `node_modules`. It is how somebody reads the suite and comments it with Node alone. But the suite runs in a container, on the network of the stack, and CI needs nothing but docker there: an image is what that takes, and one way of taking opspicy is enough for the tasks.
- **Stay vendored.** What there was.

## Consequences

- `emb run lint` needs docker, and pulls the image the first time. It needed Node alone.
- Nothing of opspicy is installed on a checkout: `opspicy:setup`, `opspicy:lint`, `opspicy:test` and the browser tests left this repository's tasks and its CI, which no longer runs them. opspicy's own does.
- A fault found in opspicy is fixed there, released, and taken here by a line. The line is the one place that says which opspicy a run was made with.
- The reference of the notation is no longer in this repository: the documents link to it where it is, and [`tests/harness`](../../tests/harness/) does not hold those links, nor the rule that what is vendored imports nothing of the rest, which went with `vendor/`.
- Running one case from the page of the explorer needs its API, which is offered on the machine its server runs on: not from the image. It is done with opspicy installed from npm, on a stack whose database may be emptied.

## What would reverse it

opspicy and the suite changing together so often that each change costs a release: a submodule would then be the lighter of the two. Or a registry that cannot be reached from where the suites run.
