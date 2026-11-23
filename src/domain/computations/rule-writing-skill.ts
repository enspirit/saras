// Pure: the skill an AI agent is handed to write the rule of an attribute — what saras asks
// of a rule, what a rule is given, and enough of Elo to write one. Written for the agent.
import { EMAIL_FOR_RULES } from '../../../shared/attribute.ts';
import type { Attribute } from '../../../shared/attribute.ts';

export const SKILL_NAME = 'saras-elo-rule';

const FRONT_MATTER = `---
name: ${SKILL_NAME}
description: Write, fix or explain a sorting rule in Elo for an attribute of emails in saras. Use when someone asks for the rule that decides an attribute (a topic, an assignee, a priority, where an email stands) from the content of an email.
---`;

/** The attribute the rule is for, when the skill was downloaded from one. */
function attributePart(attribute: Attribute | null): string {
  if (!attribute) return 'Ask which attribute the rule is for, and the exact list of its values, before writing anything.';
  const values = attribute.values.map((v) => `- \`'${v.label}'\``).join('\n');
  const members = attribute.kind === 'member' ? '\nIts values are the members of the organisation: answer the email address of one of them.' : '';
  return `This skill was downloaded for the attribute **${attribute.name}**. Its values are:\n\n${values}${members}`;
}

const CONTRACT = `## What a rule is

saras is a tool to answer email. An organisation gives its emails *attributes* (a topic, an
assignee, a priority…), each with a short list of values. When an email is fetched, the *rule*
of an attribute decides its value at no cost, without any AI.

A rule is **one Elo expression**. It is given the email as \`_\` and must answer:

- the label of one of the attribute's values, as a string, exactly as written (case aside);
- or \`{value: '<label>', reason: '<a few words>'}\` to also say why;
- or \`null\` to say nothing: the attribute then stays undecided for that email.

Anything else is taken as \`null\`. A rule cannot read anything but the email, and has 100 ms to answer.`;

const INPUT = `## What a rule is given

\`_\` has this type, in Elo's own notation. The rule is type-checked against it when it is
saved: naming a field that is not there, or using a text as a number, is refused.

\`\`\`
${EMAIL_FOR_RULES}
\`\`\`

- \`_.text\` is the plain text of the email; it is empty for an old email whose content was erased.
- \`_.mailbox\` is the address of the mailbox the email arrived in.
- \`_.date\` is an ISO 8601 string.
- The four headers are empty strings when the email does not have them.`;

const ELO = `## Enough Elo to write a rule

Elo (https://elo-lang.org) is a small expression language: no statements, no loops, no regular expressions.

- Conditions: \`if a then b else c\`, chained with \`else if\`. A condition must be a Bool.
- Names: \`let x = …, y = … in <expression>\`.
- Logic: \`&&\`, \`||\`, \`!\`; comparisons \`==\`, \`!=\`, \`<\`, \`>\`, \`<=\`, \`>=\`.
- Text: \`lower(s)\`, \`upper(s)\`, \`trim(s)\`, \`contains(s, part)\`, \`startsWith(s, p)\`, \`endsWith(s, p)\`, \`length(s)\`, \`split(s, sep)\`, \`replace(s, a, b)\`, \`isBlank(s)\`.
- Lists: \`length(list)\`, \`contains(list, item)\`, \`any(list, x ~> …)\`, \`all(list, x ~> …)\`, \`filter(list, x ~> …)\`, \`map(list, x ~> …)\`.
- Pipe: \`a |> f(b)\` is \`f(a, b)\`. Fallback: \`a | b\` is \`b\` when \`a\` is null.
- Strings are in single quotes. Comments start with \`#\`.

Compare text in lower case: \`contains(lower(_.subject), 'invoice')\`, never the raw subject.`;

const EXAMPLES = `## Examples

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

const DELIVERY = `## How to answer

1. If what decides each value is not clear, ask: which senders, words, recipients or mailboxes mean which value.
2. Give **the rule alone in one code block**, ready to paste. Use only the fields of \`_\` above and the exact labels of the values.
3. End with \`else null\` unless one value really is the default.
4. Say in a sentence or two what the rule does, in plain words, so that it can be checked by reading it.
5. Tell the person to paste it in saras (Configuration → Attributes → the attribute → The rule), press
   **Try it on recent emails** to see what it says of their last twenty emails, then save — and
   **Save and apply to the emails already kept** if it should look again at those.

If saras refuses the rule, it gives Elo's message with the line and column: fix that, and nothing else.`;

/** The skill, as the one file an agent reads: SKILL.md. */
export const ruleWritingSkill = (attribute: Attribute | null): string =>
  [FRONT_MATTER, `# Writing the rule of an attribute in saras`, attributePart(attribute), CONTRACT, INPUT, ELO, EXAMPLES, DELIVERY].join('\n\n') + '\n';
