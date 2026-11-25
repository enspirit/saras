// Pure: the skill an AI agent of the administrator's own is handed to write the rule of an
// attribute, as a file to download. What it says of rules is what the assistant knows of them.
import { saidInRule, valuesForRules } from '../../../shared/attribute.ts';
import type { Attribute } from '../../../shared/attribute.ts';
import { WRITING_RULES } from '../../assistant/knowledge/rules.ts';

export const SKILL_NAME = 'saras-elo-rule';

const FRONT_MATTER = `---
name: ${SKILL_NAME}
description: Write, fix or explain a sorting rule in Elo for an attribute of emails in saras. Use when someone asks for the rule that decides an attribute (a topic, an assignee, a priority, where an email stands) from the content of an email.
---`;

/** The attribute the rule is for, when the skill was downloaded from one. */
function attributePart(attribute: Attribute | null): string {
  if (!attribute) return 'Ask which attribute the rule is for, and the exact list of its values, before writing anything.';
  const values = valuesForRules(attribute).map((v) => `- \`'${saidInRule(attribute, v)}'\`${attribute.system ? ` (${v.label})` : ''}`).join('\n');
  const members = attribute.kind === 'member' ? '\nIts values are the members of the organisation: answer the email address of one of them.' : '';
  return `This skill was downloaded for the attribute **${attribute.name}**. Its values are:\n\n${values}${members}`;
}

const DELIVERY = `## How to answer

1. If what decides each value is not clear, ask: which senders, words, recipients or mailboxes mean which value.
2. Give **the rule alone in one code block**, ready to paste. Use only the fields of \`_\` above and the values exactly as they are listed.
3. End with \`else null\` unless one value really is the default.
4. Say in a sentence or two what the rule does, in plain words, so that it can be checked by reading it.
5. Tell the person to paste it in saras (Configuration → Attributes → the attribute → The rule), press
   **Try it on recent emails** to see what it says of their last twenty emails, then save — and
   **Save and apply to the emails already kept** if it should look again at those.

If saras refuses the rule, it gives Elo's message with the line and column: fix that, and nothing else.`;

/** The skill, as the one file an agent reads: SKILL.md. */
export const ruleWritingSkill = (attribute: Attribute | null): string =>
  [FRONT_MATTER, `# Writing the rule of an attribute in saras`, attributePart(attribute), WRITING_RULES, DELIVERY].join('\n\n') + '\n';
