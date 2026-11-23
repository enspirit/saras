// State: the boards of an organisation's members.
import type { BoardGiven } from '../../../shared/board.ts';
import type { Db } from '../../tooling/db.ts';
import { conditionsOf } from '../computations/boards.ts';
import { Refusal } from '../refusal.ts';
import type { Actor } from '../world.ts';

/** A board as it is kept: whose it is, and its filter as JSON. */
export interface BoardRow {
  id: number;
  org_id: number;
  user_id: number;
  shared: boolean;
  name: string;
  filter_json: string;
  prompt_id: number | null;
}

/** Derived notion "sees a board": it is in the member's organisation, and is theirs or shared. */
const SEEN = 'org_id = $1 AND (user_id = $2 OR shared)';

/** The boards a member sees: the shared ones first, then their own, each in the order they were made. */
export const boardsSeenBy = (db: Db, { member, organization }: Actor): Promise<BoardRow[]> =>
  db.query<BoardRow>(`SELECT * FROM boards WHERE ${SEEN} ORDER BY shared DESC, id`, [organization.id, member.id]);

/** The board with this number, if the member sees it. Refused as not found otherwise: what one may not see does not exist. */
export async function boardFor(db: Db, { member, organization }: Actor, id: unknown): Promise<BoardRow> {
  const board = await db.one<BoardRow>(`SELECT * FROM boards WHERE ${SEEN} AND id = $3`, [organization.id, member.id, Number(id) || 0]);
  if (!board) throw new Refusal('notFound', 'boards.notFound');
  return board;
}

export const addBoard = async (db: Db, { member, organization }: Actor, { name, shared, filter, promptId }: BoardGiven): Promise<BoardRow> =>
  (await db.one<BoardRow>('INSERT INTO boards (org_id, user_id, shared, name, filter_json, prompt_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [organization.id, member.id, shared, name, JSON.stringify(filter), promptId]))!;

export const changeBoard = async (db: Db, id: number, { name, shared, filter, promptId }: BoardGiven): Promise<BoardRow> =>
  (await db.one<BoardRow>('UPDATE boards SET name = $1, shared = $2, filter_json = $3, prompt_id = $4 WHERE id = $5 RETURNING *', [name, shared, JSON.stringify(filter), promptId, id]))!;

/** The shared boards of an organisation that have a prompt, in the order they were made. */
export const sharedBoardsWithPrompt = (db: Db, organizationId: number): Promise<BoardRow[]> =>
  db.query<BoardRow>('SELECT * FROM boards WHERE org_id = $1 AND shared AND prompt_id IS NOT NULL ORDER BY id', [organizationId]);

export const forgetBoard = async (db: Db, id: number): Promise<void> => void (await db.run('DELETE FROM boards WHERE id = $1', [id]));

/** The prompt of the first of these boards that shows this email; none when none does. */
export async function promptOfBoardShowing(db: Db, boards: BoardRow[], emailId: number): Promise<number | null> {
  for (const board of boards) {
    const { sql, params } = conditionsOf(JSON.parse(board.filter_json), 2);
    if (await db.one(`SELECT 1 AS shown FROM emails e WHERE ${['e.id = $1', ...sql].join(' AND ')}`, [emailId, ...params])) return board.prompt_id;
  }
  return null;
}
