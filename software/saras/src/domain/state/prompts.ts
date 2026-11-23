// State: the prompts of an organisation, and what its members said when correcting their proposals.
import type { PromptAffinity } from '../../../shared/prompt.ts';
import type { Db } from '../../tooling/db.ts';
import type { PromptRow } from '../model/prompt.ts';
import { Refusal } from '../refusal.ts';

/** The organisation's prompt with this number; refused as not found otherwise. */
export async function promptOf(db: Db, organizationId: number, id: unknown): Promise<PromptRow> {
  const prompt = Number.isInteger(Number(id)) ? await db.one<PromptRow>('SELECT * FROM prompts WHERE id = $1 AND org_id = $2', [Number(id), organizationId]) : undefined;
  if (!prompt) throw new Refusal('notFound', 'prompts.notFound');
  return prompt;
}

export const promptsOf = (db: Db, organizationId: number): Promise<PromptRow[]> => db.query<PromptRow>('SELECT * FROM prompts WHERE org_id = $1 ORDER BY id', [organizationId]);

/** The organisation's prompts with the emails each suits, in the order of the list: what choosing the one that suits an email needs. */
export const promptsWithAffinity = async (db: Db, organizationId: number): Promise<(PromptRow & { affinity: PromptAffinity })[]> =>
  (await promptsOf(db, organizationId)).map((prompt) => ({ ...prompt, affinity: JSON.parse(prompt.affinity_json) }));

/**
 * What this member said when correcting proposals made with this prompt, most recent first.
 * Corrections are personal ("I am on first-name terms with this client"): they steer the
 * proposals of the member who made them, not those of colleagues.
 */
export async function lessonsFor(db: Db, promptId: number, memberId: number): Promise<string[]> {
  const rows = await db.query<{ change_reason: string }>(
    `SELECT change_reason FROM replies
     WHERE prompt_id = $1 AND user_id = $2 AND was_edited AND change_reason != '' ORDER BY id DESC LIMIT 8`,
    [promptId, memberId],
  );
  return rows.map((r) => r.change_reason);
}
