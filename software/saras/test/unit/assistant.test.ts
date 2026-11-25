// The assistant: what a skill tells a model, how it reads what comes back, and how a model is
// asked again when its answer will not do. No model is asked here: the means are given.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EMAIL_FOR_RULES } from '../../shared/attribute.ts';
import type { Configuration } from '../../shared/configuration.ts';
import { SMALL } from '../../src/assistant/knowledge/configuration.ts';
import { WRITING_RULES } from '../../src/assistant/knowledge/rules.ts';
import { ATTEMPTS, Unusable, perform } from '../../src/assistant/perform.ts';
import type { Skill, Turn } from '../../src/assistant/skill.ts';
import { CONFIGURE_ORGANISATION } from '../../src/assistant/skills/configure-organisation.ts';
import type { ConfigurationAsked } from '../../src/assistant/skills/configure-organisation.ts';
import { problemsOf } from '../../src/tooling/elo.ts';

const current: Configuration = { attributes: [{ name: 'Priorité', kind: 'choice', values: [{ label: 'Haute', color: 'red' }, { label: 'Basse', color: 'blue' }], decidedBy: 'nobody', elo: '' }], boards: [] };
const asked: ConfigurationAsked = { description: 'Un cabinet comptable : factures, questions de clients.', answers: [], current, language: 'French' };
const answered: ConfigurationAsked = { ...asked, answers: [{ question: 'Qui sont vos grands clients ?', answer: '' }] };

test('the skill tells a model what is configured, how small, how to answer and how a rule is written; then what the administrator said and what there is', () => {
  const [system, user, ...more] = CONFIGURE_ORGANISATION.brief(answered) as [Turn, Turn];
  assert.deepEqual([system.role, user.role, more.length], ['system', 'user', 0]);
  assert.match(system.content, new RegExp(`At most ${SMALL.attributes} attributes and ${SMALL.boards} boards`));
  assert.match(system.content, new RegExp(`at most ${SMALL.questions} short questions`));
  assert.match(system.content, /One JSON object and nothing else/);
  assert.match(system.content, /in French\./);
  assert.ok(system.content.includes(WRITING_RULES) && system.content.includes(EMAIL_FOR_RULES), 'what a rule is given, and enough Elo');
  assert.match(user.content, /<organisation>\nUn cabinet comptable : factures, questions de clients\.\n<\/organisation>/);
  assert.match(user.content, /<answers>\nQ: Qui sont vos grands clients \?\nA: \(no answer: as you see fit\)\n<\/answers>/);
  assert.deepEqual(JSON.parse(user.content.match(/<configuration>\n([\s\S]*)\n<\/configuration>/)![1]!), current);
  assert.doesNotMatch(CONFIGURE_ORGANISATION.brief(asked)[1]!.content, /<answers>/, 'no answers before anything was asked');
});

test('every rule the assistant shows a model is one saras accepts', () => {
  const rules = [...WRITING_RULES.matchAll(/```\n([\s\S]*?)\n```/g)].map((match) => match[1]!).filter((block) => !block.startsWith('{'));
  assert.equal(rules.length, 3);
  for (const rule of rules) assert.deepEqual(problemsOf(rule, EMAIL_FOR_RULES), [], rule);
});

const outcome = (text: string, of: ConfigurationAsked = asked): unknown => {
  const read = CONFIGURE_ORGANISATION.read(text, of);
  return read.ok ? read.answer : read.objections.map((objection) => objection.split(/[:.]/)[0]);
};

