// Sorting by rules: plainly automated mail is set aside from its headers alone, before anyone
// or anything else looks at it. The rule is written in Elo, like any rule an organisation writes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STATUS } from '../../shared/attribute.ts';
import type { Attribute } from '../../shared/attribute.ts';
import { STATUS_VALUES } from '../../src/domain/computations/attributes.ts';
import { DEFAULT_STATUS_RULE } from '../../src/domain/computations/default-rules.ts';
import type { IncomingEmail } from '../../src/domain/model/email.ts';
import { ruled, sortByRules } from '../../src/domain/sorting/sort-by-rules.ts';
import { email } from '../support/email-from-claire.ts';

const standsIn: Attribute = { key: STATUS, name: 'Stands in', kind: 'choice', values: STATUS_VALUES, decidedBy: 'elo', elo: DEFAULT_STATUS_RULE, system: true };
const rules = ruled([standsIn]);
const own = 'me@corp.example';
const incoming = (over: Partial<IncomingEmail>): IncomingEmail => ({ providerId: '1', threadId: null, attachments: [], ...email, headers: {}, answered: false, ...over });
const standing = (over: Partial<IncomingEmail> = {}) => sortByRules(rules, incoming(over), own);

test('the rule "Stands in" starts with sets automated mail aside before any triage gate', () => {
  assert.equal(standing().status, 'pending', 'a person writing: the rule says nothing');
  assert.equal(standing({ fromAddr: 'no-reply@shop.example' }).status, 'no_reply');
  assert.equal(standing({ fromAddr: 'notifications@github.example' }).status, 'no_reply');
  assert.equal(standing({ headers: { listUnsubscribe: '<mailto:x>' } }).status, 'no_reply');
  assert.equal(standing({ headers: { autoSubmitted: 'auto-replied' } }).status, 'no_reply');
  assert.equal(standing({ headers: { autoSubmitted: 'no' } }).status, 'pending');
  assert.equal(standing({ fromAddr: 'ME@corp.example' }).status, 'no_reply');
  assert.equal(standing({ answered: true }).status, 'no_reply');
  // "reply" inside a normal name must not match
  assert.equal(standing({ fromAddr: 'replyman@corp.example' }).status, 'pending');
});

test('what the rule decides is recorded as the rule\'s, with its reason as a code the interface translates', () => {
  const newsletter = standing({ headers: { listId: 'news.example' } });
  assert.deepEqual([newsletter.status, newsletter.source, newsletter.reason], ['no_reply', 'rule', 'code:triage.newsletter']);
  assert.deepEqual([standing().source, standing().reason, standing().priority], [null, '', 'normal']);
});
