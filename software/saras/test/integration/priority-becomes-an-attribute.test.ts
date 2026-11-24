// Migration 0006: the priority, which was pre-configured, becomes one of the organisation's own
// attributes, and what named it (emails, boards, prompts) names it by its number.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { BoardFilter } from '../../shared/board.ts';
import { decidedFrom } from '../../src/domain/computations/attributes.ts';
import { conditionsOf } from '../../src/domain/computations/boards.ts';
import { attributesOf } from '../../src/domain/state/attributes.ts';
import type { OrganizationRow } from '../../src/domain/model/organization.ts';
import { connectDb } from '../../src/tooling/db.ts';
import type { Db } from '../../src/tooling/db.ts';
import { migrate } from '../../src/tooling/db/migrate.ts';
import { MIGRATIONS } from '../../src/tooling/db/migrations.ts';
import { priorityIsAnAttributeLikeAnyOther } from '../../src/tooling/db/migrations/0006-priority-is-an-attribute-like-any-other.ts';
import { testDatabase } from '../support/database.ts';

const RULE = `if contains(lower(_.subject), 'urgent') then 'high' else null`;

/** Three organisations at the version before: one with a rule and a colour for its priority, one that never touched it and reads French, one that reads French and wrote a rule. */
async function organisations(db: Db): Promise<void> {
  await db.run(`INSERT INTO organizations (name) VALUES ('Acme'), ('Bureau'), ('Cabinet')`);
  await db.run(`INSERT INTO users (org_id, email, password_hash, role, language) VALUES (1, 'alice@acme.example', 'x', 'admin', 'en'), (2, 'member@bureau.example', 'x', 'user', 'en'), (2, 'bruno@bureau.example', 'x', 'admin', 'fr'), (3, 'chloe@cabinet.example', 'x', 'admin', 'fr-BE')`);
  await db.run(`INSERT INTO accounts (org_id, user_id, kind, email, config_enc) VALUES (1, 1, 'imap', 'alice@acme.example', 'x'), (2, 3, 'imap', 'bruno@bureau.example', 'x')`);
  await db.run(`INSERT INTO attributes (org_id, key, name, values_json, decided_by, elo) VALUES
    (1, 'status', 'status', '[]', 'elo', 'null'), (1, NULL, 'Topic', '[{"key":"1","label":"Sales"}]', 'nobody', ''),
    (1, 'priority', 'priority', '[{"key":"high","color":"orange"},{"key":"normal","color":"grey"},{"key":"low","color":"blue"}]', 'elo', $1),
    (3, 'priority', 'priority', '[]', 'nobody', $1)`, [RULE]);
}

/** What named the priority at the version before: emails, by who decided it; boards, both ways round; a prompt. */
async function whatNamedThePriority(db: Db): Promise<void> {
  await db.run(`INSERT INTO emails (account_id, provider_id, date, status, priority, attributes_json) VALUES
    (1, 'by-rule', now(), 'needs_reply', 'high', '{"priority":{"value":"high","source":"rule","reason":"a deadline"},"2":{"value":"1","source":"user"}}'),
    (1, 'by-hand', now(), 'needs_reply', 'low', '{"priority":{"value":"low","source":"user"}}'),
    (1, 'by-the-ai', now(), 'needs_reply', 'high', '{}'),
    (1, 'as-it-started', now(), 'needs_reply', 'normal', '{}'),
    (1, 'normal-by-rule', now(), 'needs_reply', 'normal', '{"priority":{"value":"normal","source":"rule"}}'),
    (2, 'elsewhere', now(), 'needs_reply', 'low', '{}')`);
  await db.run(`INSERT INTO boards (org_id, user_id, name, filter_json) VALUES
    (1, 1, 'Urgent or not', '{"attributes":{"status":["todo"],"priority":["high","low"]},"except":{"attributes":{"priority":["normal"]},"from":"noreply"},"received":7}'),
    (1, 1, 'To handle', '{"attributes":{"status":["todo"]}}'),
    (2, 3, 'Urgent', '{"attributes":{"priority":["high"]}}')`);
  await db.run(`INSERT INTO prompts (org_id, user_id, name, system_prompt, affinity_json) VALUES (1, 1, 'Urgent sales', 'x', '{"priority":["high"],"2":["1"]}'), (1, 1, 'Standard', 'x', '{}')`);
}

const json = async <T>(db: Db, sql: string): Promise<T[]> => (await db.query<{ json: string }>(sql)).map((row) => JSON.parse(row.json) as T);

