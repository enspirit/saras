// What the assistant knows of rules: what saras asks of one, what it is given, and enough of
// Elo to write one. Written for a model, and said once: every skill that has a rule written
// tells it with these words.
import { EMAIL_FOR_RULES } from '../../../shared/attribute.ts';

export const WHAT_A_RULE_IS = `## What a rule is

saras is a tool to answer email. An organisation gives its emails *attributes* (a topic, an
assignee, a priority…), each with a short list of values. When an email is fetched, the *rule*
of an attribute decides its value at no cost, without any AI.

A rule is **one Elo expression**. It is given the email as \`_\` and must answer:

- one of the attribute's values, as a string, exactly as it is listed (case aside);
- or \`{value: '<value>', reason: '<a few words>'}\` to also say why;
- or \`null\` to say nothing: the attribute then stays undecided for that email.

Anything else is taken as \`null\`. A rule cannot read anything but the email, and has 100 ms to answer.`;

export const WHAT_A_RULE_IS_GIVEN = `## What a rule is given

\`_\` has this type, in Elo's own notation. The rule is type-checked against it when it is
saved: naming a field that is not there, or using a text as a number, is refused.

\`\`\`
${EMAIL_FOR_RULES}
\`\`\`

- \`_.text\` is the plain text of the email; it is empty for an old email whose content was erased.
- \`_.mailbox\` is the address of the mailbox the email arrived in.
- \`_.date\` is an ISO 8601 string.
- The four headers are empty strings when the email does not have them.`;

export const ENOUGH_ELO = `## Enough Elo to write a rule

Elo (https://elo-lang.org) is a small expression language: no statements, no loops, no regular expressions.

- Conditions: \`if a then b else c\`, chained with \`else if\`. A condition must be a Bool.
- Names: \`let x = …, y = … in <expression>\`.
- Logic: \`&&\`, \`||\`, \`!\`; comparisons \`==\`, \`!=\`, \`<\`, \`>\`, \`<=\`, \`>=\`.
- Text: \`lower(s)\`, \`upper(s)\`, \`trim(s)\`, \`contains(s, part)\`, \`startsWith(s, p)\`, \`endsWith(s, p)\`, \`length(s)\`, \`split(s, sep)\`, \`replace(s, a, b)\`, \`isBlank(s)\`.
- Lists: \`length(list)\`, \`contains(list, item)\`, \`any(list, x ~> …)\`, \`all(list, x ~> …)\`, \`filter(list, x ~> …)\`, \`map(list, x ~> …)\`.
- Pipe: \`a |> f(b)\` is \`f(a, b)\`. Fallback: \`a | b\` is \`b\` when \`a\` is null.
- Strings are in single quotes. Comments start with \`#\`.

Compare text in lower case: \`contains(lower(_.subject), 'invoice')\`, never the raw subject.`;

export const RULE_EXAMPLES = `## Examples

A topic, from the subject and the sender:

\`\`\`
let subject = lower(_.subject), sender = lower(_.from.address) in
  if contains(subject, 'invoice') || contains(subject, 'facture') then 'Billing'
  else if endsWith(sender, '@bigclient.example') then {value: 'Key account', reason: 'From bigclient.example'}
  else null
\`\`\`

By the address it was sent to:

\`\`\`
if any(_.to, t ~> lower(t.address) == 'support@acme.example') then 'Support' else null
\`\`\`

With attachments, from outside the organisation:

\`\`\`
if length(_.attachments) > 0 && !endsWith(lower(_.from.address), '@acme.example') then 'To review' else null
\`\`\``;

/** Everything about rules, in the order it is read. */
export const WRITING_RULES = [WHAT_A_RULE_IS, WHAT_A_RULE_IS_GIVEN, ENOUGH_ELO, RULE_EXAMPLES].join('\n\n');
