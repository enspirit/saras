// Observation: the configuration of an organisation as data, and what is wrong in one given.
import type { Configuration, ConfigurationProblem } from '../../../shared/configuration.ts';
import type { BoardFilter } from '../../../shared/board.ts';
import type { Db } from '../../tooling/db.ts';
import { configurationGiven, configurationTold } from '../computations/configuration.ts';
import type { Known } from '../computations/configuration.ts';
import { configurationRead } from '../configuration/configuration-read.ts';
import { attributesOf, membersAsValues } from '../state/attributes.ts';
import { boardsSeenBy } from '../state/boards.ts';
import type { BoardRow } from '../state/boards.ts';
import { mailboxesUsedBy } from '../state/mailboxes.ts';
import type { Actor } from '../world.ts';

/** What the names of a configuration stand for, for this member: the organisation's attributes and members, and the mailboxes they may use. */
export async function knownTo(db: Db, actor: Actor): Promise<Known> {
  const [attributes, members, mailboxes] = await Promise.all([attributesOf(db, actor.organization), membersAsValues(db, actor.organization.id), mailboxesUsedBy(db, actor)]);
  return { attributes, members, mailboxes };
}

/** The boards every member sees, in the order they were made: the order a member gave their menu is theirs, not the organisation's. */
export const sharedBoards = async (db: Db, actor: Actor): Promise<BoardRow[]> =>
  (await boardsSeenBy(db, actor)).filter((row) => row.shared).sort((one, other) => one.id - other.id);

/** The configuration of the organisation: its attributes, and the boards its members share. */
export async function configurationOf(db: Db, actor: Actor, known?: Known): Promise<Configuration> {
  const boards = (await sharedBoards(db, actor)).map(({ name, filter_json }) => ({ name, filter: JSON.parse(filter_json) as BoardFilter }));
  return configurationTold(known ?? (await knownTo(db, actor)), boards);
}

/** Everything that keeps a configuration from being applied, each with its place; nothing when ApplyConfiguration would take it. Nothing is changed. */
export const checkConfiguration = async (db: Db, actor: Actor, given: unknown): Promise<ConfigurationProblem[]> =>
  configurationRead(configurationGiven(given), await knownTo(db, actor)).problems;
