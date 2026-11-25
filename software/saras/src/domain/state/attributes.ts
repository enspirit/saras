// State: the attributes an organisation gives its emails, and how each is decided.
import { STATUS } from '../../../shared/attribute.ts';
import type { Attribute, AttributeGiven, AttributeValue, Decider, ValueGiven } from '../../../shared/attribute.ts';
import type { Db } from '../../tooling/db.ts';
import { STATUS_VALUES, attributeTold, inColorsKept } from '../computations/attributes.ts';
import { DEFAULT_STATUS_RULE } from '../computations/default-rules.ts';
import type { OrganizationRow } from '../model/organization.ts';
import { Refusal } from '../refusal.ts';

/** An attribute as it is kept. `key` is null for one of the organisation's own: its number names it. */
interface AttributeRow {
  id: number;
  key: string | null;
  name: string;
  kind: 'choice' | 'member';
  values_json: string;
  decided_by: Decider;
  elo: string;
}

const rowsOf = (db: Db, organizationId: number): Promise<AttributeRow[]> => db.query<AttributeRow>('SELECT * FROM attributes WHERE org_id = $1 ORDER BY id', [organizationId]);

/** The members of an organisation as the values of a "member" attribute: their number, and their address to name them in a rule. */
export const membersAsValues = (db: Db, organizationId: number): Promise<AttributeValue[]> =>
  db.query<AttributeValue>(`SELECT id::text AS key, email AS label FROM users WHERE org_id = $1 ORDER BY id`, [organizationId]);

/**
 * "Stands in": its values are fixed, in the colours the organisation gave them. Whether its rule decides it is the organisation's
 * setting (automated mail set aside first); its rule is the one kept for it, the automated-mail rule by default.
 */
const status = (organization: OrganizationRow, kept: AttributeRow | undefined): Attribute => ({
  key: STATUS,
  name: 'Stands in',
  kind: 'choice',
  values: inColorsKept(STATUS_VALUES, kept?.values_json),
  decidedBy: organization.skip_automated ? 'elo' : 'nobody',
  elo: kept?.elo || DEFAULT_STATUS_RULE,
  system: true,
});

/** Every attribute of an organisation: where an email stands, then its own, in the order they were made. */
export async function attributesOf(db: Db, organization: OrganizationRow): Promise<Attribute[]> {
  const rows = await rowsOf(db, organization.id);
  const members = rows.some((row) => row.kind === 'member') ? await membersAsValues(db, organization.id) : [];
  const made = rows.filter((row) => !row.key).map((row) => attributeTold({ ...row, key: String(row.id), values_json: row.kind === 'member' ? JSON.stringify(members) : row.values_json }));
  return [status(organization, rows.find((row) => row.key === STATUS)), ...made];
}

/** The attribute with this key; refused as not found otherwise. */
export async function attributeOf(db: Db, organization: OrganizationRow, key: unknown): Promise<Attribute> {
  const attribute = (await attributesOf(db, organization)).find((a) => a.key === String(key));
  if (!attribute) throw new Refusal('notFound', 'attributes.notFound');
  return attribute;
}

const valuesKept = (values: ValueGiven[]): string => JSON.stringify(values.map(({ label, color }, index) => ({ key: String(index + 1), label, color })));

export async function addAttribute(db: Db, organizationId: number, { name, kind, values, decidedBy, elo }: AttributeGiven): Promise<string> {
  const added = await db.one<{ id: number }>('INSERT INTO attributes (org_id, name, kind, values_json, decided_by, elo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [organizationId, name, kind, valuesKept(values), decidedBy, elo]);
  return String(added!.id);
}

export const changeAttribute = async (db: Db, organizationId: number, key: string, { name, kind, values, decidedBy, elo }: AttributeGiven): Promise<void> =>
  void (await db.run('UPDATE attributes SET name = $1, kind = $2, values_json = $3, decided_by = $4, elo = $5 WHERE org_id = $6 AND id = $7 AND key IS NULL', [name, kind, valuesKept(values), decidedBy, elo, organizationId, Number(key) || 0]));

/** What is kept of the pre-configured attribute: how it is decided, and the colour of each of its values. */
export async function keepSystemAttribute(db: Db, organizationId: number, { key, decidedBy, elo, values }: Pick<Attribute, 'key' | 'decidedBy' | 'elo' | 'values'>): Promise<void> {
  const colors = JSON.stringify(values.map(({ key, color }) => ({ key, color })));
  await db.run('DELETE FROM attributes WHERE org_id = $1 AND key = $2', [organizationId, key]);
  await db.run(`INSERT INTO attributes (org_id, key, name, kind, values_json, decided_by, elo) VALUES ($1, $2, $2, 'choice', $3, $4, $5)`, [organizationId, key, colors, decidedBy, elo]);
}

/** Forgets one of the organisation's own attributes. The values emails had for it are left behind, unseen. */
export const forgetAttribute = async (db: Db, organizationId: number, key: string): Promise<void> =>
  void (await db.run('DELETE FROM attributes WHERE org_id = $1 AND id = $2 AND key IS NULL', [organizationId, Number(key) || 0]));
