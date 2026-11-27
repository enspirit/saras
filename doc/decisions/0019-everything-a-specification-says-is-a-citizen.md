# 0019 — Everything a specification says is a citizen: a name, a description, and for some a formaldef

## Context

The notation of [decision 0017](0017-the-operations-are-specified-by-predicates.md) grew one form per thing it said. A clause was `sentence: Elo`; a predicate `name(given): Elo`; a condition `says` and `means`; an operation was named by `operation:`; a type was Elo with a comment; an area was a directory; an agent a word on each operation; a Background a row of a README. What each was *for* was said in YAML comments, which nothing reads.

The explorer of a suite paid for it: five renderings, one per form, two ways of folding a formal definition, and no description to show of a predicate, a function or a type. Three things were not in the model at all: the areas, the agents, and what triggers an operation (`ReqTrig`), which was accepted and read by nothing.

## Decision

Everything a specification says is a **citizen**, and every citizen has the same three attributes: a **name**, a **description**, and for some a formal definition, its **formaldef**. [opspicy's reference of a suite](https://github.com/enspirit/opspicy/blob/main/doc/suite.md#the-metamodel-citizens) lists them.

- **One long form**, the same for all: `name`, `description`, `formaldef`, then what the kind adds. A description is required: a citizen without one keeps the suite from being read.
- **A sentence is its own description.** A clause, a condition and a case are known by what they say, so they need no name: one is named after where it stands (`CreateBoard/ReqPre/2`). The short forms of a sentence, alone or as `sentence: formaldef`, say the same as the long one. A case keeps `when` for its sentence, which reads with `given` and `then`.
- **`description` and `formaldef` are the words**, with no alias: a condition no longer `says` and `means`, and an operation has a `name`.
- **The mark of a sentence** (`(x)`, `(+)`, `( )`) stays in its short forms, a declaration that is checked. The long form says none: it is what the sentence is.
- **Areas, agents and Backgrounds are said**, each in a file of the specification: `areas.yml`, `agents.yml`, `backgrounds.yml`. The state, the relations and the actors are citizens too, and so is a type, whose description is the comment above it.
- **An actor is an agent** (`is`), and an agent may be another: an example is called by somebody who is the agent of its operation.
- **An observation stays a kind of operation**, told by where it is filed.
- **`ReqTrig` is a clause**, read and told: one call shows nothing of what triggers an operation.

## Alternatives

- **Keep the forms, and teach the explorer each.** It was what there was. Every new kind would have been a new rendering, and the descriptions would have stayed in comments.
- **Read the comments as descriptions**, in YAML as in Elo. No file would have changed. But a comment above a list of three predicates describes which of them is anybody's guess, and a YAML parser gives comments to nobody: the reader would have been ours.
- **A name for every sentence.** 733 clauses and 502 cases named by hand, to say again what the sentence says. The name a sentence is given by its place serves an address as well.
- **Keep `says` and `means` as aliases** of `description` and `formaldef`. Two ways to say one thing, in a notation one suite uses: the files were translated instead, and proved to read as the same suite, clause by clause.
- **Name a predicate apart from what it is given** (`name: board`, `parameters: [id]`). It is called `board(id)` wherever it is said, so that is its name.

## Consequences

- Every file of the suite changed form, and none changed what it says: the operations, their clauses and their cases read as they did, and the complete run passes as before.
- A predicate or a function takes three lines where it took one. Its description is now read, checked to be there, and shown.
- What was a comment is a description, and 86 were written that nobody had: of predicates, functions, types, states and relations. The areas and the actors were described for the first time.
- The Backgrounds left the README of the suite for `backgrounds.yml`: a case that names a seed nobody describes is not read, where it failed when run.
- An operation performed by somebody the inventory does not name is not read, and neither is an example called by somebody who is not its agent.
- The explorer has one pattern, a row with a name and a description and the formaldef folded under it, and every citizen an address of its own.
- The agents of `agents.yml` are those that call. What performs an operation on its own (the server on its clock) is still said only by a `ReqTrig`.

## What would reverse it

A kind of citizen that the three attributes do not fit: one whose formal definition is two things of equal standing, say, or whose description must differ by reader. A relation is already at the edge, with its table, its key and its attributes beside a description and no formaldef. Or the suite growing past what a person keeps in the long form, which is when a notation of our own (0017's last alternative) would be worth its parser.
