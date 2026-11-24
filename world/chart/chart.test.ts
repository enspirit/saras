// What the chart renders and what it refuses, as `helm template` says it: `emb run chart:test`.
// And the chart held to software/saras/env/base.env, where the server's variables are described.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseEnv } from 'node:util';

const here = new URL('.', import.meta.url);
const described = Object.keys(parseEnv(readFileSync(new URL('../../software/saras/env/base.env', here), 'utf8')));

const KEY = '0123456789abcdef0123456789abcdef';
const SERVER = 'postgres://saras:pw@db:5432/saras';
/** The least an installation says: its master key and its database. */
const LEAST = { 'secrets.APP_SECRET': KEY, 'secrets.DATABASE_URL': SERVER };
const EMBEDDED = { 'secrets.APP_SECRET': KEY, 'embeddedDatabase.enabled': 'true' };
const INCLUDED = { 'secrets.APP_SECRET': KEY, 'postgresql.enabled': 'true', 'postgresql.password': 'p@ss w/rd' };

/** `helm template` with these values: what it rendered, or what it refused with. */
function render(values: Record<string, string>): { ok: boolean; out: string } {
  const sets = Object.entries(values).flatMap(([name, value]) => ['--set', `${name}=${value}`]);
  const run = spawnSync('helm', ['template', 'saras', '.', ...sets], { cwd: here, encoding: 'utf8' });
  if (run.error) throw new Error(`helm is needed to test the chart: ${run.error.message}`);
  return { ok: run.status === 0, out: run.status === 0 ? run.stdout : run.stderr };
}

/** One rendered resource, by kind. */
const resource = (out: string, kind: string): string => out.split(/^---$/m).find((doc) => new RegExp(`^kind: ${kind}$`, 'm').test(doc)) ?? '';

// The lists of templates/_helpers.tpl, as this test expects them.
const SECRETS = ['APP_SECRET', 'DATABASE_URL', 'OPENROUTER_API_KEY', 'SMTP_URL', 'GOOGLE_CLIENT_SECRET', 'MICROSOFT_CLIENT_SECRET'];
const SET_BY_THE_CHART = ['PORT', 'BASE_URL', 'DATA_DIR', 'BRAND_DIR'];

test('every variable of env/base.env has one way in: secrets, a value of the chart, or config', () => {
  assert.deepEqual([...SECRETS, ...SET_BY_THE_CHART].filter((name) => !described.includes(name)), []);
  for (const name of described) {
    const { ok, out } = render({ ...LEAST, [`config.${name}`]: 'x' });
    if (SECRETS.includes(name)) assert.match(out, new RegExp(`${name} is a secret`), name);
    else if (SET_BY_THE_CHART.includes(name)) assert.match(out, new RegExp(`the chart sets ${name} itself`), name);
    else assert.match(resource(out, 'ConfigMap'), new RegExp(`^  ${name}: "x"$`, 'm'), name);
    assert.equal(ok, !SECRETS.includes(name) && !SET_BY_THE_CHART.includes(name), name);
  }
});

test('secrets takes every secret, keeps them in a Secret, and takes nothing else', () => {
  const { out } = render({ ...Object.fromEntries(SECRETS.map((name) => [`secrets.${name}`, KEY])), 'secrets.DATABASE_URL': SERVER });
  for (const name of SECRETS) assert.match(resource(out, 'Secret'), new RegExp(`^  ${name}: `, 'm'), name);
  assert.doesNotMatch(resource(out, 'Deployment'), new RegExp(`${KEY}|${SERVER}`));
  assert.match(render({ ...LEAST, 'secrets.ALLOW_SIGNUP': 'yes' }).out, /secrets.ALLOW_SIGNUP: not a secret saras reads/);
});

/** How helm says a value is not one of the schema's: its wording changed between versions. */
const notAllowed = (name: string): RegExp => new RegExp(`'${name}' not allowed|Additional property ${name} is not allowed`);

