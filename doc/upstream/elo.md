# Elo — what saras asks of it

[Elo](https://github.com/enspirit/elo), taken as the package `@enspirit/elo` (1.2.4). How an entry is written: [`README.md`](README.md).

## E1 — A type for the keys of a map

**Status**: to file.

**What saras needs.** The filter of a board names attributes by key: `status`, or the number of an attribute of the organisation (`{ attributes: { status: [todo], "12": ["2"] } }`). Its type in the specification is `{ ...: AttributeLabels }`, which checks the values and lets any key through. So `colour` passes the check, and the code downstream has to know better: the domain drops it (`filterKept`) and `conditionsOf` writes a key as `Number(key)` into SQL. This is gap 2 of [decision 0021](../decisions/0021-an-input-is-refused-when-it-is-not-of-its-type.md#where-the-code-falls-short-of-it): an input that passed its type is not yet safe.

**What is asked.** A way for a type to constrain the keys of a map, so that a key that does not fit is refused like a value that does not, with its path. Either of:

- a key type in the spread: `{ ...[AttributeKey]: AttributeLabels }`, with `AttributeKey = String(k | k == 'status' || isDigits(k))`;
- or a function that lists the keys of an object, usable in a constraint: `AttributeValues = Values(v | all(keys(v), k ~> k == 'status' || isDigits(k)))`. `keys` (and `values`, `entries`) are unknown today: `keys({a: 1})` is *Unknown function keys(Object)*.

A failing key would be told as a `schema` (or `constraint`) failure at `.attributes.colour`, as a value is.

**What saras changes once it is there.** `AttributeValues` says its keys; an unknown attribute key is refused `400`; `filterKept` and the `Number(key)` of `conditionsOf` go; EditBoard can show the refusal as a case.

## E2 — The label of a constraint when the field is missing

**Status**: idea.

**What saras needs.** A constraint labelled with one of the server's message codes is refused with that code: `BoardName = String(n | 'boards.nameRequired': !isBlank(n))` refuses `name: "  "` as `boards.nameRequired`. But `{ shared: false, filter: {} }`, with no name at all, is a `missing` failure with no label, and is refused as the generic `request.invalid`. For a client, a name left out and a name left blank are the same mistake. Gap 5 of [decision 0021](../decisions/0021-an-input-is-refused-when-it-is-not-of-its-type.md#where-the-code-falls-short-of-it).

**What is asked.** A way to label what a missing attribute is refused with, so that `failure.label` says it. For instance a label on the attribute itself, `{ name: BoardName 'boards.nameRequired', … }`, or a `missing` failure that carries the first label of the attribute's type. The project knows best which reads well.

**What saras changes once it is there.** A missing name is refused `boards.nameRequired`, as a blank one is; the counterexample `for: BoardGiven` can be either.

## E3 — A constraint on a list type written in place

**Status**: idea.

**What saras needs.** A list that must not be empty, or repeat itself, needs a named type first: `[Id](l | count(l) > 0)` is not read (*Unexpected UPPER_IDENTIFIER after the end of the expression*), so the specification writes `MailboxNumbers = [Id]` and then `MailboxesNamed = MailboxNumbers(l | count(l) > 0 && count(unique(l)) == count(l))`. Every such list costs a type, and a description of it, that says nothing of its own.

**What is asked.** A subtype constraint applied to a list type, or to a schema, written in place: `[Id](l | count(l) > 0)`, as `String(s | …)` is.

**What saras changes once it is there.** `MailboxNumbers` and `BoardList` go from [`boards/types.elo`](../../tests/operations/specification/boards/types.elo).

## E4 — Types that refer to types declared after them

**Status**: idea.

**What saras needs.** opspicy reads the types of the areas as one prelude, `_shared/` first and then the areas in the order of their names, and Elo requires a type to be declared before it is used. An output of boards cannot name `EmailSummary`, which `emails/` declares, and says `[.]`: the answer of `GET /boards/:id/emails` is not checked email by email. Gap 7 of [decision 0021](../decisions/0021-an-input-is-refused-when-it-is-not-of-its-type.md#where-the-code-falls-short-of-it).

**What is asked.** Within one prelude, type definitions that may refer to each other whatever their order (they are definitions, not statements), refusing only a cycle that has no base. Imports between files are the other way out, but opspicy hands Elo one text, with no loader (see [O2](opspicy.md#o2--the-types-of-an-area-may-import-those-of-another)).

**What saras changes once it is there.** `EmailsOfBoard` and `FilterTried` say `[EmailSummary]`.
