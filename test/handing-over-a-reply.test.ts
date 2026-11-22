// Replying, from the proposal to the mailbox: a prompt writes a proposal, the member edits
// it and says why, and the reply is handed over, sent or filed as a draft. Once per email.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, installTemplates, signUp } from './support/client.ts';
import type { ApiResponse } from './support/client.ts';
import { connectInbox } from './support/connected-mailbox.ts';
import { lastOf, writingRequests } from './support/llm-requests.ts';
import { startStack } from './support/stack.ts';
import type { Stack } from './support/stack.ts';
import type { ChatMessage } from '../src/domain/model/llm.ts';

interface PromptView {
  id: number;
  name: string;
  systemPrompt: string;
}
/** An email in full, as far as filing its reply looks. */
interface EmailDetail {
  id: number;
  messageId: string;
  draft: { id: number; html: string };
  recipients: { to: string[] };
}

let stack: Stack;
const me = createClient(() => stack.url);
let prompts: PromptView[];
/** The emails to handle once the AI has sorted the inbox: the request for a quote, then the rescheduling. */
let todo: { id: number }[];

before(async () => {
  stack = await startStack({ env: { TRIAGE_STRATEGY: 'ai' } });
  assert.equal((await signUp(me, 'bob@corp.example')).status, 201);
  await installTemplates(me);
  await connectInbox(me, stack.imapAccount);
  prompts = (await me('GET', '/prompts')).body;
  todo = (await me('GET', '/emails?box=todo')).body.emails;
  assert.equal(todo.length, 2);
});
after(() => stack.stop());

function promptNamed(name: string): PromptView {
  const prompt = prompts.find((p) => p.name === name);
  assert.ok(prompt, `no prompt named ${name}`);
  return prompt;
}

const lastDraftSystemPrompt = (): string => lastOf(writingRequests(stack.llmRequests)).body.messages[0]?.content ?? '';
/** A mail as it left, its long lines unfolded: the quoted-printable encoding folds them. */
const unfolded = (raw: string): string => raw.replace(/=\r\n/g, '');

let draft: ApiResponse;

test('a proposal is written with the chosen prompt, from the email and from what the user wrote', async () => {
  const support = promptNamed('Customer support');
  draft = await me('POST', `/emails/${todo[0]!.id}/assist`, { action: 'prompt', promptId: support.id, html: '<p>proposer 1200 euros</p>' });
  assert.equal(draft.status, 201);
  assert.match(draft.body.html, /Voici notre proposition/);
  const [system, user] = lastOf(writingRequests(stack.llmRequests)).body.messages as [ChatMessage, ChatMessage];
  assert.ok(system.content.startsWith(support.systemPrompt));
  assert.match(user.content, /proposer 1200 euros/);
  assert.match(user.content, /equiper 20 personnes/);
});

test('the proposal, edited, is sent with the reason of the change', async () => {
  const finalText = draft.body.html.replace('[À COMPLÉTER : montant]', '1200 euros HT');
  const sent = await me('POST', `/emails/${todo[0]!.id}/send`, {
    draftId: draft.body.id,
    html: finalText,
    to: ['claire@client.example'],
    cc: ['paul@client.example'],
    changeReason: 'Toujours donner le prix hors taxes',
  });
  assert.deepEqual(sent.body, { ok: true, wasEdited: true });
  assert.equal(stack.outbox.length, 1);
});

test('the reply leaves from the mailbox, to the recipients chosen, as an answer to the email it quotes', () => {
  const mail = stack.outbox[0]!;
  assert.equal(mail.from, 'me@corp.example');
  assert.deepEqual(mail.to, ['claire@client.example', 'paul@client.example']);
  assert.match(mail.raw, /^From: "?Moi Test"? <me@corp\.example>/m);
  assert.match(mail.raw, /^Subject: Re: Demande de devis pour 20 licences/m);
  assert.match(mail.raw, /^In-Reply-To: <devis-1@client\.example>/m);
  assert.match(mail.raw, /^References: <devis-1@client\.example>/m);
  // Long lines are folded by the quoted-printable encoding: undo it before reading the body.
  const body = unfolded(mail.raw);
  assert.match(body, /1200 euros HT/);
  assert.match(body, /On .* \(UTC\), Claire Martin <claire@client\.example> wrote:/, 'the quote line follows the user\'s language');
  assert.match(body, /> Nous souhaitons equiper 20 personnes/);
});

test('a sent reply is filed in the Sent folder and kept with the email, edit and reason included', async () => {
  assert.equal(stack.sentFolder().length, 1, 'a copy is filed in the Sent folder');

  const after = (await me('GET', `/emails/${todo[0]!.id}`)).body;
  assert.equal(after.status, 'sent');
  assert.equal(after.reply.wasEdited, true);
  assert.equal(after.reply.changeReason, 'Toujours donner le prix hors taxes');
});

