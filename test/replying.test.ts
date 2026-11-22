// The decisions of replying, as pure functions: data in, verdict out. No database, no mailbox.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentIsKept, handOverRecord, hasSomethingWritten, mayHandOver, promptToPrepareWith, proposalHtml } from '../src/domain/computations/replying.ts';
import type { Verdict } from '../src/domain/refusal.ts';
import type { PromptRow } from '../src/types.ts';

/** What a verdict comes down to: 'ok', or the kind and code of its refusal. */
const outcome = (verdict: Verdict<unknown>): string => (verdict.ok ? 'ok' : `${verdict.refusal.kind}: ${verdict.refusal.problem.code}`);

const reply = { status: 'needs_reply' as const, inFlight: false, html: '<p>Hello</p>', to: ['claire@client.example'], cc: [] as string[] };

test('a reply may be handed over when it has a text, a recipient, valid addresses, and the email is not replied', () => {
  const cases: [string, Partial<typeof reply> & { status?: string }, string][] = [
    ['all clauses hold', {}, 'ok'],
    ['to handle, waiting to be sorted, set aside or ignored: all can be replied', { status: 'pending' }, 'ok'],
    ['set aside', { status: 'no_reply' }, 'ok'],
    ['ignored', { status: 'ignored' }, 'ok'],
    ['ReqPre: not empty', { html: '<p> </p>' }, 'invalid: reply.empty'],
    ['ReqPre: a recipient', { to: [] }, 'invalid: reply.noRecipient'],
    ['ReqPre: every address valid (to)', { to: ['claire'] }, 'invalid: reply.invalidAddress'],
    ['ReqPre: every address valid (cc)', { cc: ['paul@'] }, 'invalid: reply.invalidAddress'],
    ['DomPre: not replied', { status: 'sent' }, 'conflict: emails.alreadyHandled'],
    ['DomPre: none on its way', { inFlight: true }, 'conflict: emails.alreadyHandled'],
    ['the request is judged before the state: an empty reply to a replied email is empty', { status: 'sent', html: '' }, 'invalid: reply.empty'],
  ];
  for (const [name, change, expected] of cases) assert.equal(outcome(mayHandOver({ ...reply, ...change } as typeof reply)), expected, name);
});

test('what a hand-over records: edited or not, and the reason only if it was', () => {
  const proposal = { action: 'prompt' as const, ai_text: '<p>Hello Claire,</p><p>Yes.</p>', prompt_id: 7 };
  const untouched = handOverRecord('<p>Hello Claire,</p><p>Yes.</p>', proposal, 'a reason given anyway');
  assert.deepEqual([untouched.edited, untouched.reason, untouched.promptId], [false, '', 7], 'a reason for a change that did not happen is dropped');
  const respaced = handOverRecord('<p>Hello   Claire,</p>\n<p>Yes.</p>', proposal, '');
  assert.equal(respaced.edited, false, 'spacing alone is not an edit');
  const edited = handOverRecord('<p>Hi Claire,</p><p>Yes.</p>', proposal, 'too formal');
  assert.deepEqual([edited.edited, edited.reason], [true, 'too formal']);
  assert.match(edited.proposedText ?? '', /Hello Claire/);
  const own = handOverRecord('<p>Written by hand</p>', undefined, 'ignored');
  assert.deepEqual([own.edited, own.reason, own.promptId, own.proposedText], [false, '', null, null], 'without a proposal nothing was edited');
});

test('typos and style need something written; a prompt needs the content of the email', () => {
  assert.equal(outcome(hasSomethingWritten('<p>reponse</p>')), 'ok');
  assert.equal(outcome(hasSomethingWritten('')), 'invalid: assist.nothingWritten');
  assert.equal(outcome(hasSomethingWritten('<p><br></p>')), 'invalid: assist.nothingWritten');
  assert.equal(outcome(contentIsKept('Hello')), 'ok');
  assert.equal(outcome(contentIsKept('')), 'gone: emails.contentErased');
});

test('a proposal nobody asked for is written with the suggested prompt, else the first', () => {
  const prompts = [{ id: 1 }, { id: 2 }, { id: 3 }] as PromptRow[];
  assert.equal(promptToPrepareWith(2, prompts)?.id, 2);
  assert.equal(promptToPrepareWith(null, prompts)?.id, 1);
  assert.equal(promptToPrepareWith(99, prompts)?.id, 1, 'a suggestion that no longer exists falls back');
  assert.equal(promptToPrepareWith(2, []), undefined);
});

test('a proposal made before proposals were rich text is shown as text', () => {
  assert.equal(proposalHtml({ action: 'prompt', ai_text: '<p>Hi</p>' }), '<p>Hi</p>');
  assert.match(proposalHtml({ action: null, ai_text: 'Hi\n\nthere' }), /<p>Hi<\/p>/);
});
