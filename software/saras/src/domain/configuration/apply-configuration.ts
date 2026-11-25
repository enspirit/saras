// ApplyConfiguration — an administrator gives the organisation a configuration as data: the
// attributes it wants of each email and the boards its members share, each named as they
// name it. It is how anything that writes a configuration (a person, a script, the assistant)
// has it applied: nothing is done here that the operations on one attribute or one board do not do.
//
//   DomPre   (none)
//   DomPost  the organisation has each attribute named, as it is given: made when it has none of that name, changed otherwise
//            it has each board named, shared with every member, the same way
//   ReqPre   the member is an administrator
//            each attribute is one CreateAttribute or EditAttribute accepts, its rule included; none is named twice
//            each board has a name, and none is named twice
//            a filter names attributes there will be, values they will have, and mailboxes the administrator may use
//   ReqPost  all of it, or none of it
//            what is not named is left as it is: nothing is deleted
//            of the pre-configured attribute, only how it is decided and the colours given change
//            emails already kept stay as they were sorted
import type { Attribute } from '../../../shared/attribute.ts';
import { sameName } from '../../../shared/configuration.ts';
import type { AttributeConfigured, BoardConfigured, Configuration } from '../../../shared/configuration.ts';
import { createAttribute } from '../attributes/create-attribute.ts';
import { editAttribute } from '../attributes/edit-attribute.ts';
import { createBoard } from '../boards/create-board.ts';
import { editBoard } from '../boards/edit-board.ts';
import { isAdministrator } from '../computations/access.ts';
import { configurationGiven } from '../computations/configuration.ts';
import { attributeNamed, filterResolved, systemEdited } from '../computations/configuration-names.ts';
import { configurationOf, knownTo, sharedBoards } from '../observations/configuration.ts';
import { Refusal, accepted } from '../refusal.ts';
import type { Actor, World } from '../world.ts';
import { configurationRead } from './configuration-read.ts';

/** CreateAttribute for a name the organisation does not have, EditAttribute otherwise. */
async function applyAttributes(world: World, actor: Actor, attributes: AttributeConfigured[], kept: Attribute[]): Promise<void> {
  for (const given of attributes) {
    const existing = attributeNamed(kept, given.name);
    if (!existing) await createAttribute(world, actor, { ...given });
    else await editAttribute(world, actor, existing.key, existing.system ? systemEdited(existing, given) : { ...given });
  }
}

/** CreateBoard for a name no shared board has, EditBoard otherwise: with what its filter names, as the organisation now numbers it. */
async function applyBoards(world: World, actor: Actor, boards: BoardConfigured[]): Promise<void> {
  const known = await knownTo(world.db, actor);
  const shared = await sharedBoards(world.db, actor);
  for (const { name, filter } of boards) {
    const board = { name, shared: true, filter: filterResolved(filter, known) };
    const existing = shared.find((row) => sameName(row.name, name));
    await (existing ? editBoard(world, actor, existing.id, board) : createBoard(world, actor, board));
  }
}

export async function applyConfiguration(world: World, actor: Actor, given: unknown): Promise<Configuration> {
  accepted(isAdministrator(actor));
  const known = await knownTo(world.db, actor);
  const { configuration, problems } = configurationRead(configurationGiven(given), known);
  const [first] = problems;
  if (first) throw new Refusal('invalid', first.code, first.params);
  await world.db.transaction(async (db) => {
    const within = { ...world, db };
    await applyAttributes(within, actor, configuration.attributes, known.attributes);
    await applyBoards(within, actor, configuration.boards);
  });
  return configurationOf(world.db, actor);
}
