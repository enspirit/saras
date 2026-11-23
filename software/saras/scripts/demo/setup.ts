// What the demo organisation is given before anyone looks at it: an account, the demo mailbox
// with its emails fetched, a few attributes with their rules, and two boards. Everything goes
// through the API, as a person would do it in the interface.

/** Who signs in to the demo. */
export const DEMO_ACCOUNT = { email: 'demo@saras.example', password: 'saras-demo-password', organization: 'Brightwater Consulting' };

type Call = (method: string, path: string, body?: unknown) => Promise<{ id?: number; key?: string }>;

/** Calls the API of the demo server as one signed-in person, keeping the cookie the sign-up gives. */
function caller(url: string): Call {
  let cookie = '';
  return async (method, path, body) => {
    const answer = await fetch(`${url}/api${path}`, { method, headers: { 'content-type': 'application/json', cookie }, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) });
    cookie = answer.headers.getSetCookie()[0]?.split(';')[0] ?? cookie;
    const told = await answer.json().catch(() => ({}));
    if (!answer.ok) throw new Error(`${method} ${path}: ${answer.status} ${JSON.stringify(told)}`);
    return told as { id?: number; key?: string };
  };
}

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
  if contains(words, 'today') || contains(words, 'priorité') || contains(words, 'before friday') then {value: 'high', reason: 'it gives a deadline'}
  else null`;

const TOPIC = {
  name: 'Topic', kind: 'choice', decidedBy: 'elo', elo: TOPIC_RULE,
  values: [{ label: 'Billing', color: 'orange' }, { label: 'Sales', color: 'blue' }, { label: 'Support', color: 'green' }, { label: 'Planning', color: 'purple' }],
};

/** The attributes: a topic decided by a rule, who takes care of it set by hand, and a rule for the priority. With a key, the AI sorts what the rules leave. */
async function attributes(call: Call, withAi: boolean): Promise<string> {
  const topic = await call('POST', '/attributes', TOPIC);
  await call('POST', '/attributes', { name: 'Who', kind: 'member', decidedBy: 'nobody' });
  await call('PUT', '/attributes/priority', { decidedBy: withAi ? 'eloAi' : 'elo', elo: PRIORITY_RULE });
  if (withAi) await call('PUT', '/organization', { sorting: 'ai' });
  return topic.key ?? '';
}

/** The demo mailbox, watching its inbox as far back as the sample emails go, and fetched. */
async function mailbox(call: Call, credentials: object): Promise<void> {
  const connected = await call('POST', '/mailboxes/imap', { ...credentials, shared: true });
  await call('PUT', `/mailboxes/${connected.id}/folder`, { folder: 'INBOX', days: 14, unreadOnly: false });
  await call('POST', `/mailboxes/${connected.id}/fetch`);
}

/** Two boards: what is urgent, and what is about money. */
async function boards(call: Call, topic: string): Promise<void> {
  await call('POST', '/boards', { name: 'High priority', shared: true, filter: { attributes: { status: ['todo'], priority: ['high'] } } });
  await call('POST', '/boards', { name: 'Billing', shared: true, filter: { attributes: { [topic]: ['1'] } } });
}

/** Sets the demo organisation up on a server that has just started. `withAi` says whether an OpenRouter key is there. */
export async function setUpDemo(url: string, credentials: object, withAi: boolean): Promise<void> {
  const call = caller(url);
  await call('POST', '/auth/signup', DEMO_ACCOUNT);
  await call('PUT', '/settings', { name: 'Alex Morgan', signature: 'Kind regards,\nAlex Morgan\nBrightwater Consulting' });
  const topic = await attributes(call, withAi);
  await mailbox(call, credentials);
  await boards(call, topic);
}