test('an email is replied once', async () => {
  const again = await me('POST', `/emails/${todo[0]!.id}/send`, { html: '<p>bis</p>', to: ['claire@client.example'] });
  assert.equal(again.status, 409);
  assert.equal(stack.outbox.length, 1);
});

test('the reason of a correction is given to the next draft made with the same prompt', async () => {
  const support = promptNamed('Customer support');
  const rdvPrompt = promptNamed('Appointment scheduling');
  await me('POST', `/emails/${todo[1]!.id}/assist`, { action: 'prompt', promptId: support.id });
  assert.match(lastDraftSystemPrompt(), /- Toujours donner le prix hors taxes/);
  await me('POST', `/emails/${todo[1]!.id}/assist`, { action: 'prompt', promptId: rdvPrompt.id });
  assert.doesNotMatch(lastDraftSystemPrompt(), /prix hors taxes/);
});

test('the administrator sees who corrected what', async () => {
  const corrections = (await me('GET', `/prompts/${promptNamed('Customer support').id}/corrections`)).body;
  assert.deepEqual(corrections.map((c: { reason: string; user: string }) => [c.reason, c.user]), [['Toujours donner le prix hors taxes', 'bob@corp.example']]);
});

test('sending the proposal untouched is recorded as not edited, and the original is flagged answered', async () => {
  const detail = (await me('GET', `/emails/${todo[1]!.id}`)).body;
  const sent = await me('POST', `/emails/${todo[1]!.id}/send`, {
    draftId: detail.draft.id,
    html: detail.draft.html,
    to: detail.recipients.to,
    changeReason: 'ignored because nothing changed',
  });
  assert.deepEqual(sent.body, { ok: true, wasEdited: false });
  assert.equal((await me('GET', `/emails/${todo[1]!.id}`)).body.reply.changeReason, '');
  assert.deepEqual(stack.outbox[1]!.to, ['sophie@client.example']);
  assert.deepEqual(stack.inboxFlags().map((flags) => flags.includes('\\Answered')), [true, false, false, true]);
});

/** Moves an email that was set aside back to handle and has a proposal written for it; returns the email in full. */
async function anotherEmailWithItsProposal(): Promise<EmailDetail> {
  const [aside] = (await me('GET', '/emails?box=none')).body.emails;
  assert.equal((await me('POST', `/emails/${aside.id}/status`, { status: 'needs_reply' })).status, 200);
  assert.equal((await me('POST', `/emails/${aside.id}/assist`, { action: 'prompt', promptId: prompts[0]!.id })).status, 201);
  return (await me('GET', `/emails/${aside.id}`)).body;
}

let filed: EmailDetail;

test('saving as a draft files the reply in the mailbox without sending it', async () => {
  filed = await anotherEmailWithItsProposal();
  const sentBefore = stack.outbox.length;
  const saved = await me('POST', `/emails/${filed.id}/save-draft`, {
    draftId: filed.draft.id,
    html: `${filed.draft.html}<p>PS : à finir dans ma messagerie.</p>`,
    to: filed.recipients.to,
    changeReason: 'Ajout d’un post-scriptum',
  });
  assert.deepEqual(saved.body, { ok: true, wasEdited: true });
  assert.equal(stack.outbox.length, sentBefore, 'nothing is sent');
});

test('the draft filed answers the email, to be finished in the mail client', () => {
  const [draft] = stack.draftsFolder();
  assert.ok(draft!.flags.includes('\\Draft'));
  assert.match(draft!.raw, new RegExp(`^To: ${filed.recipients.to[0]!.replace('.', '\\.')}`, 'm'));
  assert.match(draft!.raw, new RegExp(`^In-Reply-To: ${filed.messageId}`, 'm'));
  assert.match(draft!.raw, /PS : =C3=A0 finir dans ma/);
  assert.doesNotMatch(draft!.raw, /[^\r]\n/, 'CRLF line endings throughout');
});

test('an email whose reply was filed as a draft is replied: it is listed so and cannot be sent', async () => {
  const after = (await me('GET', `/emails/${filed.id}`)).body;
  assert.equal(after.reply.mode, 'draft');
  const listed = (await me('GET', '/emails?box=sent')).body.emails;
  assert.deepEqual(listed.map((e: { replyMode: string | null }) => e.replyMode).sort(), ['draft', 'sent', 'sent']);
  assert.equal((await me('POST', `/emails/${filed.id}/send`, { html: '<p>bis</p>', to: filed.recipients.to })).status, 409);
});
