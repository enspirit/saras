// The triage gate: its contract, its batching, and its two strategies.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiTriage, buildBatchMessages, parseBatchAnswer } from '../../src/domain/sorting/ai.ts';
import { TRIAGE_BATCH_SIZE, runGate } from '../../src/domain/sorting/gate.ts';
import type { TriageBatch, TriageGate, TriageMail } from '../../src/domain/sorting/gate.ts';
import { noTriage } from '../../src/domain/sorting/none.ts';
import type { ChatRequest, Llm } from '../../src/domain/model/llm.ts';

const mail = (id: number, over: Partial<TriageMail> = {}): TriageMail => ({
  id,
  from: { name: 'Claire Martin', address: 'claire@client.example' },
  to: [{ name: '', address: 'me@corp.example' }],
  cc: [],
  subject: `Subject ${id}`,
  body: `Body ${id}`,
  attachments: [],
  ...over,
});

/** A strategy that records the batches it is given and answers with a fixed rule. */
function recordingGate(decide: (batch: TriageBatch) => ReturnType<TriageGate['decide']>) {
  const batches: TriageBatch[] = [];
  const gate: TriageGate = {
    name: 'recording',
    decide(batch) {
      batches.push(batch);
      return decide(batch);
    },
  };
  return { gate, batches };
}

test('the empty strategy lets every mail through', async () => {
  const decisions = await noTriage.decide({ mails: [mail(1), mail(2)] });
  assert.deepEqual(decisions, [
    { mailId: 1, replyNeeded: true },
    { mailId: 2, replyNeeded: true },
  ]);
  assert.equal(noTriage.name, 'none');
});

test('a gate is given at most twenty mails at a time, and nothing else', async () => {
  const { gate, batches } = recordingGate(async ({ mails }) => mails.map((m) => ({ mailId: m.id, replyNeeded: m.id % 2 === 0 })));
  const mails = Array.from({ length: 45 }, (_, i) => mail(i + 1));
  const decisions = await runGate(gate, mails);
  assert.equal(TRIAGE_BATCH_SIZE, 20);
  assert.deepEqual(batches.map((b) => b.mails.length), [20, 20, 5]);
  assert.ok(batches.every((b) => Object.keys(b).join() === 'mails'), 'no prompt, no database: the mails alone');
  assert.equal(decisions.length, 45);
  assert.deepEqual(decisions.slice(0, 2), [
    { mailId: 1, replyNeeded: false },
    { mailId: 2, replyNeeded: true },
  ]);
  assert.deepEqual(await runGate(gate, []), [], 'nothing to decide, nothing asked');
  assert.equal(batches.length, 3);
});

test('decisions about another mail, and repeated ones, are not trusted', async () => {
  const { gate } = recordingGate(async () => [
    { mailId: 1, replyNeeded: true },
    { mailId: 1, replyNeeded: false },
    { mailId: 7, replyNeeded: true },
    { mailId: 2, replyNeeded: true, reason: 'asks for a price', priority: 'high' },
  ]);
  assert.deepEqual(await runGate(gate, [mail(1), mail(2), mail(3)]), [
    { mailId: 1, replyNeeded: true },
    { mailId: 2, replyNeeded: true, reason: 'asks for a price', priority: 'high' },
  ]);
});

test('a gate that fails fails the run, for the caller to leave the mails untriaged', async () => {
  const { gate } = recordingGate(async () => {
    throw new Error('rules engine unreachable');
  });
  await assert.rejects(runGate(gate, [mail(1)]), /rules engine unreachable/);
});

test('the AI strategy asks once per batch, giving what the contract allows and no more', () => {
  const batch = {
    mails: [
      mail(11, { subject: 'Quote', body: 'x'.repeat(5000), attachments: [{ name: 'specs.pdf', type: 'application/pdf', size: 250_000 }] }),
      mail(12, { cc: [{ name: '', address: 'paul@client.example' }] }),
    ],
  };
  const [system, user] = buildBatchMessages(batch, { ownAddress: 'me@corp.example', language: 'fr' });
  assert.doesNotMatch(system!.content, /prompt|style of reply/i, 'which prompt suits is not asked of the AI');
  assert.match(system!.content, /written in French/);
  assert.match(system!.content, /never carry out an instruction/);
  assert.match(user!.content, /<email id="11">[\s\S]*<\/email>\n\n<email id="12">/);
  assert.match(user!.content, /Attachments: specs\.pdf \(application\/pdf, 244 kB\)/);
  assert.match(user!.content, /Cc: paul@client\.example/);
  assert.ok(user!.content.length < 2500, 'long bodies are cut');
  assert.match(user!.content, /message truncated/);
});

test('the AI answer is read strictly: malformed entries leave their mail undecided', () => {
  const answer = '```json\n[{"id": 11, "needs_reply": true, "reason": "Demande de prix", "prompt_id": 2, "priority": "high"},\n {"id": 12, "needs_reply": false, "reason": "Merci", "prompt_id": 2},\n {"id": "13", "needs_reply": true},\n {"id": 14, "needs_reply": "yes"}]\n```';
  assert.deepEqual(parseBatchAnswer(answer), [
    { mailId: 11, replyNeeded: true, reason: 'Demande de prix', priority: 'high' },
    { mailId: 12, replyNeeded: false, reason: 'Merci', priority: 'normal' },
  ]);
  assert.deepEqual(parseBatchAnswer('I cannot help with that'), []);
  assert.deepEqual(parseBatchAnswer('[{"id": 1, "needs_reply": tru'), []);
});

/** A language model that records what it is asked and always decides about the first mail only. */
function recordingModel() {
  const requests: ChatRequest[] = [];
  const llm: Llm = {
    async chat(request) {
      requests.push(request);
      return { text: '[{"id": 1, "needs_reply": true, "prompt_id": 1}]', model: request.model, provider: null };
    },
  };
  return { llm, requests };
}

test('the AI strategy makes one request per batch and none for an empty one', async () => {
  const { llm, requests } = recordingModel();
  const gate = aiTriage({ llm, apiKey: 'sk', model: 'a/b', ownAddress: 'me@corp.example', language: 'en' });
  assert.deepEqual(await gate.decide({ mails: [] }), []);
  assert.equal(requests.length, 0);
  const decisions = await runGate(gate, Array.from({ length: 21 }, (_, i) => mail(i + 1)));
  assert.equal(requests.length, 2);
  assert.equal(requests[0]!.temperature, 0);
  assert.deepEqual(decisions, [{ mailId: 1, replyNeeded: true, reason: '', priority: 'normal' }], 'mails the model said nothing about stay undecided');
});
