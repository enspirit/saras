# harness

The checks on the repository itself. A rule that matters is checked, not remembered: each scanner here holds one, and `emb run lint` runs them.

## Public interface

Its tasks, and nothing else:

```sh
emb run harness:lint   # run the scanners over the repository
emb run harness:test   # the scanners' own cases
```

| Scanner | Holds |
| --- | --- |
| [`links.ts`](links.ts) | Every relative link of every markdown file leads to a file or a directory that exists. |
| [`boundaries.ts`](boundaries.ts) | Who may not import whom. The rules are listed in [`check.ts`](check.ts): the domain knows nothing of HTTP; the browser imports nothing of the server; the server ships without the browser code and the tests; the assistant knows neither the domain nor the tooling, and the tooling does not reach it; `shared/` depends on nothing but itself. |

## Depends on

Node.js and git, and no package: it runs on a checkout, before anything is installed. It reads the files of the other components; it imports none.

## Must not

1. **Pass on something it did not look at**: each scanner has a table of cases, with at least one that it must flag.
2. **Hold a rule the repository breaks**: a rule is added with the fix of what it flags.
3. **Need the stack, or a package.**

## Harness

`emb run harness:test`. Green means every case of every scanner passes.

## Status

> **In flight:** nothing.

Two scanners. Nothing holds yet that, inside the domain, only `advice/` and the skill to download use the assistant. The size limits and the single declaration of the domain objects are still checked inside [`software/saras`](../../software/saras/) (`test/unit/size.test.ts`, `shared-types.test.ts`); a rule that the computations import no tooling would flag today's code, and is not held yet.