const REFUSED: [string, Record<string, string>, RegExp][] = [
  ['no master key', { 'secrets.DATABASE_URL': SERVER }, /APP_SECRET is missing or too short/],
  ['a master key too short for the server', { ...LEAST, 'secrets.APP_SECRET': 'short' }, /APP_SECRET is missing or too short/],
  ['no database', { 'secrets.APP_SECRET': KEY }, /No database/],
  ['a server of the operator and the embedded database', { ...LEAST, 'embeddedDatabase.enabled': 'true' }, /secrets.DATABASE_URL and embeddedDatabase.enabled: one database, not 2/],
  ['a server of the operator and one of the release', { ...LEAST, ...INCLUDED }, /secrets.DATABASE_URL and postgresql.enabled: one database, not 2/],
  ['a server of the release and the embedded database', { ...INCLUDED, 'embeddedDatabase.enabled': 'true' }, /postgresql.enabled and embeddedDatabase.enabled: one database, not 2/],
  ['a server of the release without a password', { 'secrets.APP_SECRET': KEY, 'postgresql.enabled': 'true' }, /a password is required, as postgresql.password .* or in a Secret of yours/],
  ['a server of the release with two passwords', { ...INCLUDED, 'postgresql.existingSecret': 'mine' }, /postgresql.password and postgresql.existingSecret: one password, not 2/],
  ['a second replica of the database', { ...INCLUDED, 'postgresql.replicas': '2' }, notAllowed('replicas')],
  ['an ingress without a host', { ...LEAST, 'ingress.enabled': 'true' }, /ingress.host is required/],
  ['a second replica', { ...LEAST, replicas: '2' }, notAllowed('replicas')],
  ['a value it does not know', { ...LEAST, 'secret.APP_SECRET': KEY }, notAllowed('secret')],
];

for (const [what, values, why] of REFUSED) {
  test(`it refuses ${what}`, () => {
    const { ok, out } = render(values);
    assert.equal(ok, false);
    assert.match(out, why);
  });
}

test('on a PostgreSQL server it keeps no state: no volume, one replica, replaced rather than doubled', () => {
  const { ok, out } = render(LEAST);
  assert.equal(ok, true, out);
  assert.equal(resource(out, 'PersistentVolumeClaim'), '');
  const deployment = resource(out, 'Deployment');
  assert.match(deployment, /^  replicas: 1$/m);
  assert.match(deployment, /type: Recreate/);
  assert.doesNotMatch(deployment, /persistentVolumeClaim:|name: (DATABASE_URL|BASE_URL|BRAND_DIR)$/m);
  assert.match(deployment, /readOnlyRootFilesystem: true/);
  assert.match(deployment, /image: "enspirit\/saras:latest"/);
});

test('on the embedded database it claims a volume that outlives the release, and no Secret names a server', () => {
  const { ok, out } = render({ ...EMBEDDED, existingSecret: 'mine' });
  assert.equal(ok, true, out);
  assert.match(resource(out, 'PersistentVolumeClaim'), /helm.sh\/resource-policy: keep/);
  const deployment = resource(out, 'Deployment');
  assert.match(deployment, /- name: DATABASE_URL\n\s+value: ""/);
  assert.match(deployment, /claimName: saras-data/);
  assert.equal(resource(render({ ...EMBEDDED, 'embeddedDatabase.existingClaim': 'kept' }).out, 'PersistentVolumeClaim'), '');
});

