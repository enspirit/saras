# 0017 — The assistant is a subsystem of its own, and configures through data

## Context

An organisation sorts its mail with attributes, rules written in Elo, and boards. Setting them up asks an administrator to know what an attribute is worth, and to write Elo. The help so far was a skill to download and hand to an AI agent of their own, which wrote one rule to paste back.

The AI is to help inside saras: first by proposing a configuration from what an administrator says of the organisation; later by refining the rule of one attribute from a request and from the emails it sorted wrongly, or a prompt from the proposals members changed.

Three things are in play, and they change for different reasons: what a configuration *is* and how it is applied; what a model is told and how its answer is read; and the screen that brings the two together. Written as one feature, the second would grow into the first: a prompt that knows table rows, an operation that knows a model's quirks.

Two more things weigh on it. [Decision 0011](0011-the-ai-does-not-sort.md): the AI does not sort, and the LLM is sent a received email for one thing, writing a proposal. And a configuration that an AI writes freely grows: ten attributes, twenty boards, a tool nobody reads any more.

## Decision

**1. A configuration is data, and one operation applies it.** `shared/configuration.ts` declares it: attributes and the boards members share, named as an administrator names them (an attribute by its name, a value by its label, a mailbox by its address; where an email stands by its key, `status`), never by a number of the installation. `GET /configuration` tells it, `POST /configuration/check` says everything wrong in one, `PUT /configuration` applies one: **ApplyConfiguration**. Applying makes what the organisation does not have under that name and changes what it has, all of it or none of it, and deletes nothing. It does nothing that CreateAttribute, EditAttribute, CreateBoard and EditBoard do not do: it calls them. This part knows nothing of any AI.

**2. The assistant is a subsystem of its own, `src/assistant/`.** It holds *skills*. A skill is pure: from what is asked, what to tell a model; from the text that comes back, what it says, or what is wrong in how it is written. `perform` runs one: it asks, reads, and when the answer will not do, tells the model what is wrong and asks again, three times at most. The assistant imports `shared/` and nothing else of saras. It is *given* its means by whoever uses it: `ask`, which sends what is said and returns text, and `check`, which says what they object to in an answer. It knows no key, no model, no database, no route; `tests/harness` holds that.

**3. The domain wires the two.** **ProposeConfiguration** (`src/domain/advice/`) gives the assistant the organisation's key and model in force as `ask`, and as `check` what ApplyConfiguration would refuse; it answers the assistant's questions, or a proposal reduced to what is new or would change. It keeps nothing and applies nothing: what is proposed is read on a page, and what is kept of it goes to `PUT /configuration` like any configuration.

**4. A proposal is small, and that is the assistant's rule, not a setting.** At most three attributes and five boards in a proposal, three questions, asked once. The skill says so to the model and refuses an answer that holds more.

**5. No email is sent for it.** The model is sent what the administrator wrote, their answers, and the configuration as `GET /configuration` tells it. The rules and filters of that configuration may hold addresses the organisation wrote there; nothing else of a mailbox, of a member or of an email goes.

## Alternatives

- **Have the model call the operations as tools** (create an attribute, create a board). Each call would change the organisation before anyone read anything, a half-made configuration would stay behind a failure, and the model would need the numbers of the installation. Data is read whole, checked whole and applied whole.
- **Put the prompts beside the operations**, as `computations/llm-prompts.ts` is for replies. It is where this started from. With several skills, a retry loop and knowledge shared between them, the domain would hold more of how to talk to a model than of what saras does.
- **A component of its own, a service.** It would need its own contract, image and deployment for what is today a few pure functions; and the key in force would have to cross a network. The boundary is kept by imports instead. It could become one without a rewrite: its means are already given to it.
- **Keep the conversation on the server**, as a row an administrator comes back to. Nothing needs it yet: the browser sends what was said so far with each request, and what is written of the organisation is kept nowhere.
- **Name things by their numbers in a configuration.** A proposal could not name an attribute it makes in the same answer, and nothing written for one organisation would fit another.
- **Apply what is given as the whole configuration, deleting the rest.** One request that leaves out an attribute would take its values off every email.

## Consequences

- The LLM now also returns configurations. It still sorts nothing: what it proposes are rules, which an administrator reads, and which then sort at no cost and say what they do.
- A proposal is always one `PUT /configuration` takes: the model is told Elo's own diagnostics, with their place, until its rules fit the email. When three answers were not enough, the request is refused as the LLM's failure.
- A configuration names an attribute by its name: one cannot be renamed through it (the name it had would be made again). Values keep their place: changing the order of the values of an attribute that emails already have changes what those emails say, as it does on the attribute's form; the skill tells the model to add at the end.
- An organisation's own attribute named `status` cannot be told apart from where an email stands in a configuration.
- What the assistant knows of rules (`src/assistant/knowledge/rules.ts`) is said once: the skill to download reads it from there.
- A request to the assistant may take as long as three answers of a model.
- The typos, style and prompt helps stay where they are, in the domain: they are older than the assistant and nothing asks to move them. They are skills in all but name, and can move when one of them changes.

## What comes next, and where it goes

Each is a skill in `src/assistant/skills/`, an operation in `src/domain/advice/` that gives it its means, and nothing else:

- **Refining the rule of one attribute**, from a request in words and the emails it sorted wrongly. Its `check` is the rule tried on those emails. It would be the first skill to be sent emails for something else than a reply: that is a decision of its own, to be taken then, against [0011](0011-the-ai-does-not-sort.md).
- **Refining a prompt** from the proposals members changed and the reasons they gave.
- **Proposing in getting started.** The whole of it, a few attributes and boards at once, belongs there more than under Sorting, which keeps the narrow asks: one attribute, the rule of one, one board. That experience is asked of a designer in [a brief](../briefs/ai-assisted-setup-of-sorting.md).

## What would reverse it

A model that needs to look things up while it works (try a rule on emails, read a board) rather than answer once: the assistant would then be given tools, not only `ask` and `check`, and the line between it and the domain would be drawn again. Or the assistant staying at one skill for good: a subsystem for one prompt is more than it needs, and it would go back beside its operation.
