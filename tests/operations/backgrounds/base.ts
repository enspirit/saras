// node backgrounds/base.ts — arrives at the Background "test/base" on a saras server that
// holds nothing, through its front door, as people would in the interface. The state is then
// flushed as the seed software/storage/data/test/base: `emb run storage:test.rebuild`.
//
// Two organisations, so that what is one's can be asked for by the other:
//
//   Atelier Nord   ada (administrator), ines (administrator), milo (member)
//                  the mailbox of the stack, shared, its inbox fetched; one more attribute
//                  decided by a rule and one set by hand; one more prompt; three boards; an
//                  invitation pending; a link to a new password for milo; emails where the
//                  rules put them, and four that members moved: one ignored, one needing no
//                  reply, one replied, one replied as a draft
//   Bureau Sud     otto, its only member and administrator; one board
//
// Everybody has the same password, which specification/world.yml tells: nothing here opens anything real.
const api = process.env.SARAS_API;
if (!api) throw new Error('SARAS_API is not set');

const PASSWORD = 'a-password-for-the-tests';

type Told = Record<string, any>;
type Call = (method: string, path: string, body?: unknown) => Promise<Told>;

/** Calls the front door as one person, keeping the cookie a sign-up or a sign-in gives. */
function person(): Call {
  let cookie = '';
  return async (method, path, body) => {
    const answer = await fetch(`${api}/api${path}`, { method, headers: { 'content-type': 'application/json', cookie }, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) });
    cookie = answer.headers.getSetCookie()[0]?.split(';')[0] ?? cookie;
    const told = await answer.json().catch(() => ({}));
    if (!answer.ok) throw new Error(`${method} ${path}: ${answer.status} ${JSON.stringify(told)}`);
    return told as Told;
  };
}

/** Invited by an administrator, somebody joins and says their name. */
async function joins(admin: Call, email: string, role: 'admin' | 'user', name: string): Promise<Call> {
  const invitation = await admin('POST', '/invitations', { email, role });
  const theirs = person();
  await theirs('POST', '/invitations/accept', { token: String(invitation.link).split('#/invitation/')[1], password: PASSWORD });
  await theirs('PUT', '/settings', { name });
  return theirs;
}

const TOPIC_RULE = `let
  words = lower(_.subject + ' ' + _.text)
in
  if contains(words, 'invoice') || contains(words, 'facture') then {value: 'Billing', reason: 'it speaks of an invoice'}
  else if contains(words, 'quote') || contains(words, 'devis') || contains(words, 'pricing') then {value: 'Sales', reason: 'it asks for a quote or a price'}
  else null`;

async function attributes(ada: Call): Promise<string> {
  const topic = await ada('POST', '/attributes', { name: 'Topic', kind: 'choice', decidedBy: 'elo', elo: TOPIC_RULE, values: [{ label: 'Billing', color: 'orange' }, { label: 'Sales', color: 'blue' }] });
  await ada('POST', '/attributes', { name: 'Who', kind: 'member', decidedBy: 'nobody' });
  return String(topic.key);
}

/** The mailbox of the stack (world/mailbox), as the server reaches it: shared, its inbox watched and fetched. */
async function mailbox(ada: Call): Promise<void> {
  const servers = { username: 'testuser', password: 'testpass', imapHost: '127.0.0.1', imapPort: 1143, imapSecure: false, smtpHost: '127.0.0.1', smtpPort: 1025, smtpSecure: false };
  const connected = await ada('POST', '/mailboxes/imap', { email: 'me@corp.example', displayName: 'Atelier Nord', shared: true, ...servers });
  await ada('PUT', `/mailboxes/${connected.id}/folder`, { folder: 'INBOX', days: 14, unreadOnly: false });
  await ada('POST', `/mailboxes/${connected.id}/fetch`);
}

async function boards(ada: Call, milo: Call, topic: string): Promise<void> {
  await ada('POST', '/boards', { name: 'Billing', shared: true, filter: { attributes: { [topic]: ['1'] } } });
  await ada('POST', '/boards', { name: 'From customers', shared: false, filter: { from: 'example' } });
  await milo('POST', '/boards', { name: 'To follow', shared: false, filter: { attributes: { status: ['todo'] } } });
}

/** Four emails are moved by members, so that every box holds something: the others stay where the rules put them. */
async function moved(ada: Call, milo: Call): Promise<void> {
  const { emails } = await ada('GET', '/emails?box=todo');
  const [first, second, third, fourth] = emails as { id: number; fromAddr: string }[];
  if (!fourth) throw new Error(`the mailbox gave ${emails.length} emails to handle, where four at least are moved`);
  await milo('POST', `/emails/${first!.id}/status`, { status: 'ignored' });
  await ada('POST', `/emails/${second!.id}/status`, { status: 'no_reply' });
  await ada('POST', `/emails/${third!.id}/send`, { html: '<p>Thank you, we will come back to you this week.</p>', to: [third!.fromAddr], cc: [] });
  await milo('POST', `/emails/${fourth!.id}/file-as-draft`, { html: '<p>A reply still to finish.</p>', to: [fourth!.fromAddr], cc: [] });
}

async function atelierNord(): Promise<void> {
  const ada = person();
  await ada('POST', '/auth/signup', { email: 'ada@atelier.example', password: PASSWORD, organization: 'Atelier Nord' });
  await ada('PUT', '/settings', { name: 'Ada Admin', signature: 'Kind regards,\nAda' });
  await joins(ada, 'ines@atelier.example', 'admin', 'Ines Admin');
  const milo = await joins(ada, 'milo@atelier.example', 'user', 'Milo Member');
  const topic = await attributes(ada);
  await ada('POST', '/prompts', { name: 'Quote', description: 'When somebody asks for a price', systemPrompt: 'Answer with our price list and offer a call.', affinity: { [topic]: ['2'] } });
  await mailbox(ada);
  await boards(ada, milo, topic);
  await moved(ada, milo);
  // Pending, each with a token only the server knows: the seed's hook gives them the ones the suite knows.
  await ada('POST', '/invitations', { email: 'nora@atelier.example', role: 'user' });
  const { members } = { members: (await ada('GET', '/members')) as unknown as { id: number; email: string }[] };
  await ada('POST', `/members/${members.find((member) => member.email === 'milo@atelier.example')!.id}/password-reset`);
}

async function bureauSud(): Promise<void> {
  const otto = person();
  await otto('POST', '/auth/signup', { email: 'otto@bureau.example', password: PASSWORD, organization: 'Bureau Sud' });
  await otto('PUT', '/settings', { name: 'Otto Outsider' });
  await otto('POST', '/boards', { name: 'Everything', shared: true, filter: {} });
}

await atelierNord();
await bureauSud();
console.log(`The Background test/base is arrived at on ${api}.`);
