// Pure: boards — what a filter given is reduced to, the conditions it puts on emails, who manages a board.
import { PRIORITY, STATUS } from '../../../shared/attribute.ts';
import type { BoardFilter, BoardGiven } from '../../../shared/board.ts';
import { BOXES } from '../../../shared/email.ts';
import type { Box, EmailStatus } from '../../../shared/email.ts';
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import type { Actor } from '../world.ts';
import { clipped } from './given.ts';

const numbers = (value: unknown): number[] => (Array.isArray(value) ? [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : []);
const days = (value: unknown): number => (Number.isInteger(Number(value)) && Number(value) > 0 ? Math.min(Number(value), 3650) : 0);
const texts = (value: unknown): string[] => (Array.isArray(value) ? [...new Set(value.map((v) => clipped(v, 60)).filter(Boolean))] : []);

/** The key of an attribute as a filter may name it: one of the two pre-configured, or the number of one the organisation made. */
const isAttributeKey = (key: string): boolean => key === STATUS || key === PRIORITY || /^[0-9]+$/.test(key);

/** Values by attribute, as they are kept: only attributes we know how to name, only those with a value. */
export function attributeValuesGiven(named: Record<string, unknown>): Record<string, string[]> {
  const kept = Object.entries(named).filter(([key, values]) => isAttributeKey(key) && texts(values).length);
  return Object.fromEntries(kept.map(([key, values]) => [key, texts(values)]));
}

/** The conditions on attributes: by key, the values kept. A filter made before attributes existed named two of them itself. */
function attributesGiven(given: Record<string, unknown>): Record<string, string[]> {
  const named: Record<string, unknown> = given.attributes && typeof given.attributes === 'object' ? { ...given.attributes } : {};
  named[STATUS] ??= given.box;
  named[PRIORITY] ??= given.priority;
  return attributeValuesGiven(named);
}

/** A filter as it is kept: only what we know how to filter on, only the conditions that say something. */
export function filterGiven(value: unknown): BoardFilter {
  const given = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const filter: BoardFilter = {};
  if (Object.keys(attributesGiven(given)).length) filter.attributes = attributesGiven(given);
  if (numbers(given.mailbox).length) filter.mailbox = numbers(given.mailbox);
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
const containing = (text: string): string => '%' + text.replace(/[\\%_]/g, (special) => '\\' + special) + '%';

/** The statuses the values of "Stands in" stand for. */
const statusesOf = (values: string[]): EmailStatus[] => values.flatMap((value) => [...(BOXES[value as Box] ?? [])]);

/** One condition: its SQL, given the number of its parameter, and that parameter. */
type Part = [write: (n: number) => string, param: unknown];
const part = (sql: string, param: unknown): Part => [(n) => sql.replaceAll('?', '$' + n), param];

/** The condition one attribute puts: where the email stands and its priority have their own columns, the others are kept together. */
function onAttribute(key: string, values: string[]): Part {
  if (key === STATUS) return part('e.status = ANY(?)', statusesOf(values));
  if (key === PRIORITY) return part('e.priority = ANY(?)', values);
  return part("(e.attributes_json::jsonb -> '" + Number(key) + "' ->> 'value') = ANY(?)", values);
}

/** The conditions on what an email is: its attributes, where it arrived, how recent. */
const whatItIs = (filter: BoardFilter): Part[] => [
  ...Object.entries(filter.attributes ?? {}).map(([key, values]) => onAttribute(key, values)),
  ...(filter.mailbox ? [part('e.account_id = ANY(?)', filter.mailbox)] : []),
  ...(filter.received ? [part('e.date > now() - make_interval(days => ?)', filter.received)] : []),
];

/** The conditions on what an email says: who wrote it, and the words it holds, each of which must appear. */
const whatItSays = (filter: BoardFilter): Part[] => [
  ...(filter.from ? [part('(e.from_name ILIKE ? OR e.from_addr ILIKE ?)', containing(filter.from))] : []),
  ...(filter.keywords ?? '').split(/\s+/).filter(Boolean).map((word) => part('(e.subject ILIKE ? OR e.body_text ILIKE ?)', containing(word))),
];

/** The conditions a filter puts on emails, their parameters numbered from `first`. */
export function conditionsOf(filter: BoardFilter, first: number): Conditions {
  const parts = [...whatItIs(filter), ...whatItSays(filter)];
  const sql = parts.map(([write], index) => write(first + index));
  if (filter.attachment !== undefined) sql.push(filter.attachment ? "e.attachments_json <> '[]'" : "e.attachments_json = '[]'");
  return { sql, params: parts.map(([, param]) => param) };
}
