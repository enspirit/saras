// Observation: the prompts of an organisation, as each kind of member sees them.
import type { Correction, Prompt, ReadyMadePrompt } from '../../../shared/prompt.ts';
import type { Db } from '../../tooling/db.ts';
import { defaultPrompts } from '../prompts/ready-made-prompts.ts';
import { promptOf } from '../state/prompts.ts';
import type { Actor } from '../world.ts';

/** Members pick a prompt by name and purpose; its instructions stay with the administrators. */
const asMembersSeeThem = (db: Db, organizationId: number): Promise<Prompt[]> => db.query<Prompt>('SELECT id, name, description FROM prompts WHERE org_id = $1 ORDER BY id', [organizationId]);

/** Administrators also see the instructions, and how often each prompt was used and its proposal edited. */
const asAdministratorsSeeThem = (db: Db, organizationId: number): Promise<Prompt[]> =>
  db.query<Prompt>(
    `SELECT p.id, p.name, p.description, p.system_prompt AS "systemPrompt",
            (SELECT count(*)::int FROM replies r WHERE r.prompt_id = p.id) AS used,
            (SELECT count(*)::int FROM replies r WHERE r.prompt_id = p.id AND r.was_edited) AS edited
     FROM prompts p WHERE p.org_id = $1 ORDER BY p.id`,
    [organizationId],
  );

export const promptsFor = (db: Db, { member, organization }: Actor): Promise<Prompt[]> =>
  member.role === 'admin' ? asAdministratorsSeeThem(db, organization.id) : asMembersSeeThem(db, organization.id);

/** Ready-made prompts the organisation does not have yet, in the administrator's language. */
export async function readyMadePromptsLeft(db: Db, { member, organization }: Actor): Promise<ReadyMadePrompt[]> {
  const taken = new Set((await db.query<{ name: string }>('SELECT name FROM prompts WHERE org_id = $1', [organization.id])).map((p) => p.name));
  return defaultPrompts(member.language).filter((p) => !taken.has(p.name));
}

/** Every member's corrections on a prompt, the raw material to improve it: the last fifty. */
export async function correctionsOn(db: Db, { organization }: Actor, promptId: unknown): Promise<Correction[]> {
  const prompt = await promptOf(db, organization.id, promptId);
  const corrections = await db.query<Omit<Correction, 'at'> & { at: Date }>(
    `SELECT r.change_reason AS reason, u.email AS "user", u.name AS "userName", r.sent_at AS at
     FROM replies r JOIN users u ON u.id = r.user_id
     WHERE r.prompt_id = $1 AND r.was_edited AND r.change_reason != '' ORDER BY r.id DESC LIMIT 50`,
    [prompt.id],
  );
  return corrections.map((correction) => ({ ...correction, at: correction.at.toISOString() }));
}
