// Pure: boards — what a filter given is reduced to, the conditions it puts on emails, who manages a board.
import { PRIORITIES } from '../../../shared/board.ts';
import type { BoardFilter, BoardGiven } from '../../../shared/board.ts';
import { BOXES } from '../../../shared/email.ts';
import type { Box, EmailStatus } from '../../../shared/email.ts';
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import type { Actor } from '../world.ts';
import { clipped } from './given.ts';

const BOX_NAMES = Object.keys(BOXES) as Box[];
const among = <T>(known: readonly T[], value: unknown): T[] => (Array.isArray(value) ? known.filter((item) => value.includes(item)) : []);
const numbers = (value: unknown): number[] => (Array.isArray(value) ? [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : []);
const days = (value: unknown): number => (Number.isInteger(Number(value)) && Number(value) > 0 ? Math.min(Number(value), 3650) : 0);

/** The conditions made of a choice among known values: kept only when something is chosen. */
function choicesGiven(given: Record<string, unknown>): BoardFilter {
  const filter: BoardFilter = {};
  if (numbers(given.mailbox).length) filter.mailbox = numbers(given.mailbox);
  if (among(BOX_NAMES, given.box).length) filter.box = among(BOX_NAMES, given.box);
  if (among(PRIORITIES, given.priority).length) filter.priority = among(PRIORITIES, given.priority);
  return filter;
}

/** A filter as it is kept: only the attributes we know, only the conditions that say something. */
export function filterGiven(value: unknown): BoardFilter {
  const given = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const filter = choicesGiven(given);
  if (days(given.received)) filter.received = days(given.received);
  if (clipped(given.from, 200)) filter.from = clipped(given.from, 200);
  if (clipped(given.keywords, 200)) filter.keywords = clipped(given.keywords, 200);
  if (typeof given.attachment === 'boolean') filter.attachment = given.attachment;
  return filter;
}

/** ReqPre of CreateBoard and EditBoard: a name. */
export function boardGiven(given: { name?: unknown; shared?: unknown; filter?: unknown }): Verdict<BoardGiven> {
  const name = clipped(given.name, 80);
  if (!name) return refuse('invalid', 'boards.nameRequired');
  return accept({ name, shared: given.shared === true, filter: filterGiven(given.filter) });
}

type Owned = { shared: boolean; user_id: number };

/** ReqPre of sharing a board: only administrators decide what every member sees. */
export const mayShare = ({ member }: Actor, shared: boolean): Verdict<true> => (!shared || member.role === 'admin' ? accept(true) : refuse('forbidden', 'boards.sharedByAdministrators'));

/** Derived notion "manages a board": its owner; for a shared one, the administrators. */
export const managesBoard = ({ member }: Actor, board: Owned): boolean => (board.shared ? member.role === 'admin' : board.user_id === member.id);

export const mayManageBoard = (actor: Actor, board: Owned): Verdict<true> => (managesBoard(actor, board) ? accept(true) : refuse('forbidden', 'boards.notYours'));

/** Conditions on the emails table (aliased `e`), with their parameters. */
export interface Conditions {
  sql: string[];
  params: unknown[];
}

/** A text to find anywhere in a column: `%`, `_` and the escape character itself are taken literally. */
const containing = (text: string): string => `%${text.replace(/[\\%_]/g, (special) => `\\${special}`)}%`;

const statusesOf = (boxes: Box[]): EmailStatus[] => boxes.flatMap((box) => [...BOXES[box]]);

/** One condition: its SQL, given the number of its parameter, and that parameter. */
type Part = [write: (n: number) => string, param: unknown];

/** The conditions on what an email is: where it arrived, where it stands, how urgent, how recent. */
const whatItIs = (filter: BoardFilter): Part[] => [
  ...(filter.mailbox ? [[(n: number) => `e.account_id = ANY($${n})`, filter.mailbox] as Part] : []),
  ...(filter.box ? [[(n: number) => `e.status = ANY($${n})`, statusesOf(filter.box)] as Part] : []),
  ...(filter.priority ? [[(n: number) => `e.priority = ANY($${n})`, filter.priority] as Part] : []),
  ...(filter.received ? [[(n: number) => `e.date > now() - make_interval(days => $${n})`, filter.received] as Part] : []),
];

/** The conditions on what an email says: who wrote it, and the words it holds, each of which must appear. */
const whatItSays = (filter: BoardFilter): Part[] => [
  ...(filter.from ? [[(n: number) => `(e.from_name ILIKE $${n} OR e.from_addr ILIKE $${n})`, containing(filter.from)] as Part] : []),
  ...(filter.keywords ?? '').split(/\s+/).filter(Boolean).map((word): Part => [(n) => `(e.subject ILIKE $${n} OR e.body_text ILIKE $${n})`, containing(word)]),
];

/** The conditions a filter puts on emails, their parameters numbered from `first`. */
export function conditionsOf(filter: BoardFilter, first: number): Conditions {
  const parts = [...whatItIs(filter), ...whatItSays(filter)];
  const sql = parts.map(([write], index) => write(first + index));
  if (filter.attachment !== undefined) sql.push(filter.attachment ? `e.attachments_json <> '[]'` : `e.attachments_json = '[]'`);
  return { sql, params: parts.map(([, param]) => param) };
}
