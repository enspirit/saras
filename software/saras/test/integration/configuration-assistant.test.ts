// The assistant proposes a configuration: from what an administrator says of the organisation,
// questions first when it needs to know more, then a few attributes with their rules and a
// few boards — read before anything is applied, and applied as any configuration is.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ATTEMPTS } from '../../src/assistant/perform.ts';
import { createClient, join } from '../support/client.ts';
import { connectInbox } from '../support/connected-mailbox.ts';
import { startStack } from '../support/stack.ts';
import type { Stack } from '../support/stack.ts';

let stack: Stack;
const client = () => createClient(() => stack.url);
const alice = client(); // administrator
const bruno = client(); // member

before(async () => {
  stack = await startStack();
  assert.equal((await alice('POST', '/auth/signup', { email: 'alice@acme.example', password: 'un-bon-mot-de-passe', organization: 'Acme', language: 'fr' })).status, 201);
  await connectInbox(alice, stack.imapAccount);
});
after(() => stack.stop());

const description = 'Un cabinet comptable. Nous recevons des factures de fournisseurs et des questions de nos clients.';
const question = { question: 'Comment reconnaît-on une facture ?', choices: ['Le sujet dit « facture »', 'Une pièce jointe PDF'] };
const answers = [{ question: question.question, answer: 'Le sujet dit « facture »' }];
const priority = { name: 'Priorité', kind: 'choice', values: [{ label: 'Haute', color: 'red' }, { label: 'Normale', color: 'grey' }, { label: 'Basse', color: 'blue' }], decidedBy: 'nobody', elo: '' };
const subject = { name: 'Sujet', kind: 'choice', values: [{ label: 'Facture', color: 'orange' }, { label: 'Question', color: 'blue' }], decidedBy: 'elo', elo: `if contains(lower(_.subject), 'facture') then 'Facture' else null` };
const invoices = { name: 'Factures à traiter', filter: { attributes: { Sujet: ['Facture'], status: ['todo'] } } };
const proposal = { summary: 'Un sujet, décidé par une règle, et un tableau pour les factures.', attributes: [priority, subject], boards: [invoices] };

/** Asks the assistant, the model answering these texts in turn; how many requests that took. */
async function ask(wanted: object, ...modelSays: object[]) {
  const before = stack.llmRequests.length;
  stack.llmAnswers.push(...modelSays.map((said) => JSON.stringify(said)));
  const { status, body } = await alice('POST', '/assistant/configuration', wanted);
  const requests = stack.llmRequests.slice(before);
  stack.llmAnswers.length = 0;
  return { status, body, requests };
}

test('asked with what the organisation does, the assistant may first ask what it needs to know; the model is sent that text and the configuration as it is, and no email', async () => {
  const { status, body, requests } = await ask({ description }, { questions: [question, 'Qui répond aux clients ?'] });
  assert.equal(status, 200);
  assert.deepEqual(body, { kind: 'questions', questions: [question, { question: 'Qui répond aux clients ?', choices: [] }] });
  assert.equal(requests.length, 1);
  const { authorization, body: sent } = requests[0]!;
  assert.deepEqual([authorization, sent.model, sent.provider], ['Bearer sk-or-test', 'test/model', { zdr: true, data_collection: 'deny' }], 'with the key and the model in force, under the zero-retention clause');
  const [system, user] = sent.messages;
  assert.match(system!.content, /^You help the administrator of an organisation set up saras/);
  assert.match(system!.content, /in French\./, 'in the language of who asks');
  assert.ok(user!.content.includes(description));
  assert.deepEqual(JSON.parse(user!.content.match(/<configuration>\n([\s\S]*)\n<\/configuration>/)![1]!), (await alice('GET', '/configuration')).body);
  assert.doesNotMatch(JSON.stringify(sent), /Demande de devis|Claire|claire@client\.example|me@corp\.example|alice@acme\.example|CONTENU-NEWSLETTER/, 'nothing of an email, of a mailbox or of a member');
});

