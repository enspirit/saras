// Pure: boards — the attributes a filter keeps, the conditions it puts on emails, who manages a board.
import { STATUS } from '../../../shared/attribute.ts';
import type { BoardFilter, BoardGiven, ReversibleConditions } from '../../../shared/board.ts';
import { BOXES } from '../../../shared/email.ts';
import type { Box, EmailStatus } from '../../../shared/email.ts';
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import type { Actor } from '../world.ts';
import { clipped } from './given.ts';

/** The key of an attribute as a filter may name it: where an email stands, or the number of one of the organisation's own. */
const isAttributeKey = (key: string): boolean => key === STATUS || /^[0-9]+$/.test(key);

/** Values by attribute, as they are kept: only attributes we know how to name, only those with a value. */
export function attributeValuesGiven(named: Record<string, unknown>): Record<string, string[]> {
  const texts = (value: unknown): string[] => (Array.isArray(value) ? [...new Set(value.map((v) => clipped(v, 60)).filter(Boolean))] : []);
  const kept = Object.entries(named).filter(([key, values]) => isAttributeKey(key) && texts(values).length);
  return Object.fromEntries(kept.map(([key, values]) => [key, texts(values)]));
}

/** The conditions on attributes a filter keeps: those of attributes we know how to name. */
function reduced<C extends ReversibleConditions>(conditions: C): C {
  const { attributes, ...others } = conditions;
  const known = Object.entries(attributes ?? {}).filter(([key]) => isAttributeKey(key));
  return (known.length ? { ...others, attributes: Object.fromEntries(known) } : others) as C;
}

/** ReqPost of CreateBoard and EditBoard: the filter is kept reduced to the attributes we know. */
export const filterKept = (filter: BoardFilter): BoardFilter => (filter.except ? { ...reduced(filter), except: reduced(filter.except) } : reduced(filter));

/** A board as it is kept: as given, its filter reduced. */
export const boardKept = (given: BoardGiven): BoardGiven => ({ ...given, filter: filterKept(given.filter) });

type Owned = { shared: boolean; user_id: number };

/** ReqPre of sharing a board: only administrators decide what every member sees. */
export const mayShare = ({ member }: Actor, shared: boolean): Verdict<true> => (!shared || member.role === 'admin' ? accept(true) : refuse('forbidden', 'boards.sharedByAdministrators'));

/** Derived notion "manages a board": its owner; for a shared one, the administrators. */
export const managesBoard = ({ member }: Actor, board: Owned): boolean => (board.shared ? member.role === 'admin' : board.user_id === member.id);

export const mayManageBoard = (actor: Actor, board: Owned): Verdict<true> => (managesBoard(actor, board) ? accept(true) : refuse('forbidden', 'boards.notYours'));

/**
 * The order of ArrangeBoards: the boards given that the member sees, then the ones they did not
 * name, in the order they had. Whatever is given, every board seen has a place.
 */
export function boardsArranged(seen: number[], given: number[]): number[] {
  const named = given.filter((id) => seen.includes(id));
  return [...new Set([...named, ...seen])];
}

/** Conditions on the emails table (aliased `e`), with their parameters. */
export interface Conditions {
  sql: string[];
  params: unknown[];
}

/** A text to find anywhere in a column: `%`, `_` and the escape character itself are taken literally. */
export const containing = (text: string): string => '%' + text.replace(/[\\%_]/g, (special) => '\\' + special) + '%';

/** The statuses the values of "Stands in" stand for. */
const statusesOf = (values: string[]): EmailStatus[] => values.flatMap((value) => [...(BOXES[value as Box] ?? [])]);

/** One condition: its SQL, given the number of its parameter, and that parameter. */
type Part = [write: (n: number) => string, param: unknown];
const part = (sql: string, param: unknown): Part => [(n) => sql.replaceAll('?', '$' + n), param];

/** The condition one attribute puts: where the email stands has its own column, the others are kept together. */
function onAttribute(key: string, values: string[]): Part {
  if (key === STATUS) return part('e.status = ANY(?)', statusesOf(values));
  return part("(e.attributes_json::jsonb -> '" + Number(key) + "' ->> 'value') = ANY(?)", values);
}

/** The conditions on what an email is: its attributes, where it arrived, how recent. */
const whatItIs = (filter: BoardFilter): Part[] => [
  ...Object.entries(filter.attributes ?? {}).map(([key, values]) => onAttribute(key, values)),
  ...(filter.mailbox ? [part('e.account_id = ANY(?)', filter.mailbox)] : []),
  ...(filter.received ? [part('e.date > now() - make_interval(days => ?)', filter.received)] : []),
];

/** The conditions on what an email says: who wrote it, and the words it holds, each of them a condition. */
const whatItSays = (filter: BoardFilter): Part[] => [
  ...(filter.from ? [part('(e.from_name ILIKE ? OR e.from_addr ILIKE ?)', containing(filter.from))] : []),
  ...(filter.keywords ?? '').split(/\s+/).filter(Boolean).map((word) => part('(e.subject ILIKE ? OR e.body_text ILIKE ?)', containing(word))),
];

const partsOf = (filter: BoardFilter): Part[] => [...whatItIs(filter), ...whatItSays(filter)];

/** A condition said the other way round. What is unknown is not true: an email without a value for an attribute is none of its values. */
const reversed = ([write, param]: Part): Part => [(n) => `(${write(n)}) IS NOT TRUE`, param];

/** The conditions a filter puts on emails, their parameters numbered from `first`: those an email must meet, then those it must not. */
export function conditionsOf(filter: BoardFilter, first: number): Conditions {
  const parts = [...partsOf(filter), ...partsOf(filter.except ?? {}).map(reversed)];
  const sql = parts.map(([write], index) => write(first + index));
  if (filter.attachment !== undefined) sql.push(filter.attachment ? "e.attachments_json <> '[]'" : "e.attachments_json = '[]'");
  return { sql, params: parts.map(([, param]) => param) };
}
