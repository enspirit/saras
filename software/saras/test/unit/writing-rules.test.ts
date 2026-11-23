// Writing rules: a rule is checked against what it is given, and an AI agent can be handed a
// skill that says how to write one.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EMAIL_FOR_RULES } from '../../shared/attribute.ts';
import type { Attribute } from '../../shared/attribute.ts';
import { emailForRules } from '../../src/domain/computations/attributes.ts';
import { DEFAULT_STATUS_RULE } from '../../src/domain/computations/default-rules.ts';
import { SKILL_NAME, ruleWritingSkill } from '../../src/domain/computations/rule-writing-skill.ts';
import { EloError, compileRule, problemsOf } from '../../src/tooling/elo.ts';
import { zip } from '../../src/tooling/zip.ts';
import { email } from '../support/email-from-claire.ts';

const topic: Attribute = { key: '7', name: 'Topic', kind: 'choice', values: [{ key: '1', label: 'Billing' }, { key: '2', label: 'Support' }], decidedBy: 'elo', elo: '', system: false };

test('a rule is checked against the type of the email it is given: what an email does not have is refused before any email meets it', () => {
  assert.deepEqual(problemsOf(`if contains(lower(_.subject), 'devis') then 'Sales' else null`, EMAIL_FOR_RULES), []);
  assert.match(problemsOf('_.subjet', EMAIL_FOR_RULES)[0]!, /^1:3: error: 'subjet' is not a field\. Declared: from, to, cc, subject/);
  assert.match(problemsOf('upper(_.answered)', EMAIL_FOR_RULES)[0]!, /No signature of upper accepts upper\(Bool\)/);
  assert.match(problemsOf(`if _.subject then 'a' else 'b'`, EMAIL_FOR_RULES)[0]!, /if condition must be Bool, got String/);
  assert.match(problemsOf(`if any(_.to, t ~> t.adress == 'x') then 'a' else null`, EMAIL_FOR_RULES)[0]!, /'adress' is not a field/);
  assert.throws(() => compileRule('_.subjet', EMAIL_FOR_RULES), EloError);
  assert.equal(compileRule('_.subjet').run({ subjet: 'x' }), 'x', 'without a type, a rule is only read');
});

test('the type the checker reads is the shape rules are really given, and the rule "Stands in" starts with fits it', () => {
  const given = emailForRules({ providerId: '1', threadId: null, attachments: [], ...email, headers: {}, answered: false }, 'me@corp.example');
  const declared = [...EMAIL_FOR_RULES.matchAll(/^  (\w+):/gm)].map((m) => m[1]);
  assert.deepEqual(declared.sort(), Object.keys(given).sort());
  assert.deepEqual(problemsOf(DEFAULT_STATUS_RULE, EMAIL_FOR_RULES), []);
});

test('the skill handed to an AI agent names the attribute and its values, and every rule it shows is one saras accepts', () => {
  const skill = ruleWritingSkill(topic);
  assert.match(skill, new RegExp(`^---\\nname: ${SKILL_NAME}\\ndescription: .+\\n---\\n`));
  assert.match(skill, /attribute \*\*Topic\*\*/);
  assert.match(skill, /- `'Billing'`\n- `'Support'`/);
  assert.ok(skill.includes(EMAIL_FOR_RULES), 'it carries the type of what a rule is given');
  const rules = [...skill.matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => m[1]!).filter((block) => !block.startsWith('{'));
  assert.equal(rules.length, 3);
  for (const rule of rules) assert.deepEqual(problemsOf(rule, EMAIL_FOR_RULES), [], rule);
  assert.match(ruleWritingSkill(null), /Ask which attribute the rule is for/);
});

test('every Elo function the skill names exists', () => {
  const uses = `let s = lower(upper(trim(_.subject))), parts = split(s, ' ') in
    if contains(s, 'a') && startsWith(s, 'a') && endsWith(s, 'a') && length(s) > 0 && !isBlank(replace(s, 'a', 'b'))
      && length(parts) > 0 && contains(parts, 'a') && any(parts, x ~> x == 'a') && all(parts, x ~> x == 'a')
      && length(filter(parts, x ~> x == 'a')) > 0 && length(map(parts, x ~> upper(x))) > 0
    then (null | 'Billing') else null`;
  assert.deepEqual(problemsOf(uses, EMAIL_FOR_RULES), []);
  assert.equal(compileRule(uses, EMAIL_FOR_RULES).run({ subject: 'b' }), null);
});

test('the skill is downloaded as an archive holding its folder and its one file', () => {
  const archive = zip([{ path: `${SKILL_NAME}/SKILL.md`, content: ruleWritingSkill(topic) }]);
  assert.equal(archive.subarray(0, 4).toString('latin1'), 'PK\x03\x04');
  assert.equal(archive.subarray(-22, -18).toString('latin1'), 'PK\x05\x06');
  assert.equal(archive.readUInt16LE(archive.length - 12), 1, 'one file');
  assert.ok(archive.includes(Buffer.from(`${SKILL_NAME}/SKILL.md`)));
  assert.ok(archive.includes(Buffer.from('attribute **Topic**')), 'stored as it is, readable');
});