test('answered, it proposes: what is wrong in what the model wrote is told to it, and what it then gives is a configuration that would be applied as it is', async () => {
  const wrong = { ...proposal, attributes: [{ ...subject, elo: `if contains(_.subjet, 'facture') then 'Facture' else null` }], boards: [{ ...invoices, filter: { attributes: { Sujet: ['Factures'] } } }] };
  const before = (await alice('GET', '/configuration')).body;
  const { status, body, requests } = await ask({ description, answers }, wrong, proposal);
  assert.equal(status, 200);
  assert.equal(requests.length, 2);
  assert.match(requests[1]!.body.messages[1]!.content, /<answers>\nQ: Comment reconnaît-on une facture \?\nA: Le sujet dit « facture »\n<\/answers>/);
  const [, , again, objection] = requests[1]!.body.messages;
  assert.deepEqual([again!.role, JSON.parse(again!.content).attributes[0].name, objection!.role], ['assistant', 'Sujet', 'user']);
  assert.match(objection!.content, /- attributes\[0\]: The rule cannot be read: .*'subjet' is not a field/);
  assert.match(objection!.content, /- boards\[0\]\.filter: “Factures” is not a value of “Sujet”\./);
  assert.deepEqual(body, { kind: 'proposal', summary: proposal.summary, configuration: { attributes: [subject], boards: [invoices] } }, 'only what is new: the priority the organisation has as it is, is left out');
  assert.deepEqual((await alice('POST', '/configuration/check', body.configuration)).body, []);
  assert.deepEqual((await alice('GET', '/configuration')).body, before, 'proposing applies nothing');
});

test('what was proposed is applied as any configuration is; asked again, what the organisation now has is no longer proposed', async () => {
  const { body } = await ask({ description, answers }, proposal);
  assert.equal((await alice('PUT', '/configuration', body.configuration)).status, 200);
  assert.deepEqual((await alice('GET', '/boards')).body.map((b: { name: string; shared: boolean }) => [b.name, b.shared]), [['Factures à traiter', true]]);
  const again = await ask({ description, answers }, { ...proposal, boards: [invoices, { name: 'Questions', filter: { attributes: { sujet: ['question'] } } }] });
  assert.deepEqual(again.body.configuration, { attributes: [], boards: [{ name: 'Questions', filter: { attributes: { sujet: ['question'] } } }] });
});

test('it asks once, and proposes little: questions after answers, or more than a few attributes and boards, are sent back to the model', async () => {
  const many = { ...proposal, attributes: ['A', 'B', 'C', 'D'].map((name) => ({ ...priority, name })), boards: [] };
  const { status, body, requests } = await ask({ description, answers: [{ question: question.question, answer: '' }] }, { questions: [question] }, many, { summary: '', attributes: [], boards: [] });
  assert.deepEqual([status, requests.length], [200, 3]);
  assert.match(requests[1]!.body.messages.at(-1)!.content, /You asked already, and were answered/);
  assert.match(requests[2]!.body.messages.at(-1)!.content, /At most 3 attributes/);
  assert.deepEqual(body, { kind: 'proposal', summary: '', configuration: { attributes: [], boards: [] } }, 'nothing to change is an answer too');
});

test('a model that gives nothing usable is asked a few times, then the request is refused as the LLM\'s failure', async () => {
  const { status, body, requests } = await ask({ description }, ...Array(ATTEMPTS + 1).fill({ suggestion: 'Un sujet.' }));
  assert.deepEqual([status, body.code, requests.length], [502, 'assistant.noUsableAnswer', ATTEMPTS]);
});

test('nothing is asked of the model without something said of the organisation, nor by a member; the LLM\'s own refusals are told as they are', async () => {
  const before = stack.llmRequests.length;
  assert.deepEqual([(await ask({ description: '  ' })).body.code, (await ask({})).status], ['assistant.descriptionRequired', 400]);
  await join(alice, bruno, 'bruno@acme.example');
  assert.equal((await bruno('POST', '/assistant/configuration', { description })).status, 403);
  assert.equal(stack.llmRequests.length, before);
  assert.equal((await alice('PUT', '/organization', { model: 'nozdr/model' })).status, 200);
  const refused = await ask({ description });
  assert.deepEqual([refused.status, refused.body.code, refused.requests.length], [502, 'llm.noZdrProvider', 1], 'no provider that keeps nothing: not asked again');
});
