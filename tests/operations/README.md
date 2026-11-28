# operations

The **black-box specification** of saras's operations. One file per operation, named after it, holding its clauses in sentences. A sentence is checked when it has a formaldef: an expression that is true or false of what was observed.

One responsibility: *say what an operation is and what the rules demand of it, knowing nothing about what performs it.*

It is an executable specification, not an asset of the tests: the server reads it too. The `entry` and the `input` of an operation are where the route that serves it is mounted and the type of what it is given, which the server checks before the operation sees it and refuses `400` when it does not fit ([decision 0021](../../doc/decisions/0021-an-input-is-refused-when-it-is-not-of-its-type.md)). Its types are therefore tight: a text says how long it may be and whether it may be blank, a list whether it may be empty; `.` is for what is truly anything.

What reads these files and runs them is [opspicy](https://github.com/enspirit/opspicy), a project of its own, taken as an image ([decision 0020](../../doc/decisions/0020-opspicy-is-a-project-of-its-own.md)). Its [`doc/suite.md`](https://github.com/enspirit/opspicy/blob/main/doc/suite.md) is the reference of the notation: the metamodel (every citizen has a name, a description, and for some a formaldef), an operation's file, a formaldef, the state and the world, what an area says; its [README](https://github.com/enspirit/opspicy#how-a-case-runs) says how a case runs. It replaced a webspicy suite: [decision 0017](../../doc/decisions/0017-the-operations-are-specified-by-predicates.md) says why. The forms its files are written in are those of [decision 0019](../../doc/decisions/0019-everything-a-specification-says-is-a-citizen.md).

## Public interface

A component with no API of its own. Its tasks, and what it holds.

| | |
| --- | --- |
| `emb run test:operations` | The suite, on the stack this is run in: the one under the suites (`docker-compose.test.yml`), whose database may be emptied. `FAST=yes` runs it as a black box: nothing is read in the database, and a clause marked `(+)` is told and not checked. `O`, `METHOD`, `CASE` and `ROBUST` narrow it, `FAILFAST=yes` stops it at the first failure, and `LOG_LEVEL=DEBUG` shows what each case sent and was answered. Every run also writes `.report/last.json` and `.report/explorer.html`, the explorer of the run: [what a run may be asked](https://github.com/enspirit/opspicy#the-command). |
| `emb run operations:lint` | Reads every file and says what cannot be read, and type-checks what of the suite is code. Needs no stack. Part of `emb run lint`. |
| `emb run report:prepare` | Creates `.report/`, where the runner writes `last.json` (through `docker-compose.test.yml`). Run it once before `emb up`: Docker would otherwise create the folder as root. Ignored by git. |
| `emb run explorer` | Writes `.report/explorer.html`: the wiki of this suite and its last run, one standalone file, opened offline. Needs no stack. |
| `emb run explorer:serve` | Serves the same wiki read-only on `http://127.0.0.1:7280` (`EXPLORER_PORT` in [`.env.commons`](../../.env.commons)), re-read when the suite changes. Needs no stack. |

To read the suite and comment it, neither a stack nor docker is needed, only Node: `npx @enspirit/opspicy serve tests/operations --name=saras` serves the same wiki on `http://127.0.0.1:8080`, where notes are taken and saved as one `review.md`.

On a laptop, the stack under the suites runs beside the development one:

```sh
export COMPOSE_PROJECT_NAME=saras-try COMPOSE_FILE=docker-compose.base.yml:docker-compose.test.yml
emb run report:prepare       # once, before the stack is up
emb up                       # again after a specification changed: they are in the image
emb run test:operations      # the complete run, which CI does
FAST=yes emb run test:operations   # what must hold, through the front door alone
O=boards ROBUST=no FAILFAST=yes emb run test:operations             # the examples of an area, up to the first that fails
O=CreateBoard CASE=blank LOG_LEVEL=DEBUG emb run test:operations    # one case, with what went over the wire
```

The fast run is the one a change inside the server must leave as it is: it knows the routes and nothing of the schema. What the complete run adds is what only the database shows, clause by clause: each is marked `(+)`.

| | |
| --- | --- |
| [`specification/`](specification/)…`/<area>/operations/<Operation>.yml` | The specifications of what changes the state, by area: [`boards/operations/CreateBoard.yml`](specification/boards/operations/CreateBoard.yml) specifies what `src/domain/boards/create-board.ts` performs. |
| `specification/<area>/observations/<Observation>.yml` | The specifications of what only reads it, beside the operations on the same subject: [`boards/observations/ListBoards.yml`](specification/boards/observations/ListBoards.yml). Filed there, a route is checked to change nothing. |
| [`specification/system.yml`](specification/system.yml) | What saras is, how it goes, what it does on its own clock and what no specification says yet: the Overview of the explorer. Each file at the root says what its section is about as its `description`. |
| [`specification/areas.yml`](specification/areas.yml) | The areas, each described: the subjects of saras, `_shared`, and two that hold words only. |
| [`specification/agents.yml`](specification/agents.yml) | Who performs the operations: the Visitor, the Member, the Administrator; and, in its description, the agents that act without calling the front door. An Administrator is a Member, and a Member may ask what a Visitor does. |
| [`specification/backgrounds.yml`](specification/backgrounds.yml) | [The Backgrounds](#the-backgrounds) a case starts from, each with what it holds. |
| [`specification/state.yml`](specification/state.yml) | What saras keeps, in its description; what is observed: the routes that read, and the tables read from behind them, each with what it shows. |
| [`specification/world.yml`](specification/world.yml) | What the runner knows of the world: the actors, each the agent they are and what they sign in with, and the tokens the seed's hook planted. |
| `specification/<area>/predicates.yml`, `functions.yml`, `conditions.yml`, `types.elo` | What an area says: the predicates, true or false of the state (`seesBoard(id)`), and the functions, which read something of it (`board(id)`), each with its description and its formaldef; the conditions, which are the sentences several operations say in the same words, with their formaldef; and the data saras exchanges, in types that the suite and the server read alike, each described in a comment above it; their names are one namespace across the areas. A constraint labelled with a code of the server (`String(n | 'boards.nameRequired': !isBlank(n))`) is refused with that code. [`_shared/`](specification/_shared/) holds those of every area. [`emails/`](specification/emails/) holds words that sorting and replying say, and observations only; [`members/`](specification/members/) words that access says, and nothing of its own. |
| [`config.ts`](config.ts) | How the suite meets saras: its front door, how somebody signs in, how a Background is set, what a refusal looks like, how to know the server is at rest. |
| [`backgrounds/`](backgrounds/) | How the state of a seed is arrived at, through the API. |

### The Backgrounds

A seed of [`software/storage`](../../software/storage/), by its name. [`specification/backgrounds.yml`](specification/backgrounds.yml) names each and says what it holds: `test/base`, which is arrived at through the API by [`backgrounds/base.ts`](backgrounds/base.ts), then flushed (`emb run storage:test.rebuild`); `test/unfetched` and `test/unconnected`, which inherit it; and `empty`. A case that names another is not read.

Everything a case makes is numbered from 5001, in every table.

## Depends on

| | |
| --- | --- |
| [opspicy](https://github.com/enspirit/opspicy) | What reads the suite and runs it, as the image `OPSPICY_IMAGE` of [`.env.commons`](../../.env.commons) names: the image of the suite is built on it, and the tasks that need no stack run it on the checkout. |
| docker | For every task here, those that need no stack too. |
| saras, running | Reached through its front door, and no other way to act on it. |
| [`software/storage`](../../software/storage/) | dbagent, over HTTP, beside the front door: it installs the seed of a case. |
| PostgreSQL | The stack's database, read for the relations of `state.yml`, and to know that the server has nothing under way. |
| [`world/mailbox`](../../world/mailbox/) | The mailbox the Backgrounds have connected. |

Nothing of saras is in its process: no source, no type.

## Must not

1. **Import anything of `software/saras`.** A suite that shares the product's types cannot say they are wrong. Held by [`tests/harness`](../harness/).
2. **Read through `db` what the API tells.** A relation is behind the API, so it moves when the schema does: it is for what no route shows anybody of the Background (that only a hash is kept, that a link was spent, that nothing at all changed for anybody), and it names no column of who belongs to which organisation. A clause that reads one is marked `(+)`, which opspicy holds, and says in a sentence of its own what only the database shows: what a route tells is said by the clause before it, marked `(x)`.
3. **Run where the database is somebody's.** Every case installs a seed, which empties it. [`config.ts`](config.ts) says the database may be emptied only where `OPERATIONS_MAY_EMPTY_THE_DATABASE` is set, which `docker-compose.test.yml` alone does: on the development stack nothing runs.
4. **Be edited to make a mismatch pass.** When the specification and the server disagree, one is wrong, and the suite is how it was found. A behaviour that is the server's and not what the documents say is specified as it is, and told: [what was found so far](../../doc/deviation-candidates.md).
5. **Hold a credential that opens anything real.** The passwords and tokens of `world.yml` open a seed.
6. **Ship**: `publish: false`.

## Harness

It *is* the harness. `emb run operations:lint` reads every specification and type-checks `config.ts` and `backgrounds/`.

To add a specification: the file, in the `operations/` of its area, or in its `observations/` for a route that only reads, with its name, its description and its agent; its types in the area's `types.elo`, each under a comment that describes it; the clauses before the cases, said with the predicates and the functions there are (a new one when the area says the same thing twice, in the long form: its name, its description, its formaldef); one counterexample per precondition. That what is given is of the type of its `input` is a precondition of every operation, implicit: no clause says it, nor repeats a constraint of the type; the server refuses what does not fit `400` ([decision 0021](../../doc/decisions/0021-an-input-is-refused-when-it-is-not-of-its-type.md)). Every example's input must fit, and so must a counterexample's, unless it says `for: <the type>`: one is written only where what the type refuses matters (a blank name). A new area is also an entry of `areas.yml`, and a new Background one of `backgrounds.yml`. Then `emb up` and `O=<Name> LOG_LEVEL=DEBUG emb run test:operations`, on the stack under the suites.

## Status

> **In flight:** nothing.

55 operations and 22 observations are specified, in 618 cases: every operation a person asks for through the API, and every route that reads, but those named below. Of their 733 clauses, 518 are checked through the front door, 76 in the database, in the complete run only, and 139 are told, 5 of them what triggers an operation; a run says which. What an example alone also shows is 474 more, 28 of them in the database. A run takes two and a half minutes, and says how long any case took that waited a second or more.

What it leaves to `software/saras/test/integration/`, and why:

- **No LLM in the stack** ([decision 0003](../../doc/decisions/0003-third-parties-stood-in-inside-the-tests.md)): CheckTypos, ImproveStyle and WriteWithPrompt are specified as far as their refusals go, PrepareProposals not at all. A call that reaches the LLM is answered `502 llm.noKey` here.
- **No second factor**: the stack does not require one, so GiveSecondFactor and ResetSecondFactor are not specified.
- **The lock-out is told, not checked.** Each case calls from an origin of its own, so no case meets it. Specifying it needs a Background of ten wrong guesses, which a seed cannot hold: the count is in the server's memory.
- **What the server does on its own** (ExpireSessions, ErasePastRetention, a fetch on the clock) has no entry to call.
- **Signing in at a mail host** (`/api/oauth/…`) and `GET /api/mail/host`, which asks the DNS.
- **Two routes that read**: `GET /api/emails/:id/attachments/:index`, the file attached to an email, specified nowhere here: that it is refused to somebody of another organisation is held by the integration tests; and `GET /api/attributes/skill`, the skill of writing a rule for no attribute in particular, beside ReadRuleWritingSkill, which specifies it for one.

What the notation cannot say yet is in [the status of opspicy](https://github.com/enspirit/opspicy#status).

What a Background would let it say, that none holds yet: a personal mailbox, and a second one in an organisation; a mailbox with no folder chosen; an invitation that expired; an email kept with its HTML, one whose content was erased, one with a proposal; a reply written with a prompt and edited; a rule changed after the fetch; an organisation with a model and a key of its own.

And of the stack:

- **The mailbox of the stack is not put back by a seed.** What a case hands it (a reply, a draft, a flag) stays until its container is made anew. No case depends on it, and FetchMailbox counts on emails less than a fortnight old: on a mailbox container started within a week.
- **The suite waits for the server to be at rest** before a seed is installed and after a call that changed something, by looking at the keys held in the database: a fetch started by an operation holds one for as long as it lasts. Work the server would start without holding a key would not be waited for.
