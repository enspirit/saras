# opspicy — what saras asks of it

[opspicy](https://github.com/enspirit/opspicy), taken as the image `enspirit/opspicy:0.3.0` ([decision 0020](../decisions/0020-opspicy-is-a-project-of-its-own.md)). How an entry is written: [`README.md`](README.md).

## O1 — Counterexamples made from the input type, on demand

**Status**: to file.

**What saras needs.** That what is given is of the type of the operation's `input` is a precondition of every operation, said by `input:` alone: no specification states it as a clause ([decision 0021](../decisions/0021-an-input-is-refused-when-it-is-not-of-its-type.md)). Since 0.3.0 a counterexample may be `for: <the type>`, and saras writes one where a constraint the type labels with a code matters (a blank name); the rest of what the type refuses no run sends, and the refusals are held by the server's own tests only. Gap 8 of decision 0021.

**What is asked.** That opspicy makes those counterexamples itself, as it makes the ones a condition gives, but only when asked (say `ROBUST=fuzzed`, or a flag of its own), never by default: they are many, and a run stays the size the suite says.

- **From a valid example**: its Background, its actor and its input, mutated so that the input violates the type in one way, and only one: an attribute required left out, one the type does not name added, a value of another kind (a text for an `Int`, a list for a text), a list that repeats itself where the type says each once, a constraint broken (a blank text where one is refused, a number past its bound). Parameters of the path included: `{ id: first }` for `DELETE /api/boards/:id`.
- **What it checks**: the answer has the status and the type of a refusal (`400`, the suite's `refusal` of `config.ts`), and nothing changed, as of any counterexample. Where the broken constraint is labelled with a code, the code is the label; otherwise the suite says which code a type refusal has (saras: `request.invalid`).
- **How it is told**: `[from the type]`, as `[from a condition]` is, with the mutation in a few words (`.shared: a text for a Bool`).

**What saras changes once it is there.** The type refusals of `test/integration/boards.test.ts` that only stand in for these go; CI runs the fuzzed cases once, in the complete run.

## O2 — The types of an area may import those of another

**Status**: idea.

**What saras needs.** The types of the areas are read as one text, `_shared/` first and then each area in the order of its name, so a type can only use what an area before it declares: boards cannot name `EmailSummary`, which `emails/` declares, and says `[.]`. Gap 7 of [decision 0021](../decisions/0021-an-input-is-refused-when-it-is-not-of-its-type.md#where-the-code-falls-short-of-it). The server of saras reads the same files in the same order.

**What is asked.** Either opspicy hands Elo each `types.elo` with a loader, so that one may `import { EmailSummary } from '../emails/types'`; or Elo reads definitions whatever their order ([E4](elo.md#e4--types-that-refer-to-types-declared-after-them)), and nothing changes here. The second is the lighter for a suite.

**What saras changes once it is there.** `EmailsOfBoard` and `FilterTried` say `[EmailSummary]`.

## O3 — `--check` says when an example's input is not of its type

**Status**: to file.

**What saras needs.** Since the server refuses what does not fit an operation's input type, an example whose input does not fit it can only fail. `--check` reads the suite without a system, and says nothing of it: an example of DeleteBoard with `input: { id: first }` passes `--check`, and is found only by a run on the stack. saras holds it meanwhile with a test of its own (`test/unit/inputs.test.ts`).

**What is asked.** That `--check` checks the input of every example against the operation's `input` type, as a run already does ("the input is not a …"), and says so as a problem of the suite.

**What saras changes once it is there.** The part of `test/unit/inputs.test.ts` that reads the examples goes; `emb run lint` finds what only CI found.

## O4 — A record seen by another is named whole when it changes

**Status**: fixed, and 0.3.1 prepared, on the branch `ccr-acb33f63-gxfrgu` of opspicy: to merge into its main branch and tag `v0.3.1`.

**What saras needs.** After an example, 0.3.0 holds an operation to the states it controls, and names what changed under `seenBy.<actor>.` by its deepest part: `seenBy.member.me.language` is told as `me.language`, which is no state, and which no `controls:` can name. Every operation that changes `me` or `emails`, as another browser or another member sees them, fails: `"me.language" changed, which ChooseLanguage does not control`, though ChooseLanguage controls `me`. With what each operation controls said, 39 cases fail for this alone, and nothing else fails.

**What is asked.** `changed()` (`src/judging.ts`) names a state seen by somebody as the state itself is named: `seenBy.member.me`, then `me`.

**What saras changes once it is there.** `OPSPICY_IMAGE` names 0.3.1, and `emb run test:operations` passes again.
