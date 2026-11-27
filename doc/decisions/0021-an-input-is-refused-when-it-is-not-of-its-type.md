# 0021 — An input is refused when it is not of its type, which the specification declares for the server too

## Context

The specification of the operations ([`tests/operations`](../../tests/operations/)) gives each operation the type of its input, in Elo, and opspicy holds that every example's input is of it. The server did not read those types. A route handed the body, the query and the parameters of its path to the operation as they came, and the domain reduced them: a text was trimmed and cut, a list that was not one became an empty one, `"yes"` was `false`, a number that was not one named nothing, a field nobody knew was dropped. Nothing was refused for its shape, so a client sending the wrong thing was answered `200` and never told.

That made three descriptions of one input: the type of the specification, the TypeScript of [`shared/`](../../software/saras/shared/), and the reductions in `domain/computations/`, kept in step by hand. The types of the specification were also loose (`.`, `{ … :? . }`), since nothing but the examples was held to them.

## Decision

**The server checks what an operation is given against the type the specification declares for its input, before the operation sees it.** One text of types serves the specification and the server: [`tests/operations/specification`](../../tests/operations/specification/) is an executable specification, not an asset of the tests.

- A route names its operation (`{ operation: 'CreateBoard', handle }`): its method and its path are the operation's `entry`, and its input type is the operation's `input`. The server reads them when it starts ([`src/tooling/specification.ts`](../../software/saras/src/tooling/specification.ts)) and refuses to start when a route names an operation the specification does not, or the type of an input is not declared.
- What an operation is given is what opspicy sends it: the parameters of its path, with its body, or its query for a `GET`. Elo checks it against the type and converts it ([`src/tooling/http/inputs.ts`](../../software/saras/src/tooling/http/inputs.ts)): the number of a path becomes an `Int`.
- What does not fit is refused `400`. A constraint labelled with a code of the server is refused with that code (`String(n | 'boards.nameRequired': !isBlank(n))`); anything else with `request.invalid` and where it is (`.filter.mailbox`), never with what was given.
- The domain takes what it is given at its type, and reduces nothing: what it still does to an input is what an operation says (a filter keeps the attributes we know), not what a type says.
- Types are tight. A text says how long it may be and whether it may be blank, a number what it names, a list whether it may be empty or repeat itself; `.` is for what is truly anything, and rare. TypeScript says the same where it can: a list of one at least is `SomeOf<T>`.
- A counterexample of a type refusal is `for` the precondition `( ) what is given is of the type of its input`, which has no formaldef: opspicy cannot yet say it.
- The image of saras is built from the root of the repository, which [`.dockerignore`](../../.dockerignore) narrows to `software/saras` and the specification; on a checkout, `software/saras/specification` links to it.

The areas move to it one at a time. A route that names no operation yet is mounted as before, unchecked.

## Alternatives

- **JSON Schema, checked by a library.** A fourth description of every input, with no constraint richer than a pattern or a length, and nothing that keeps it in step with the specification.
- **The server keeps types of its own, held to the specification by a test.** The specification would stay a restatement in the client's own words, so that a divergence is a finding. But two texts of every type, for one meaning, is what this decision ends; what the server answers is still held to the output types by opspicy.
- **opspicy generates a proxy that checks, then calls the operation.** A test tool in the path of production: a version of opspicy would change what the product accepts, and [decision 0020](0020-opspicy-is-a-project-of-its-own.md) takes it as a tool of the suite.
- **Elo generates the checks, one module per type.** Nothing to generate: Elo compiles a type to its check when the server starts, in milliseconds.

## Consequences

- A client that sends what an operation does not take is told so. The interface sends what the types say: a trimmed name, no empty list.
- A change of the specification's types is a change of the server's behaviour, reviewed as such, and the image is rebuilt when the specification changes.
- [`test/unit/inputs.test.ts`](../../software/saras/test/unit/inputs.test.ts) holds the specification to itself: the input of every example of an operation the server serves is of its type, and a counterexample its type refuses is refused with the code it says.
- Names of types are one namespace across the areas, as opspicy reads them: two areas cannot both declare a `Mailboxes`.
- What the reductions of the domain did for an input is gone with them. What remains of them (`attributeValuesGiven`, `clipped`, `searchGiven`, …) is for the areas not moved yet.

## What would reverse it

A specification that must describe more than one server, or a version of saras other than the one it is read with: its types would then be the client's, and the server's its own, held together by a test.
