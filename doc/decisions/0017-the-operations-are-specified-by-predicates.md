# 0017 — The operations are specified by predicates, and run by opspicy

## Context

The black-box specification was a webspicy suite: one YAML file per URL, schemas in Finitio, conditions as sentences, each backed by a Ruby class when it was to be checked. It specified two routes, and could go no further: it had no state to start from ([decision 0001](0001-the-server-creates-its-schema.md)), and installing a seed empties the database, which on a laptop is the development one.

Three things were wanted of it before the data model changes under the API ([the brief](../multi-organisation-brief.md)):

- that it start each case from a named state, and say what state the operation reaches;
- that a specification read as the operation it specifies: its clauses, in the words of [the inventory](../2-operations.md), and not as a URL with examples;
- that giving a sentence a meaning cost a line, not a class with a regular expression, an `instrument` and a `check!`.

## Decision

[`tests/operations`](../../tests/operations/) replaces it, and `vendor/opspicy` runs it (since [decision 0020](0020-opspicy-is-a-project-of-its-own.md), [a project of its own](https://github.com/enspirit/opspicy)): what webspicy would be, written again around the operation. The two are apart: opspicy holds the notation and knows nothing of saras, which the suite tells it how to meet.

- **One file per operation**, named after it, in the tree of `src/domain/`. It holds the four clauses that can be checked, as lists of sentences, then examples and counterexamples.
- **A sentence has a meaning**, written beside it, or once as a condition for the sentences several operations say: an expression in [Elo](https://elo-lang.org), true or false of the input, the output, the state before and the state after. It is said with predicates and functions the suite names once: `seesBoard(id)`, `board(id)`. A sentence with no meaning is told and reported as not checked.
- **The state is what can be observed**: through the routes that read, as the requester and as anybody else of the Background; through the tables of the database, read and never written, for what no route tells; and what the runner itself knows, such as a token the seed planted.
- **Nothing is instrumented.** A case names its Background, a seed and who calls, and the suite *checks* its preconditions: all of them hold before an example, and exactly the one a counterexample is for does not. A refusal is checked to have changed nothing, in every route and every table observed.
- **A condition may say how it is violated**, which gives a counterexample to every operation that says it.
- **The suite runs on the stack under the suites**, never on the development one: it refuses a stack that does not say its database may be emptied.

## Alternatives

- **Keep webspicy and give it a start state.** The seed and the stack under the suites would have served it as well. But a postcondition on the state reached is a Ruby class holding a second request, one per sentence, and "the state is unchanged" is one more per operation: the cost that kept the two specifications it had from checking any of their conditions.
- **Keep webspicy as the engine**, with one generic condition evaluating Elo compiled to Ruby. Its hooks see one request and its answer: the state before, the state after and who else looks on would have been bent into them, and the image would have needed two toolchains to run one suite.
- **Specify in the tests of the component** (`software/saras/test/integration/`). They share the product's types and start the application themselves: they cannot say the types are wrong, and do not survive a rewrite of what they import.
- **A notation of our own, or Markdown**, for the files. YAML needs no parser of ours and editors know it; what it costs is quoting an expression that starts with `!`.

## Consequences

- The suite is in the product's language, where webspicy was not. What kept it black-box by construction is now a rule: it imports nothing of `software/saras`, which [`tests/harness`](../../tests/harness/) checks, and restates the types of what is exchanged in Elo.
- It reads the database. A clause over a table moves when the schema does, which a clause over a route does not: the tables are for what no route tells, and name nothing of who belongs to which organisation.
- Every case installs a seed, about a tenth of a second on a laptop. The suite never runs on a database somebody cares about; CI runs it last, on the stack it started.
- Finitio, the generated OpenAPI document and webspicy's mock are gone with it. Nothing used the last two.
- A seed under `test/` carries what the demo cannot: the access to a mailbox, sealed with the secret of the stack under the suites.
- What the stack has no stand-in for stays with the integration tests: the LLM, a second factor, the lock-out, the server's own clock.

## What would reverse it

webspicy gaining conditions decided over an observed state, before and after, at the price of a line: the files here would translate to it, sentence by sentence, and a tool maintained by more than one project is worth more than one we vendor. opspicy leaving this repository for a project of its own is the same decision carried on, not its reversal. Or a second client of the API in another language, for which a specification in the product's own toolchain says too little.
