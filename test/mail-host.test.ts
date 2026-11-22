// The host of a mailbox: which one an address is at, and where a member is sent to sign in there.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyMx, domainOf } from '../src/tooling/mail/lookup.ts';
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
