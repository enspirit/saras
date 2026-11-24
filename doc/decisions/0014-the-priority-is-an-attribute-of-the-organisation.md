# 0014 — The priority is an attribute of the organisation; only where an email stands is pre-configured

## Context

Two attributes were pre-configured: **Stands in** and **Priority**. Their name and their values were fixed, "because the application relies on them".

For where an email stands, it does. Its four values are the four boxes and the column `emails.status`; an email is replied by replying to it, which no rule and no member can say otherwise; one that nobody placed is to handle, not without a value.

For the priority, it did not. Nothing saras does depended on it: no list was ordered by it, no email was treated differently. What leaned on it was its own plumbing: a column of its own (`emails.priority`), written beside the value by each operation that set one; a "Priority" mark on a row of a list when it was high; and "normal" as what an email had before anyone decided. For that, an organisation could not call it Urgency, give it two values or five, nor take it away when it does not sort by priority.

## Decision

The priority is one of the organisation's own attributes, like those it makes: a row of `attributes`, named by its number, its values by their place.

A new organisation starts with it, **Priority: High, Normal, Low**, in the language of who creates the organisation, set by hand. It is the organisation's from then on: renamed, given other values or a rule, deleted.

**Stands in** is the only pre-configured attribute. Its name and its four values stay fixed; how it is decided and the colours of its values are the organisation's.

## Alternatives

- **Keep it pre-configured, and let its values be changed.** The application would keep a column and a mark for values it no longer knows; pre-configured would mean nothing but "cannot be deleted".
- **Keep the column as a copy the lists read.** One fact in two places, held together by every operation that sets a value: three did, and a fourth would have to.
- **Start an organisation with no attribute of its own.** The page of attributes would open on one line that cannot be changed. Most teams mark what is urgent, and the priority shows what an attribute is; who does not want it deletes it.

## Consequences

- **An email has no priority until a rule or a member gives it one**, as for any attribute. "Normal" was where every email started; it is now a value like the others. A board or a prompt that asks for "Priority is Normal" shows the emails given Normal, not those nobody looked at; an organisation that wants every email to have one writes a rule that ends with it.
- In a list, a row shows the priority as the chip of its value, like any attribute, where it showed a "Priority" mark on high ones only.
- Migration `0006-priority-is-an-attribute-like-any-other` gives each organisation its priority as an attribute of its own, with the rule and the colours it had, and has what named it name it by its number: the values of emails with who decided each, the filters of boards, what prompts suit. A priority nobody decided (the AI's, when it sorted) is kept as nobody's.
- A migrated priority is named in English, **Priority: High, Normal, Low**: a rule names a value by its label, and the rules written until now answer `'high'`. Where no rule was written and the organisation's first administrator reads French, it is named in French, as the interface named it. Renaming a value means changing the rule that names it, as for any attribute.
- `emails.priority` stays in the schema, neither written nor read: the version before this one still uses it, and a later migration removes it once no server of that version is left ([decision 0010](0010-the-server-migrates-its-database-and-several-may-share-it.md)). While both run, the version before shows a priority of its own beside the organisation's.
- An email as the API tells it has no `priority` any more: its priority is in `attributes`, under the key of the attribute. `priority` is no longer a key: a filter or what a prompt suits that names it, as an interface loaded before this version may still send, is kept without it, like any attribute we do not know.
- The demo's seed is rebuilt: its priority is the one its organisation started with, given a rule.

## What would reverse it

saras coming to act on the priority itself: lists ordered by it, a notice on what is urgent. It would then need values it knows. Even so, the first thing to try would be to have that behaviour name an attribute and a value the organisation chose, rather than to fix an attribute again.
