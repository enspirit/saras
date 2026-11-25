# Brief — the AI-assisted setup of sorting

A brief for a designer, alone or with an AI agent, on the experience of having attributes, rules and boards proposed by the AI. It is written to be handed over as it is, to someone who has not read the rest: so it says again, shortly, what other documents say in full. Where they differ, they are right: [the stories](../1-user-stories.md) (US-08, US-98, US-99), [the design](../4-design.md), [decision 0017](../decisions/0017-the-assistant-is-a-subsystem-of-its-own-and-configures-through-data.md).

> **Status:** asked, not answered. What it calls "what exists" is the first page, under Sorting. Nothing of what it asks for is built.

## The product

saras is a self-hosted web tool for a small team to answer email with the help of AI. Its privacy promises are the product. An organisation sorts its mail with:

- **attributes**: something to know of each email (a topic, an assignee, urgent or not), each with a short list of coloured values;
- **rules**: one per attribute, written in a small expression language (Elo), which decide the value when an email is fetched, at no cost and without AI;
- **boards**: named views of emails, filtered on attributes, shared by the team.

Setting these up asks an administrator to know what an attribute is worth and to write Elo. Most will not. An AI assistant now proposes them.

## What exists

One page, reached from Configuration → Sorting, in three steps, no chat. It works, but it is only a first experience:

1. The administrator describes the organisation and its mail in free text.
2. The AI may ask up to three questions, once, each with a few suggested answers.
3. It proposes cards: each attribute (values, rule shown as code) and each board (conditions in words), marked "New" or "Changes the one you have", each with a tick box. "Apply what is ticked" applies them.

## What we want from you

**1. The whole experience moves into getting started.** Getting started is a path shown at the top of each of its screens: connect a mailbox → choose the folder → give the AI its key → read the prompt → choose how it works → try it on a first email. Design the step where a new administrator describes their organisation and leaves with a few attributes and boards in place. Say where it sits in the path, how it is skipped, and how the path's ending (the first email, open) shows what was just set up.

**2. Sorting keeps narrow asks.** Design the entry points for parts of the experience where the administrator already is: propose one attribute, write or fix the rule of this attribute, propose a board. Each should feel like help on the form in hand, not a detour to a wizard.

**3. Returning later.** An organisation already configured asks again: how is what changes told apart from what is new, without alarming anyone?

## Fixed: design within these

- **Small on purpose.** At most three attributes and five boards per proposal, three questions, asked once. A saras instance must not become a gas plant; the design should make small feel sufficient, not limited.
- **No email goes to the AI.** It is sent the administrator's text, their answers, and the current attributes and shared boards. The screen says so. Do not design "we looked at your mail": lifting this is a decision of its own ([decision 0011](../decisions/0011-the-ai-does-not-sort.md)), not a design choice.
- **Nothing changes until applied**, then all of what is ticked or none of it. Nothing is ever deleted by applying.
- **Nothing is kept**: the description lives in the browser only.
- **It needs an AI key**, and it is for administrators only. An invited member never sees it.
- **It is slow and can fail.** One request can take tens of seconds, with no streaming. It may end with "the AI gave nothing usable". Both need a real state.
- **No chat interface.** Steps and cards.
- **The design system**: the existing tokens and components (steps, cards, callouts, value chips, choices, check fields, facts, empty state, loading). A new component is allowed when argued for ([the design, section 8](../4-design.md#8-adding-to-the-design)). It must hold in light and dark, below 860 px, in French (20 to 30 % longer), and under another brand.

## Open: yours to propose

- The blank page: how to help someone write a useful description (prompts, examples by kind of organisation, a few structured questions instead of free text).
- Whether proposed items can be adjusted before applying (a name, a colour, a value dropped) or only ticked.
- How to say "not quite" and ask again without starting over.
- How a rule is shown to someone who does not read code.
- Whether to show what a proposal would do to the mail already fetched ("this board would show 12 of your 40 emails"). saras can compute this itself, without AI; it is not built.
- After applying, emails already kept can be sorted again by the new rules (today a tick box, on by default). Where does that belong?

## What to return

- The step of getting started, in every state: empty, waiting, questions, proposal, applied, failed, no key, skipped.
- The entry points in Sorting: on the list of attributes, on the form of an attribute, on the form of a board.
- The returning case.
- Wording in English and French for anything new.
- For each open question, your choice and why; and anything that needs the server to do something it does not do today, listed apart.

## With the repository

[`DESIGN.md`](../../DESIGN.md) says how to run saras with Node.js alone (`npm run design`) and where to look. Then: [the design](../4-design.md), sections 5 and 6; the style guide at `/styleguide.html`; the page as it is at `#/attributes/assistant`; the path at `#/welcome`.

## What an answer will cost the server

Known before the answer, so that it is not a surprise:

- **A narrow ask is a new skill.** "Propose one attribute" or "fix this rule" each need a skill in `src/assistant/skills/` and an operation in `src/domain/advice/`, as decision 0017 lays out.
- **Showing what a proposal would do needs a new observation**: the proposed rules and filters tried on the emails already kept, by the server, without AI.
