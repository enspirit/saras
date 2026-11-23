// The host of a mailbox: which one an address is at, and where a member is sent to sign in there.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyMx } from '../src/tooling/mail/known-hosts.ts';
import { domainOf, lookupMailHost, usualServers } from '../src/tooling/mail/lookup.ts';
import type { Endpoint, Network } from '../src/tooling/mail/network.ts';
import { authorizationUrl } from '../src/tooling/mail/oauth.ts';

test('OAuth authorization URLs', () => {
  const config = {
    baseUrl: 'https://mail.example',
    google: { clientId: 'gid', clientSecret: 's' },
    microsoft: { clientId: 'mid', clientSecret: 's', tenant: 'common' },
  };
  const g = new URL(authorizationUrl(config, 'google', 'st'));
  assert.equal(g.searchParams.get('redirect_uri'), 'https://mail.example/api/oauth/google/callback');
  assert.equal(g.searchParams.get('access_type'), 'offline');
  assert.match(g.searchParams.get('scope') ?? '', /gmail\.readonly.*gmail\.compose/);
  const m = new URL(authorizationUrl(config, 'microsoft', 'st'));
  assert.equal(m.pathname, '/common/oauth2/v2.0/authorize');
  assert.match(m.searchParams.get('scope') ?? '', /offline_access.*Mail\.Send/);
  assert.equal(m.searchParams.get('state'), 'st');
});

test('the host of a mailbox is read from its MX records', () => {
  assert.equal(classifyMx(['aspmx.l.google.com', 'alt1.aspmx.l.google.com']).provider, 'google');
  assert.equal(classifyMx(['acme-example.mail.protection.outlook.com.']).provider, 'microsoft');
  assert.deepEqual(classifyMx(['mx1.mail.ovh.net']), { provider: 'other', servers: { imapHost: 'ssl0.ovh.net', imapPort: 993, smtpHost: 'ssl0.ovh.net', smtpPort: 465 } });
  assert.deepEqual(classifyMx(['mail.acme.example']), { provider: 'other', servers: null }, 'an unknown host proposes nothing');
  assert.deepEqual(classifyMx(['notgoogle.com']), { provider: 'other', servers: null }, 'a name is recognised by its end, on a dot');
  assert.equal(domainOf(' Alex@Acme.Example '), 'acme.example');
  assert.equal(domainOf('alex@localhost'), null);
  assert.equal(domainOf('not an address'), null);
});

/** A network where these MX and SRV records exist, and only these servers answer. */
const network = (records: { mx?: string[]; srv?: Record<string, Endpoint[]> }, answering: string[]): Network => ({
  mx: async () => records.mx ?? [],
  srv: async (name) => records.srv?.[name] ?? [],
  answers: async (kind, { host, port }) => answering.includes(`${kind}:${host}:${port}`),
});

test('a host we know by its MX records is proposed without asking further', async () => {
  const ovh = await lookupMailHost('bernard@seeonee.example', network({ mx: ['mx1.mail.ovh.net'] }, []));
  assert.deepEqual(ovh.servers, { imapHost: 'ssl0.ovh.net', imapPort: 993, smtpHost: 'ssl0.ovh.net', smtpPort: 465 });
});

test('servers are never guessed from the address: nothing is proposed unless it was seen to answer', async () => {
  const nothing = await lookupMailHost('alex@acme.example', network({ mx: ['mx.elsewhere.example'] }, []));
  assert.deepEqual(nothing, { provider: 'other', servers: null }, 'imap.acme.example does not answer: it is not proposed');
  const half = await lookupMailHost('alex@acme.example', network({}, ['imap:imap.acme.example:993']));
  assert.equal(half.servers, null, 'both servers or none');
  assert.deepEqual(await lookupMailHost('not an address', network({}, [])), { provider: 'other', servers: null });
});

test('the usual names of a domain are proposed when they answer as mail servers', async () => {
  assert.deepEqual(usualServers('acme.example', ['MX1.acme.example.', 'mx.elsewhere.example']).imap.map((e) => e.host), ['imap.acme.example', 'mail.acme.example', 'mx1.acme.example']);
  const found = await lookupMailHost('alex@acme.example', network({}, ['imap:mail.acme.example:993', 'smtp:mail.acme.example:587']));
  assert.deepEqual(found.servers, { imapHost: 'mail.acme.example', imapPort: 993, smtpHost: 'mail.acme.example', smtpPort: 587 });
  const direct = await lookupMailHost('alex@acme.example', network({}, ['imap:imap.acme.example:993', 'smtp:smtp.acme.example:465', 'smtp:smtp.acme.example:587']));
  assert.equal(direct.servers?.smtpPort, 465, 'direct TLS is preferred');
});

test('what a domain declares for itself comes first, if it answers', async () => {
  const srv = { '_imaps._tcp.acme.example': [{ host: 'in.host.example', port: 993 }], '_submissions._tcp.acme.example': [{ host: 'out.host.example', port: 465 }] };
  const declared = await lookupMailHost('alex@acme.example', network({ srv }, ['imap:in.host.example:993', 'smtp:out.host.example:465', 'imap:imap.acme.example:993']));
  assert.deepEqual(declared.servers, { imapHost: 'in.host.example', imapPort: 993, smtpHost: 'out.host.example', smtpPort: 465 });
});
