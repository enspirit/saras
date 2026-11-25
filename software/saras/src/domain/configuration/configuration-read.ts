// What ApplyConfiguration and the check of a configuration both require: a configuration read
// as a whole, with everything wrong in it and where, before anything is written.
import type { AttributeConfigured, BoardConfigured, Configuration } from '../../../shared/configuration.ts';
import { problem } from '../../tooling/messages.ts';
import type { MessageCode, MessageParams, ServerProblem } from '../../tooling/messages.ts';
import { isDecidable } from '../attributes/attribute-rules.ts';
import type { ConfigurationGiven, Known } from '../computations/configuration.ts';
import { attributeRead, attributesAfter, saidTwice, unknownIn } from '../computations/configuration-names.ts';
import { clipped } from '../computations/given.ts';
import { Refusal } from '../refusal.ts';

/** Something wrong in a configuration, and where: `attributes.0`, `boards.2.filter`. */
export type Wrong = ServerProblem & { at: string };

export interface ConfigurationRead {
  /** The attributes that are ones, and the boards as they were given: what is applied when nothing is wrong. */
  configuration: Configuration;
  problems: Wrong[];
}

const wrong = (at: string, code: MessageCode, params: MessageParams = {}): Wrong => ({ at, ...problem(code, params) });

/** ReqPre: decided by a rule, an attribute has one that Elo can read. */
function undecidable(attribute: AttributeConfigured, at: string): Wrong[] {
  try {
    isDecidable(attribute);
    return [];
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    return [{ at, ...e.problem }];
  }
}

/** ReqPre: an attribute is one CreateAttribute or EditAttribute accepts. One whose rule alone is wrong is still what boards may name. */
function attributeAt(given: Record<string, unknown>, place: number): { read: AttributeConfigured[]; wrong: Wrong[] } {
  const verdict = attributeRead(given);
  if (!verdict.ok) return { read: [], wrong: [{ at: `attributes.${place}`, ...verdict.refusal.problem }] };
  return { read: [verdict.value], wrong: undecidable(verdict.value, `attributes.${place}`) };
}

/** ReqPre: nothing is named twice. */
const namedTwice = (what: string, names: string[]): Wrong[] => saidTwice(names).map((place) => wrong(`${what}.${place}`, 'configuration.namedTwice', { name: names[place] ?? '' }));

/** ReqPre: a board has a name, and its filter names what there will be. */
function wrongInBoards(boards: BoardConfigured[], known: Known): Wrong[] {
  const unnamed = boards.flatMap(({ name }, place) => (name ? [] : [wrong(`boards.${place}`, 'boards.nameRequired')]));
  const unknown = boards.flatMap(({ filter }, place) => unknownIn(filter, known).map(({ code, params }) => wrong(`boards.${place}.filter`, code, params)));
  return [...unnamed, ...namedTwice('boards', boards.map(({ name }) => name)), ...unknown];
}

/** A configuration given, read against what the organisation has: what it would apply, and everything that keeps it from being applied. */
export function configurationRead(given: ConfigurationGiven, known: Known): ConfigurationRead {
  const read = given.attributes.map(attributeAt);
  const attributes = read.flatMap((one) => one.read);
  const twice = namedTwice('attributes', given.attributes.map(({ name }) => clipped(name, 60)));
  const after = { ...known, attributes: attributesAfter(known, attributes) };
  return { configuration: { attributes, boards: given.boards }, problems: [...read.flatMap((one) => one.wrong), ...twice, ...wrongInBoards(given.boards, after)] };
}
