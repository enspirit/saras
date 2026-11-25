# Brief — what the AI-assisted setup of sorting asks of the server

What the answer to [the designer's brief](ai-assisted-setup-of-sorting.md) costs the server, in three parts: how the domain must evolve, whether that can be done first without changing anything a client sees, and how the feature is built afterwards. Written so that API and end-to-end coverage can be added before the work starts, on what will not move.

> **Status:** a plan. Nothing of it is built. It follows the proposal as it was returned: the step in getting started, the narrow asks under Sorting, the returning case, and a rule shown by what it does to the emails kept.

## In short

- **Nothing new is kept.** No table, no column, no migration. A proposal still lives in the browser ([decision 0017](../decisions/0017-the-assistant-is-a-subsystem-of-its-own-and-configures-through-data.md)).
- **The prerequisite is three extractions inside the domain, and it can be 100 % iso-functional**: no route, no shape, no message code changes. webspicy is untouched by it.
- **The feature is then additive**: four new routes, and optional fields on two existing ones. No existing route changes what it answers today.
- **So:** cover in full, now, the routes of [the table below](#what-to-cover-now-and-what-to-leave); cover only the invariants of the two that gain fields; write nothing yet for the four that do not exist.

## 1. How the domain must evolve

### What is kept does not change

Attributes and their values, an email's values in `emails.attributes_json` (`{value, source, reason}` by attribute key), where it stands (`status`, `triage_source`, `triage_reason`), a board's filter in `filter_json`. The feature reads all of it and adds nothing to it.

### What changes: what the domain can say without doing it

The feature rests on one question the server cannot answer today: *what would this configuration, not applied, do to the emails kept?* Three places each hold a part of the answer.

| Today | Where | What it lacks for the feature |
| --- | --- | --- |
| **tryRule**: what a rule says of emails | `observations/attributes.ts` | The member's twenty most recent only. It drops the reason the rule gave. It does not say what would *change*. |
| **SortAgainByRule**: the rule applied to every email kept | `sorting/sort-again-by-rule.ts` | It decides and writes in one loop. The decision itself is already pure (`valueAgain`, `standsAgain` in `computations/sorting-again.ts`), but nothing can ask for it without the write. |
| **tryFilter**, the count of a board | `observations/boards.ts`, `computations/boards.ts` (`conditionsOf`) | A filter is evaluated in SQL only, on the values as they are kept. It cannot be asked of values an email does not have yet. |

Hence four evolutions. None changes what is kept.

**E1. What a rule says of a kept email, said once.** `said()` in SortAgainByRule and the inline in tryRule are the same thing: run the compiled rule on `keptEmailForRules(row, mailbox)`, read the answer with `decidedFrom`, nothing when the rule fails on that email. One function, used by both, and by the trial of a configuration.

**E2. Sorting again as "decide, then keep".** Split the loop of SortAgainByRule: first *what changes for each email* (a list: the email, what it has, what it would have), then keeping it. The first half is the trial; the second is what the operation does today. `valueAgain` and `standsAgain` stay as they are: they already hold the rules that matter (a value set by hand stays, a value the rule no longer gives goes, a replied email is left alone).

**E3. A board's filter as a judgement on one email.** This is the one real gap. A proposed board filters on a proposed attribute, whose values exist in no row SQL can read. Two ways, and it is a choice between real alternatives, so a decision record:

| | A. A pure predicate beside the SQL | B. Apply, look, roll back |
| --- | --- | --- |
| How | `shownBy(filter, email, itsValues)` in `computations/boards.ts`, for the same `BoardFilter` that `conditionsOf` turns into SQL. | ApplyConfiguration and SortAgainByRule inside a transaction; count with the existing SQL; roll back. |
| For | A read stays a read. Table of cases, no mock. | One semantics: nothing to keep equal. |
| Against | Two readings of a filter (attributes, mailbox, from, keywords, received, attachment, except) to keep equal. | A "what would it do" that writes and locks every email of the organisation for seconds, with several servers on one database; attribute keys used up; "attribute created" in the log for something that was not; a transaction inside ApplyConfiguration's own. |

**Recommended: A**, with the two readings held together by one table of filters and emails, run through the predicate (unit) and through `POST /boards/try` (integration). That table can be written *now*, against the SQL alone: it is coverage today and the oracle of the predicate later.

**E4. Names before keys.** `attributesAfter` (`computations/configuration-names.ts`) already says which attributes there would be once a configuration is applied, and gives those not made yet a provisional key (`new-0`). But `filterResolved` ends in `filterGiven`, which keeps only `status` and numeric keys: resolved before anything is applied, a condition on an attribute not made yet is silently dropped. Checking does not suffer from it (it reads names, with `unknownIn`), and applying resolves after the attributes are made. The trial needs a resolution that keeps provisional keys, for itself only: what is *kept* must still be reduced as today.

### Types (`shared/`)

| Type | Evolution |
| --- | --- |
| `RuleTried` | Gains `reason`: the one the rule gave. |
| `ConfigurationTried` (new) | By attribute named: how many emails get each value, how many get none, how many would change from what they have, how many are set by hand and stay, and a few emails with their value and the reason given. By board named: how many it would show. |
| `ConfigurationWanted` | Gains two optional fields: the proposal on screen (reduced to what is ticked) and a remark on it. |
| New, one per narrow ask | What is asked and what is answered for: one attribute from a sentence; the rule of an attribute from a sentence, the rule as it is and its problems; the conditions of a board from a sentence. |

### Two rules to settle before writing the trial

- **Whose emails.** tryRule looks at the mailboxes the member may use; SortAgainByRule at every email the organisation keeps. For the trial: **counts over every email kept** (they are numbers, and they are what sorting again will touch), **examples only from mailboxes the administrator may use** (a subject is content: an administrator does not read a colleague's personal mailbox through a preview).
- **How many.** `emailsKeptBy` reads every row, text included, as SortAgainByRule does today. The trial does the same, up to three rules at a time. Either that is accepted as it is for sorting again, or a ceiling is named (the *n* most recent) and said on the screen.

### What does not need to evolve

- **ApplyConfiguration**: unchanged. "Emails already kept stay as they were sorted" stays its clause; the browser goes on calling SortAgainByRule per attribute afterwards, as it does now.
- **The refusals**: "nothing usable" is already `assistant.noUsableAnswer`, and an unreachable provider, a refused key or no key are already `llm.unreachable`, `llm.keyRefused`, `llm.noKey`. The screens need two texts; the server already tells the cases apart.
- **The step in getting started, the ticks that follow each other, which email the path ends on**: the browser's.

## 2. Can the prerequisite be iso-functional?

**Yes, entirely**, for E1 to E4 and the predicate of E3: they are extractions and one pure function that nothing calls yet.

| Work | A route changes? | What a client sees | Held by |
| --- | --- | --- | --- |
| E1: one "what a rule says of a kept email" | No | Nothing | `test/integration/sorting-again.test.ts`, `attributes.test.ts` |
| E2: decide, then keep | No | Nothing: same `{examined, changed}`, same rows written | `sorting-again.test.ts` |
| E3 (A): the predicate, with its table | No | Nothing: no caller yet | the table, on both readings |
| E4: a resolution that keeps provisional keys | No | Nothing: used by nobody yet | unit, `configuration-as-data` |

API routes and webspicy stay as they are. Two things to watch, because they would break "iso" without a test noticing by default:

- E2 must write exactly what the loop writes today: one update per email that changes, none for the others, and "Stands in" through `standsAgain`.
- E4 must not leak: a board *kept* with a provisional key would show nothing, for ever.

**What is not iso-functional is the feature itself**, and only by addition:

| Change | Kind | Why it cannot be iso |
| --- | --- | --- |
| `POST /configuration/try` | New route | A new observation is a new thing told. |
| `POST /assistant/attribute`, `/assistant/rule`, `/assistant/board` | New routes | New skills, new operations. |
| `POST /attributes/try` answers `reason` | A field added | The reason is a fact the route did not tell. |
| `POST /assistant/configuration` takes a remark and the proposal it is about | Optional input; same answer | "Not quite?" needs the model to start from what is on screen. |
| A proposed rule gives a reason with each value | The model's brief and the skill's check | Changes what the model is sent, so tests that read `stack.llmRequests` move. No route changes shape. |

### What to cover now, and what to leave

First, what exists. **webspicy specifies two operations** (`GET /api/public`, the two refusals of sign-up) and says why in [its README](../../tests/webspicy/README.md): it cannot yet start from a named state, so it can neither write nor hold a session. Covering sorting there needs that first: a database of its own, a seed, a session. And **the stack has no stand-in for the LLM** (`OPENROUTER_BASE_URL` points at a closed port in `test.env`; the stand-in lives inside `test/support/`): of `/assistant/*`, webspicy can only specify the refusals. There is no end-to-end suite in a browser in the repository.

| Route | After the feature | Before the work |
| --- | --- | --- |
| `GET`, `POST /attributes`; `PUT`, `DELETE /attributes/:key` | Unchanged | **Full** |
| `POST /attributes/check` | Unchanged; the rule ask leans on it | **Full** |
| `POST /attributes/:key/sort-again` | Unchanged (E2 refactors under it) | **Full**: it is the net under E2 |
| `PUT /emails/:id/attributes/:key`, `POST /emails/selection/attributes/:key` | Unchanged | **Full**: "set by hand stays" is what the trial counts |
| `GET`, `POST /boards`; `PUT`, `DELETE /boards/:id`; `PUT /boards/order`; `GET /boards/:id/emails` | Unchanged | **Full** |
| `POST /boards/try` | Unchanged | **Full, as the table of E3**: every kind of condition, each way |
| `GET`, `PUT /configuration`; `POST /configuration/check` | Unchanged | **Full**: every proposal ends in `PUT /configuration` |
| `POST /attributes/try` | Gains `reason` | Invariants only, with a schema open to more fields |
| `POST /assistant/configuration` | Gains optional input | Refusals only (a member, nothing said, no key). Its happy paths are in `configuration-assistant.test.ts`, with the LLM stood in. |
| `POST /configuration/try`, `/assistant/attribute`, `/assistant/rule`, `/assistant/board` | New | **Nothing yet** |

End to end, in a browser:

| Screen | After the feature | Before the work |
| --- | --- | --- |
| Sorting: the list, the form of an attribute (values, rule checked, tried, saved, applied to the emails kept) | Stays; gains an ask | **Cover** |
| The form of a board; boards in the menu with their counts | Stays; gains an ask | **Cover** |
| Getting started, connect to first email | Gains a step before the last; the Writing button is renamed | **Cover**, with the step after Writing behind one helper |
| `#/attributes/assistant`, the three steps | Rewritten | **Leave**, or one smoke test at most |

## 3. Implementing the feature, later

In this order: each step is useful alone, and the first three need no screen.

1. **TryConfiguration**, an observation, and `POST /configuration/try`. No AI. From E1 to E4: read the configuration given as ApplyConfiguration would (`configurationRead`), refuse what it would refuse, then tell `ConfigurationTried`. Administrators only. A row in [the operations](../2-operations.md), a specification in webspicy, integration tests on the stack of the tests.
2. **Reasons.** `knowledge/rules.ts` asks for `{value, reason}` on every branch; the check of the skill refuses a rule that gives none; `RuleTried` carries the reason. The Outcome on screen is made of this.
3. **ProposeConfiguration with a remark.** `wantedGiven` reads the two optional fields; the skill is told the proposal it starts from and asks no question again. Still nothing kept, still no email sent.
4. **The interface, on what exists.** The components the proposal argues for (AiAsk, Outcome, the proposed card, Steps on a small screen) with their examples in the style guide; the flow shared by the step of getting started and the page under Sorting; the step in `getting-started/path.ts`; the wording in both languages. From here the whole experience works, the narrow asks aside.
5. **The narrow asks**, one at a time, each "a skill in `src/assistant/skills/`, an operation in `src/domain/advice/`, a route, an entry on a form", as decision 0017 lays out:
   - **ProposeBoard** first, the cheapest: its check is that the filter names attributes and values there are.
   - **ProposeAttribute**: its check is what CreateAttribute would refuse, the rule included.
   - **WriteRule**: given the rule as it is and what `checkRule` finds in it; its check is `checkRule` again and the values of the attribute. It is sent no email: refining a rule *from the emails it sorted wrongly* remains a decision of its own, against [0011](../decisions/0011-the-ai-does-not-sort.md).
6. **The documents**, each in the change it describes: US-08 and US-99 in [the stories](../1-user-stories.md), sections 5, 6.5 and 6.6 of [the design](../4-design.md), the rows of the operations, and the decision record of E3.

Done, for each step, is what the repository asks: `emb run lint` clean, `emb run test` passing, and the suites of the stack where a route was added.