test('an answer is read as questions or as a proposal, whatever it is wrapped in; anything else is objected to', () => {
  const proposal = { summary: ' Un sujet. ', attributes: [{ name: 'Sujet' }], boards: [] };
  const many = (n: number): unknown[] => Array.from({ length: n }, (_, i) => ({ name: `n${i}` }));
  const cases: [string, string, unknown][] = [
    ['a proposal', JSON.stringify(proposal), { kind: 'proposal', summary: 'Un sujet.', configuration: { attributes: [{ name: 'Sujet' }], boards: [] } }],
    ['in a code fence, after a sentence', 'Here it is:\n```json\n' + JSON.stringify(proposal) + '\n```', { kind: 'proposal', summary: 'Un sujet.', configuration: { attributes: [{ name: 'Sujet' }], boards: [] } }],
    ['boards alone', '{"boards": [{"name": "Urgent"}]}', { kind: 'proposal', summary: '', configuration: { attributes: [], boards: [{ name: 'Urgent' }] } }],
    ['questions, with their choices or as their text', '{"questions": [{"question": " Qui ? ", "choices": ["A", 2, "B", "C", "D", "E"]}, "Quoi ?", {"choices": ["x"]}, 4]}', { kind: 'questions', questions: [{ question: 'Qui ?', choices: ['A', 'B', 'C', 'D'] }, { question: 'Quoi ?', choices: [] }] }],
    ['no more questions than may be asked', JSON.stringify({ questions: ['a', 'b', 'c', 'd', 'e'] }), { kind: 'questions', questions: ['a', 'b', 'c'].map((question) => ({ question, choices: [] })) }],
    ['not JSON', 'I would suggest a topic.', ['Answer with one JSON object and nothing else']],
    ['a list', '[1, 2]', ['Answer with one JSON object and nothing else']],
    ['neither questions nor a proposal', '{"topic": "Sales"}', ['Answer with one JSON object and nothing else']],
    ['too many attributes, too many boards', JSON.stringify({ attributes: many(SMALL.attributes + 1), boards: many(SMALL.boards + 1) }), [`At most ${SMALL.attributes} attributes`, `At most ${SMALL.boards} boards`]],
  ];
  for (const [what, text, expected] of cases) assert.deepEqual(outcome(text), expected, what);
  assert.deepEqual(outcome('{"questions": ["Qui ?"]}', answered), ['You asked already, and were answered'], 'it asks once');
});

/** A skill that wants a number, and the means of asking a model that answers these texts in turn. */
const number: Skill<string, number> = {
  name: 'a-number',
  brief: (wanted) => [{ role: 'system', content: 'Answer a number.' }, { role: 'user', content: wanted }],
  read: (text) => (Number.isNaN(Number(text)) ? { ok: false, objections: ['not a number'] } : { ok: true, answer: Number(text) }),
};
function model(...answers: string[]) {
  const heard: Turn[][] = [];
  const ask = async (said: Turn[]): Promise<string> => { heard.push(said.map((turn) => ({ ...turn }))); return answers.shift() ?? 'nothing'; };
  return { ask, heard };
}

test('a model is asked once when its answer will do, and again with what is wrong when it will not: by how it is written, then by who asked', async () => {
  const first = model('4');
  assert.equal(await perform(number, 'an even one', first), 4);
  assert.equal(first.heard.length, 1);

  const second = model('four', '3', '8');
  const even = (answer: number): string[] => (answer % 2 ? ['it is odd'] : []);
  assert.equal(await perform(number, 'an even one', { ask: second.ask, check: even }), 8);
  assert.deepEqual(second.heard.map((said) => said.length), [2, 4, 6], 'it is told again everything said so far');
  assert.deepEqual(second.heard[2]!.slice(2).map(({ role, content }) => [role, content.split('\n')[1] ?? content]), [['assistant', 'four'], ['user', '- not a number'], ['assistant', '3'], ['user', '- it is odd']]);
});

test('it is asked a few times and no more; what asking itself throws is left to who gave the means', async () => {
  const stubborn = model('a', 'b', 'c', '4');
  await assert.rejects(perform(number, 'x', stubborn), (e: unknown) => e instanceof Unusable && e.skill === 'a-number' && e.objections[0] === 'not a number');
  assert.equal(stubborn.heard.length, ATTEMPTS);
  const down = async (): Promise<string> => { throw new Error('no key'); };
  await assert.rejects(perform(number, 'x', { ask: down }), /no key/);
});
