// A closed installation: only the first account signs up, everyone else is invited.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startStack } from './support/stack.js';

let stack;
before(async () => (stack = await startStack({ env: { ALLOW_SIGNUP: 'false', BASE_URL: 'https://saras.example' } })));
after(() => stack.stop());

function client() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(`${stack.url}/api${path}`, {
      method,
      headers: { ...(method === 'GET' ? {} : { 'content-type': 'application/json' }), cookie },
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

const admin = client();
const tokenOf = (link) => link.split('#/invitation/')[1];
let invitation;

test('an empty installation accepts its first account, then closes', async () => {
  assert.deepEqual((await admin('GET', '/public')).body, { allowSignup: true, firstAccount: true });
  assert.equal((await admin('POST', '/auth/signup', { email: 'admin@corp.example', password: 'un-bon-mot-de-passe' })).status, 201);
  assert.equal((await admin('GET', '/me')).body.role, 'admin');
  assert.deepEqual((await admin('GET', '/public')).body, { allowSignup: false, firstAccount: false });
  const stranger = await client()('POST', '/auth/signup', { email: 'x@corp.example', password: 'un-bon-mot-de-passe' });
  assert.equal(stranger.status, 403);
  assert.match(stranger.body.error, /invitation/);
});

test('an administrator creates a one-time link; only its hash is stored', async () => {
  assert.equal((await admin('POST', '/invitations', { email: 'pas-une-adresse' })).status, 400);
  assert.equal((await admin('POST', '/invitations', { email: 'admin@corp.example' })).status, 409);
  const created = await admin('POST', '/invitations', { email: 'Lea@Corp.example' });
  assert.equal(created.status, 201);
  invitation = created.body;
  assert.equal(invitation.email, 'lea@corp.example');
  assert.match(invitation.link, /^https:\/\/saras\.example\/#\/invitation\/[\w-]{40,}$/);
  const stored = stack.db.prepare('SELECT * FROM invitations').get();
  assert.ok(!JSON.stringify(stored).includes(tokenOf(invitation.link)));
  const listed = (await admin('GET', '/invitations')).body;
  assert.deepEqual(listed.map((i) => [i.email, i.role, i.expired]), [['lea@corp.example', 'user', false]]);
  assert.ok(!JSON.stringify(listed).includes('token'));
});

test('inviting the same address again invalidates the earlier link', async () => {
  const old = tokenOf(invitation.link);
  invitation = (await admin('POST', '/invitations', { email: 'lea@corp.example' })).body;
  assert.equal((await client()('POST', '/invitations/check', { token: old })).status, 404);
  assert.equal((await client()('POST', '/invitations/accept', { token: old, password: 'un-bon-mot-de-passe' })).status, 404);
  assert.equal((await admin('GET', '/invitations')).body.length, 1);
});

test('the invited person sets a password and is in; the link then stops working', async () => {
  const lea = client();
  const token = tokenOf(invitation.link);
  assert.deepEqual((await lea('POST', '/invitations/check', { token })).body, { email: 'lea@corp.example' });
  assert.equal((await lea('POST', '/invitations/accept', { token, password: 'court' })).status, 400);
  assert.equal((await lea('POST', '/invitations/accept', { token, password: 'le-mot-de-passe-de-lea' })).status, 201);
  const profile = (await lea('GET', '/me')).body;
  assert.deepEqual([profile.email, profile.role], ['lea@corp.example', 'user']);
  assert.equal((await lea('GET', '/prompts')).body.length, 5, 'she gets the shared prompts');
  assert.equal((await client()('POST', '/invitations/accept', { token, password: 'encore-un-mot-de-passe' })).status, 404);
  assert.deepEqual((await admin('GET', '/invitations')).body, []);
  assert.equal((await client()('POST', '/auth/login', { email: 'lea@corp.example', password: 'le-mot-de-passe-de-lea' })).status, 200);
  assert.equal((await lea('POST', '/invitations', { email: 'ami@corp.example' })).status, 403);
  assert.equal((await lea('GET', '/invitations')).status, 403);
});

test('an invitation can grant the administrator role, be revoked, or expire', async () => {
  const boss = (await admin('POST', '/invitations', { email: 'boss@corp.example', role: 'admin' })).body;
  const b = client();
  await b('POST', '/invitations/accept', { token: tokenOf(boss.link), password: 'un-bon-mot-de-passe' });
  assert.equal((await b('GET', '/me')).body.role, 'admin');

  const revoked = (await admin('POST', '/invitations', { email: 'revoque@corp.example' })).body;
  assert.equal((await admin('DELETE', `/invitations/${revoked.id}`)).status, 200);
  assert.equal((await client()('POST', '/invitations/check', { token: tokenOf(revoked.link) })).status, 404);

  const late = (await admin('POST', '/invitations', { email: 'tard@corp.example' })).body;
  stack.db.prepare(`UPDATE invitations SET expires_at = datetime('now', '-1 minute') WHERE id = ?`).run(late.id);
  assert.equal((await client()('POST', '/invitations/accept', { token: tokenOf(late.link), password: 'un-bon-mot-de-passe' })).status, 404);
  assert.equal((await admin('GET', '/invitations')).body[0].expired, true);
});

test('an administrator deletes an account; shared prompts survive their author', async () => {
  const users = (await admin('GET', '/users')).body;
  const boss = users.find((u) => u.email === 'boss@corp.example');
  const lea = users.find((u) => u.email === 'lea@corp.example');
  stack.db.prepare('UPDATE prompts SET user_id = ? WHERE id = 1').run(boss.id);
  assert.equal((await admin('DELETE', `/users/${users[0].id}`)).status, 409, 'not oneself');
  assert.equal((await admin('DELETE', `/users/${boss.id}`)).status, 200);
  assert.equal((await admin('DELETE', `/users/${lea.id}`)).status, 200);
  assert.equal((await admin('GET', '/prompts')).body.length, 5);
  assert.deepEqual((await admin('GET', '/users')).body.map((u) => u.email), ['admin@corp.example']);
  assert.equal((await client()('POST', '/auth/login', { email: 'lea@corp.example', password: 'le-mot-de-passe-de-lea' })).status, 401);
});

test('repeated wrong guesses lock the address out, right ones never do', async () => {
  const guess = client();
  let last;
  for (let i = 0; i < 12; i++) last = await guess('POST', '/invitations/check', { token: `guess-${i}` });
  assert.equal(last.status, 429);
  assert.equal((await guess('POST', '/auth/login', { email: 'admin@corp.example', password: 'un-bon-mot-de-passe' })).status, 429);
});
