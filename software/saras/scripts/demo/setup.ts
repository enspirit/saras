// What the demo organisation is given before anyone looks at it: an account, a few attributes
// with their rules, and two boards. Everything goes through the API, as a person would do it
// in the interface. Its mailbox is not part of it: scripts/demo-mailbox.ts connects it.
import { DEMO_ACCOUNT, caller } from './api.ts';
import type { Call } from './api.ts';

const TOPIC_RULE = `let
  words = lower(_.subject + ' ' + _.text)
in
  if contains(words, 'invoice') || contains(words, 'facture') then {value: 'Billing', reason: 'it speaks of an invoice'}
  else if contains(words, 'quote') || contains(words, 'devis') || contains(words, 'pricing') then {value: 'Sales', reason: 'it asks for a quote or a price'}
  else if contains(words, 'error') || contains(words, 'panne') then {value: 'Support', reason: 'it reports a problem'}
  else if contains(words, 'rendez-vous') || contains(words, 'call') || contains(words, 'dates') then 'Planning'
  else null`;

const PRIORITY_RULE = `let
  words = lower(_.subject + ' ' + _.text)
in
  if contains(words, 'today') || contains(words, 'priorité') || contains(words, 'before friday') then {value: 'High', reason: 'it gives a deadline'}
  else null`;

const TOPIC = {
  name: 'Topic', kind: 'choice', decidedBy: 'elo', elo: TOPIC_RULE,
  values: [{ label: 'Billing', color: 'orange' }, { label: 'Sales', color: 'blue' }, { label: 'Support', color: 'green' }, { label: 'Planning', color: 'purple' }],
};

/** The attributes, by their keys: a topic decided by a rule, who takes care of it set by hand, and a rule for the priority the organisation started with. */
async function attributes(call: Call): Promise<{ topic: string; priority: string }> {
  const topic = await call('POST', '/attributes', TOPIC);
  await call('POST', '/attributes', { name: 'Who', kind: 'member', decidedBy: 'nobody' });
  const priority = (await call<{ key: string; name: string }[]>('GET', '/attributes')).find((attribute) => attribute.name === 'Priority')!;
  await call('PUT', `/attributes/${priority.key}`, { ...priority, decidedBy: 'elo', elo: PRIORITY_RULE });
  return { topic: topic.key ?? '', priority: priority.key };
}

/** Two boards: what is urgent (the first value of the priority), and what is about money (the first of the topic). */
async function boards(call: Call, { topic, priority }: { topic: string; priority: string }): Promise<void> {
  await call('POST', '/boards', { name: 'High priority', shared: true, filter: { attributes: { status: ['todo'], [priority]: ['1'] } } });
  await call('POST', '/boards', { name: 'Billing', shared: true, filter: { attributes: { [topic]: ['1'] } } });
}

/** Sets the demo organisation up on a server where nobody has its address yet. */
export async function setUpDemo(url: string): Promise<void> {
  const call = caller(url);
  await call('POST', '/auth/signup', DEMO_ACCOUNT);
  await call('PUT', '/settings', { name: 'Alex Morgan', signature: 'Kind regards,\nAlex Morgan\nBrightwater Consulting' });
  await boards(call, await attributes(call));
}