test('with a server of its own, the release has one PostgreSQL in a pod beside saras, and saras is given its address', () => {
  const { ok, out } = render({ ...INCLUDED, existingSecret: 'mine' });
  assert.equal(ok, true, out);
  const server = resource(out, 'StatefulSet');
  assert.match(server, /^  replicas: 1$/m);
  assert.match(server, /image: "postgres:16"/);
  assert.match(server, /volumeClaimTemplates:/);
  assert.match(server, /readOnlyRootFilesystem: true/);
  assert.doesNotMatch(server, /p@ss/);
  // The password once, in a Secret, as it is written; both pods read it there, and the address carries none.
  assert.equal(out.match(/p@ss/g)?.length, 1);
  assert.match(out, /^  POSTGRES_PASSWORD: "p@ss w\/rd"$/m);
  assert.match(server, /- name: POSTGRES_PASSWORD\n\s+valueFrom:\n\s+secretKeyRef:\n\s+name: saras-postgresql\n\s+key: POSTGRES_PASSWORD\n/);
  const deployment = resource(out, 'Deployment');
  assert.match(deployment, /- name: DATABASE_URL\n\s+value: postgres:\/\/saras@saras-postgresql:5432\/saras\n/);
  assert.match(deployment, /- name: PGPASSWORD\n\s+valueFrom:\n\s+secretKeyRef:\n\s+name: saras-postgresql\n\s+key: POSTGRES_PASSWORD\n/);
  assert.match(deployment, /initContainers:\n(.*\n)*?\s+- name: wait-for-postgresql/);
  assert.equal(resource(out, 'PersistentVolumeClaim'), '');
});

test('its password may be in a Secret of the operator: the chart then creates none, and both pods read that one', () => {
  const { ok, out } = render({ 'secrets.APP_SECRET': KEY, 'postgresql.enabled': 'true', 'postgresql.existingSecret': 'mine', 'postgresql.existingSecretKey': 'pw' });
  assert.equal(ok, true, out);
  assert.doesNotMatch(out, /POSTGRES_PASSWORD: /);
  const read = /valueFrom:\n\s+secretKeyRef:\n\s+name: mine\n\s+key: pw\n/;
  assert.match(resource(out, 'StatefulSet'), new RegExp(`- name: POSTGRES_PASSWORD\\n\\s+${read.source}`));
  assert.match(resource(out, 'Deployment'), new RegExp(`- name: PGPASSWORD\\n\\s+${read.source}`));
});

test('no secret has to be written in values: every one of them may come from a Secret of the operator', () => {
  const { ok, out } = render({ existingSecret: 'mine', 'postgresql.enabled': 'true', 'postgresql.existingSecret': 'mine-too' });
  assert.equal(ok, true, out);
  assert.equal(resource(out, 'Secret'), '');
});

test('without it, nothing of a PostgreSQL server is rendered', () => {
  assert.doesNotMatch(render(LEAST).out, /StatefulSet|postgresql|initContainers/);
});

test('a Secret of the operator stands for the chart’s: nothing is asked, and it wins', () => {
  const { ok, out } = render({ existingSecret: 'mine' });
  assert.equal(ok, true, out);
  assert.equal(resource(out, 'Secret'), '');
  assert.match(resource(out, 'Deployment'), /envFrom:\n\s+- secretRef:\n\s+name: mine\n/);
});

const ADDRESSES: [string, Record<string, string>, string][] = [
  ['an ingress with a certificate', { 'ingress.enabled': 'true', 'ingress.host': 'saras.example.org', 'ingress.tlsSecret': 'tls' }, 'https://saras.example.org'],
  ['an ingress without one', { 'ingress.enabled': 'true', 'ingress.host': 'saras.example.org' }, 'http://saras.example.org'],
  ['what baseUrl says, before the ingress', { 'ingress.enabled': 'true', 'ingress.host': 'in.example.org', baseUrl: 'https://saras.example.org' }, 'https://saras.example.org'],
];

for (const [what, values, address] of ADDRESSES) {
  test(`BASE_URL is ${what}`, () => {
    const { out } = render({ ...LEAST, ...values });
    assert.match(resource(out, 'Deployment'), new RegExp(`- name: BASE_URL\\n\\s+value: "${address}"`));
  });
}

test('a brand is a ConfigMap of the operator, mounted read-only and named by BRAND_DIR', () => {
  const deployment = resource(render({ ...LEAST, 'brand.configMap': 'saras-brand' }).out, 'Deployment');
  assert.match(deployment, /- name: BRAND_DIR\n\s+value: \/brand/);
  assert.match(deployment, /mountPath: \/brand\n\s+readOnly: true/);
  assert.match(deployment, /configMap:\n\s+name: saras-brand/);
});
