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
- That what is given is of the type of its input is a precondition of every operation, said by its `input:` alone: no operation states it as a clause, nor repeats a constraint of the type as one. A counterexample is for a precondition the operation says, and its input is of the type, or it violates more than what it is for. Where what the type refuses matters, a constraint labelled with a code (a blank name, `boards.nameRequired`), a counterexample says `for: <the type>` (`for: BoardGiven`), sends what is not one, and is answered with that code; otherwise none is written.
- Ill-typed inputs are for opspicy to make, not for the suite to list: a valid example, mutated so that its input violates the type (a field missing, one more, a text for a number, a list repeated, a constraint broken), is answered `400` and changes nothing. Ideally opspicy fuzzes them on demand, not by default: [O1](../upstream/opspicy.md#o1--counterexamples-made-from-the-input-type-on-demand). Until it does, the server's own tests hold the refusals ([`test/unit/inputs.test.ts`](../../software/saras/test/unit/inputs.test.ts), [`test/integration/boards.test.ts`](../../software/saras/test/integration/boards.test.ts)).
- The image of saras is built from the root of the repository, which [`.dockerignore`](../../.dockerignore) narrows to `software/saras` and the specification, until emb takes named build contexts ([M1](../upstream/emb.md#m1--an-image-built-with-named-build-contexts)); on a checkout, `software/saras/specification` links to it.

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
- What the reductions of the domain did for an input is gone with them. What remains of them is listed below, with the other gaps.

## Where the code falls short of it

The ideal: an input that passes its type is safe for all the code downstream, which then checks nothing again and reduces nothing. Each gap below is a place where that promise is not kept yet: what lets it through, and what would close it. A gap that closes is struck from this list.

1. **The areas not moved.** Every route but those of boards names no operation, and takes what it is given: its domain still reduces (`computations/given.ts`, `searchGiven`, `attributeValuesGiven`) and reads a number as `Number(id) || 0` (`state/emails.ts`, `mailboxes.ts`, `members.ts`, `invitations.ts`, `prompts.ts`). Closes area by area: the routes name their operations, the types are tightened, the reductions go.
2. **The keys of a map.** Elo checks the values of `{ ...: T }`, not its keys, and has no function that reads them. The attributes of a board's filter are keyed by `status` or a number, and the type cannot say so: an attribute named `colour` passes, the domain drops it (`filterKept`), and `conditionsOf` still writes the key as `Number(key)`. EditBoard's postcondition (`sameFilter`) compares attributes as given, so no example of it can show the drop. Closes with [E1](../upstream/elo.md#e1--a-type-for-the-keys-of-a-map) of Elo: the key is then refused `400` and the domain drops nothing.
3. **One entry, several operations.** `PUT /organization` (six operations), `PUT /settings`, `POST /emails/:id/status`, `POST /emails/:id/assist` (three each), `PUT /members/:id` and `POST /prompts` (two each) serve operations whose inputs have different types, and the interface sends some of them merged. Closes with a route that tries each operation's type and serves the one it fits, the interface sending one operation per request.
4. **Routes the specification does not name**: `GET /emails/:id/attachments/:index` and `GET /attributes/skill`. Nothing declares their input. Closes when they are specified.
5. **A field missing is not its constraint failing.** A constraint labelled with a code is refused with it when the field is there and breaks it (`name: "  "` → `boards.nameRequired`); a field left out is refused `request.invalid` at its place. Closes with [E2](../upstream/elo.md#e2--the-label-of-a-constraint-when-the-field-is-missing) of Elo.
6. **TypeScript says less than Elo, and nothing holds them together.** `shared/` says a field and its type, and `SomeOf<T>` a list of one at least; a length, a positive number, a list without repeats are Elo's alone, and no test compares the two descriptions of a type. A route's `Handle<Input>` is the TypeScript the check is trusted to give. Closes with the TypeScript of an input derived from its Elo type, or a test that compares them.
7. **Types declared before they are used.** The areas' types form one prelude, in the order of their names: an output of boards cannot name `EmailSummary`, which emails declares later, and says `[.]`. Closes with [E4](../upstream/elo.md#e4--types-that-refer-to-types-declared-after-them) of Elo or [O2](../upstream/opspicy.md#o2--the-types-of-an-area-may-import-those-of-another) of opspicy, or with the types two areas use moved to `_shared/`.
8. **Ill-typed inputs are not run against the stack.** opspicy runs the examples and the counterexamples written, and few are written `for:` a type: a blank name, a status or a writing that is none of those the type says. The refusals are held by the server's tests alone (`test/unit/inputs.test.ts`, `test/integration/boards.test.ts`). Closes with [O1](../upstream/opspicy.md#o1--counterexamples-made-from-the-input-type-on-demand) of opspicy; that an example's input fits its type is held by the same test until [O3](../upstream/opspicy.md#o3----check-says-when-an-examples-input-is-not-of-its-type).

## What would reverse it

A specification that must describe more than one server, or a version of saras other than the one it is read with: its types would then be the client's, and the server's its own, held together by a test.
