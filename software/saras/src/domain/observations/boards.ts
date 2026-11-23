// Observation: the boards a member sees, and the emails a board shows them.
import type { Board, BoardFilter, EmailsOfBoard } from '../../../shared/board.ts';
import type { Db } from '../../tooling/db.ts';
import { conditionsOf, managesBoard } from '../computations/boards.ts';
import { boardFor, boardsSeenBy } from '../state/boards.ts';
import type { BoardRow } from '../state/boards.ts';
import type { Actor } from '../world.ts';
import { SEEN_BY_MEMBER, emailSummaries } from './emails.ts';

/** How many of the emails a member may see a filter keeps. */
async function countOf(db: Db, { member, organization }: Actor, filter: BoardFilter): Promise<number> {
  const { sql, params } = conditionsOf(filter, 3);
  const counted = await db.one<{ n: number }>(`SELECT count(*)::int AS n ${[SEEN_BY_MEMBER, ...sql].join(' AND ')}`, [organization.id, member.id, ...params]);
  return counted?.n ?? 0;
}

/** A board as this member sees it: whether they manage it, and how many emails it shows them now. */
export async function boardSeenBy(db: Db, actor: Actor, row: BoardRow): Promise<Board> {
  const filter: BoardFilter = JSON.parse(row.filter_json);
  return { id: row.id, name: row.name, shared: row.shared, canManage: managesBoard(actor, row), filter, count: await countOf(db, actor, filter) };
}

/** The shared boards, then the member's own. */
export async function boardsFor(db: Db, actor: Actor): Promise<Board[]> {
  const boards: Board[] = [];
  for (const row of await boardsSeenBy(db, actor)) boards.push(await boardSeenBy(db, actor, row));
  return boards;
}

/** A board, with the 200 most recent emails it shows this member: only those of mailboxes they may use. */
export async function emailsOfBoard(db: Db, actor: Actor, boardId: unknown): Promise<EmailsOfBoard> {
  const board = await boardSeenBy(db, actor, await boardFor(db, actor, boardId));
  return { board, emails: await emailSummaries(db, actor, conditionsOf(board.filter, 3)) };
}