interface Kept {
  id: number;
  org_id: number;
  key: string | null;
  name: string;
  values_json: string;
  decided_by: string;
  elo: string;
}

let db: Db;
let drop: () => Promise<void>;
/** The priority of each organisation once migrated, and the numbers of the first two. */
let own: Kept[];
let acme: string;
let bureau: string;

before(async () => {
  ({ db, drop } = await testDatabase(connectDb));
  const earlier = MIGRATIONS.slice(0, 5);
  await migrate(db, earlier);
  await organisations(db);
  await whatNamedThePriority(db);
  assert.deepEqual(await migrate(db, [...earlier, priorityIsAnAttributeLikeAnyOther]), [priorityIsAnAttributeLikeAnyOther.id]);
  own = await db.query<Kept>(`SELECT * FROM attributes WHERE name <> 'status' AND name <> 'Topic' ORDER BY org_id`);
  [acme, bureau] = own.map((a) => String(a.id)) as [string, string];
});
after(() => drop());

test('each organisation has the priority as an attribute of its own, with the rule and the colours it had', async () => {
  assert.deepEqual(own.map((a) => [a.org_id, a.key, a.name, a.decided_by, a.elo]), [[1, null, 'Priority', 'elo', RULE], [2, null, 'Priorité', 'nobody', ''], [3, null, 'Priority', 'nobody', RULE]], 'in French where its administrator reads French and no rule names its values');
  assert.deepEqual(JSON.parse(own[0]!.values_json), [{ key: '1', label: 'High', color: 'orange' }, { key: '2', label: 'Normal', color: 'grey' }, { key: '3', label: 'Low', color: 'blue' }], 'in the colours it had');
  assert.deepEqual(JSON.parse(own[1]!.values_json), [{ key: '1', label: 'Haute', color: 'red' }, { key: '2', label: 'Normale', color: 'grey' }, { key: '3', label: 'Basse', color: 'blue' }]);
  assert.deepEqual(decidedFrom('high', JSON.parse(own[0]!.values_json)), { value: '1', reason: '' }, 'the rule it had still names its values');
  const told = await attributesOf(db, { id: 1, skip_automated: true } as OrganizationRow);
  assert.deepEqual(told.map((a) => [a.key, a.name, a.system]), [['status', 'Stands in', true], ['2', 'Topic', false], [acme, 'Priority', false]]);
});

test('an email keeps the priority it had, under the number of the attribute, with who decided it', async () => {
  assert.deepEqual(await json(db, 'SELECT attributes_json AS json FROM emails ORDER BY id'), [
    { [acme]: { value: '1', source: 'rule', reason: 'a deadline' }, 2: { value: '1', source: 'user' } },
    { [acme]: { value: '3', source: 'user' } },
    { [acme]: { value: '1', source: 'nobody' } },
    {},
    { [acme]: { value: '2', source: 'rule' } },
    { [bureau]: { value: '3', source: 'nobody' } },
  ], '"normal" that nobody decided was where an email started: it is no value');
  assert.equal((await db.query('SELECT priority FROM emails')).length, 6, 'the column remains, for the version before');
});

test('boards and prompts that named the priority name the attribute, and a board shows what it showed', async () => {
  const filters = await json<BoardFilter>(db, 'SELECT filter_json AS json FROM boards ORDER BY id');
  assert.deepEqual(filters, [
    { attributes: { status: ['todo'], [acme]: ['1', '3'] }, except: { attributes: { [acme]: ['2'] }, from: 'noreply' }, received: 7 },
    { attributes: { status: ['todo'] } },
    { attributes: { [bureau]: ['1'] } },
  ]);
  const { sql, params } = conditionsOf(filters[0]!, 1);
  const shown = await db.query<{ provider_id: string }>(`SELECT e.provider_id FROM emails e WHERE ${sql.join(' AND ')} ORDER BY e.id`, params);
  assert.deepEqual(shown.map((e) => e.provider_id), ['by-rule', 'by-hand', 'by-the-ai']);
  assert.deepEqual(await json(db, 'SELECT affinity_json AS json FROM prompts ORDER BY id'), [{ [acme]: ['1'], 2: ['1'] }, {}]);
});

test('a database with no organisation is given no attribute, and one already migrated is left as it is', async () => {
  const empty = await testDatabase(connectDb);
  try {
    assert.equal((await migrate(empty.db)).length, MIGRATIONS.length);
    assert.equal((await empty.db.one<{ n: number }>('SELECT count(*)::int AS n FROM attributes'))?.n, 0);
    assert.deepEqual(await migrate(empty.db), []);
  } finally {
    await empty.drop();
  }
});
