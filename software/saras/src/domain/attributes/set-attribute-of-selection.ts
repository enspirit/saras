// SetAttributeOfSelection — a member gives several emails, at once, a value for an attribute by
// hand, or takes it away from them.
//
//   DomPre   emails the member may see: those ticked, or all of a box or a board, as searched;
//            an attribute of the organisation
//   DomPost  each of them has this value for the attribute, as the member's — or none
//   ReqPre   the value is one of the attribute's; not "Stands in" (as SetEmailAttribute);
//            at most TICKED_MAX emails ticked
//   ReqPost  one statement for all of them, whatever their number; their other values are kept
import type { SelectionDone } from '../../../shared/email.ts';
import { selectionGiven } from '../computations/selection.ts';
import { accepted } from '../refusal.ts';
import { attributeOf } from '../state/attributes.ts';
import { idsMeeting, selectionConditions } from '../state/views.ts';
import type { Actor, World } from '../world.ts';
import { valueOf } from './set-email-attribute.ts';

/** What changes in each email, its parameter being `$n`: the value kept with the others, or taken away. */
const changeOf = (key: string, value: string | null, n: number): { set: string; param: string } =>
  value === null
    ? { set: `attributes_json = (attributes_json::jsonb - $${n})::text`, param: key }
    : { set: `attributes_json = (attributes_json::jsonb || $${n}::jsonb)::text`, param: JSON.stringify({ [key]: { value, source: 'user' } }) };

export async function setAttributeOfSelection({ db }: World, actor: Actor, given: unknown, key: unknown, value: unknown): Promise<SelectionDone> {
  const selection = accepted(selectionGiven(given));
  const attribute = await attributeOf(db, actor.organization, key);
  const conditions = await selectionConditions(db, actor, selection);
  const change = changeOf(attribute.key, valueOf(attribute, value), 3 + conditions.params.length);
  const done = await db.one<SelectionDone>(
    `WITH changed AS (UPDATE emails SET ${change.set} WHERE id IN (${idsMeeting(conditions)}) RETURNING 1) SELECT count(*)::int AS changed FROM changed`,
    [actor.organization.id, actor.member.id, ...conditions.params, change.param],
  );
  return { changed: done?.changed ?? 0 };
}
