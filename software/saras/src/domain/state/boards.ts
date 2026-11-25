// State: the boards of an organisation's members.
import type { BoardGiven } from '../../../shared/board.ts';
import type { Db } from '../../tooling/db.ts';
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
}

/** Derived notion "sees a board": it is in the member's organisation, and is theirs or shared. */
const SEEN = 'org_id = $1 AND (user_id = $2 OR shared)';

/** Where a board stands in the order its member gave: null for one they never placed. */
const PLACE = `array_position(ARRAY(SELECT jsonb_array_elements_text(u.board_order_json::jsonb)::int FROM users u WHERE u.id = $2), id)`;

/** The boards a member sees, in the order they gave them; those they never placed after, the shared ones first, then their own, each in the order they were made. */
export const boardsSeenBy = (db: Db, { member, organization }: Actor): Promise<BoardRow[]> =>
  db.query<BoardRow>(`SELECT * FROM boards WHERE ${SEEN} ORDER BY ${PLACE} NULLS LAST, shared DESC, id`, [organization.id, member.id]);

/** The order a member gives to their boards: theirs alone. */
export const keepBoardOrder = async (db: Db, memberId: number, boardIds: number[]): Promise<void> =>
  void (await db.run('UPDATE users SET board_order_json = $1 WHERE id = $2', [JSON.stringify(boardIds), memberId]));

/** The board with this number, if the member sees it. Refused as not found otherwise: what one may not see does not exist. */
export async function boardFor(db: Db, { member, organization }: Actor, id: unknown): Promise<BoardRow> {
  const board = await db.one<BoardRow>(`SELECT * FROM boards WHERE ${SEEN} AND id = $3`, [organization.id, member.id, Number(id) || 0]);
  if (!board) throw new Refusal('notFound', 'boards.notFound');
  return board;
}

export async function addBoard(db: Db, { member, organization }: Actor, { name, shared, filter }: BoardGiven): Promise<BoardRow> {
  const added = await db.one<BoardRow>('INSERT INTO boards (org_id, user_id, shared, name, filter_json) VALUES ($1, $2, $3, $4, $5) RETURNING *', [
    organization.id,
    member.id,
    shared,
    name,
    JSON.stringify(filter),
  ]);
  return added!;
}

export const changeBoard = async (db: Db, id: number, { name, shared, filter }: BoardGiven): Promise<BoardRow> =>
  (await db.one<BoardRow>('UPDATE boards SET name = $1, shared = $2, filter_json = $3 WHERE id = $4 RETURNING *', [name, shared, JSON.stringify(filter), id]))!;

export const forgetBoard = async (db: Db, id: number): Promise<void> => void (await db.run('DELETE FROM boards WHERE id = $1', [id]));
