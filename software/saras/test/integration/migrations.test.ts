// Migrations: a database is brought to what this version of the server expects, each
// migration once, whoever starts and however many at once.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';
import { connectDb } from '../../src/tooling/db.ts';
import type { Db } from '../../src/tooling/db.ts';
import { migrate, standing } from '../../src/tooling/db/migrate.ts';
import { MIGRATIONS } from '../../src/tooling/db/migrations.ts';
import type { Migration } from '../../src/tooling/db/migrations.ts';
import { testDatabase } from '../support/database.ts';

const ids = MIGRATIONS.map((migration) => migration.id);

/** A database nothing was applied to yet, dropped once the test is over. */
async function onANewDatabase(body: (db: Db) => Promise<void>): Promise<void> {
  const { db, drop } = await testDatabase(connectDb);
  try {
    await body(db);
  } finally {
    await drop();
  }
}

const exists = async (db: Db, table: string): Promise<boolean> =>
  Boolean((await db.one<{ found: string | null }>('SELECT to_regclass($1)::text AS found', [table]))?.found);

const columnsOf = async (db: Db, table: string): Promise<string[]> =>
  (await db.query<{ name: string }>('SELECT column_name AS name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1', [table])).map((c) => c.name);

// Neither can be applied twice: a second application fails, and would be seen.
const first: Migration = { id: '0001-first', sql: 'CREATE TABLE first_things (id INTEGER); INSERT INTO first_things VALUES (1)' };
const second: Migration = { id: '0002-second', sql: 'CREATE TABLE second_things (id INTEGER)' };
const broken: Migration = { id: '0003-broken', sql: 'CREATE TABLE third_things (id INTEGER); INSERT INTO nothing_like_this VALUES (1)' };

test('a new database is given every migration, in order, and each is written down', () =>
  onANewDatabase(async (db) => {
    assert.deepEqual(await standing(db), { pending: ids, unknown: [] });
    assert.deepEqual(await migrate(db), ids);
    assert.deepEqual(await standing(db), { pending: [], unknown: [] });
    assert.deepEqual((await db.query<{ id: string }>('SELECT id FROM schema_migrations ORDER BY id')).map((row) => row.id), ids);
  }));

test('a database that is up to date is left as it is', () =>
  onANewDatabase(async (db) => {
    await migrate(db, [first, second]);
    assert.deepEqual(await migrate(db, [first, second]), []);
    assert.equal((await db.one<{ n: number }>('SELECT count(*)::int AS n FROM first_things'))?.n, 1);
  }));

test('only what is missing is applied', () =>
  onANewDatabase(async (db) => {
    await migrate(db, [first]);
    assert.deepEqual(await standing(db, [first, second]), { pending: ['0002-second'], unknown: [] });
    assert.deepEqual(await migrate(db, [first, second]), ['0002-second']);
  }));

test('a database created before migrations existed is adopted by the first one, with what it holds', () =>
  onANewDatabase(async (db) => {
    // As a version that knew neither the ledger nor what each prompt suits left it.
    await migrate(db, MIGRATIONS.slice(0, 1));
    await db.run('DROP TABLE schema_migrations');
    await db.run('ALTER TABLE prompts DROP COLUMN affinity_json');
    await db.run(`INSERT INTO organizations (name) VALUES ('Brightwater')`);
    assert.deepEqual(await migrate(db), ids);
    assert.ok((await columnsOf(db, 'prompts')).includes('affinity_json'));
    assert.equal((await db.one<{ name: string }>('SELECT name FROM organizations'))?.name, 'Brightwater');
  }));

test('a migration that fails leaves nothing of itself, and says where it failed', () =>
  onANewDatabase(async (db) => {
    await assert.rejects(migrate(db, [first, second, broken]), /migration 0003-broken failed at "INSERT INTO nothing_like_this/);
    assert.deepEqual(await standing(db, [first, second, broken]), { pending: ['0003-broken'], unknown: [] });
    assert.equal(await exists(db, 'second_things'), true);
    assert.equal(await exists(db, 'third_things'), false);
  }));

test('servers starting together apply each migration once', () =>
  onANewDatabase(async (db) => {
    const applied = await Promise.all([1, 2, 3, 4].map(() => migrate(db, [first, second])));
    assert.deepEqual(applied.flat().sort(), ['0001-first', '0002-second']);
  }));

test('a database migrated by a newer version says so, and is not refused', () =>
  onANewDatabase(async (db) => {
    await migrate(db, [first, second]);
    assert.deepEqual(await standing(db, [first]), { pending: [], unknown: ['0002-second'] });
    assert.deepEqual(await migrate(db, [first]), []);
  }));

test('each file of migrations/ is one migration, under its name, and they are numbered without a gap', () => {
  const files = readdirSync(new URL('../../src/tooling/db/migrations/', import.meta.url)).sort();
  assert.deepEqual(files, ids.map((id) => `${id}.ts`));
  assert.deepEqual(ids.map((id) => id.slice(0, 5)), ids.map((_, i) => `${String(i + 1).padStart(4, '0')}-`));
});
