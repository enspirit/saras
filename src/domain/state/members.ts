// State: the members of organisations, and the organisations themselves.
import { defaultPrompts } from '../prompts/ready-made-prompts.ts';
import type { Db } from '../../tooling/db.ts';
import type { OrganizationRow, Role, UserRow } from '../../types.ts';
import { Refusal } from '../refusal.ts';

export const installationIsEmpty = async (db: Db): Promise<boolean> => !(await db.one('SELECT 1 FROM users LIMIT 1'));

export const addressIsTaken = async (db: Db, address: string): Promise<boolean> => Boolean(await db.one('SELECT 1 FROM users WHERE email = $1', [address]));

export const memberByAddress = (db: Db, address: string): Promise<UserRow | undefined> => db.one<UserRow>('SELECT * FROM users WHERE email = $1', [address]);

/** The member of this organisation with this number; refused as not found otherwise. */
export async function memberOf(db: Db, organizationId: number, id: unknown): Promise<UserRow> {
  const member = await db.one<UserRow>('SELECT * FROM users WHERE id = $1 AND org_id = $2', [Number(id) || 0, organizationId]);
  if (!member) throw new Refusal('notFound', 'users.notFound');
  return member;
}

export const organizationById = async (db: Db, id: number): Promise<OrganizationRow> => (await db.one<OrganizationRow>('SELECT * FROM organizations WHERE id = $1', [id]))!;

export async function administratorsOf(db: Db, organizationId: number): Promise<number> {
  const counted = await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND org_id = $1`, [organizationId]);
  return counted!.n;
}

export async function addOrganization(db: Db, organization: { name: string; triage: string; skipAutomated: boolean }): Promise<number> {
  const created = await db.one<{ id: number }>('INSERT INTO organizations (name, triage_strategy, skip_automated) VALUES ($1, $2, $3) RETURNING id', [
    organization.name,
    organization.triage,
    organization.skipAutomated,
  ]);
  return created!.id;
}

export async function addMember(db: Db, member: { organizationId: number; address: string; passwordHash: string; role: Role; language: string; name: string }): Promise<number> {
  const created = await db.one<{ id: number }>('INSERT INTO users (org_id, email, password_hash, role, language, name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [
    member.organizationId,
    member.address,
    member.passwordHash,
    member.role,
    member.language,
    member.name,
  ]);
  return created!.id;
}

/** The prompt an organisation starts with, in its creator's language. */
export async function addFirstPrompt(db: Db, organizationId: number, memberId: number, language: string): Promise<void> {
  // prompts.user_id records who created a prompt. One only, the general case: the others
  // are ready-made prompts the administrators add when they want them.
  for (const p of defaultPrompts(language).slice(0, 1)) {
    await db.run('INSERT INTO prompts (org_id, user_id, name, description, system_prompt) VALUES ($1, $2, $3, $4, $5)', [organizationId, memberId, p.name, p.description, p.systemPrompt]);
  }
}

export const setPassword = async (db: Db, memberId: number, passwordHash: string): Promise<void> =>
  void (await db.run('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, memberId]));
