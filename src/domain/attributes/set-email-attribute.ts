// SetEmailAttribute — a member gives an email a value for an attribute by hand, or takes it away.
//
//   DomPre   an email, and an attribute of the organisation
//   DomPost  the email has this value for the attribute, as the member's — or none
//   ReqPre   the member may use the email's mailbox
//            the value is one of the attribute's
//            not "Stands in": where an email stands is changed by acting on it (the sorting corrections, a reply)
//   ReqPost  a value set by hand is not overwritten by later sorting
import { PRIORITY, STATUS } from '../../../shared/attribute.ts';
import type { Attribute } from '../../../shared/attribute.ts';
import type { Db } from '../../tooling/db.ts';
import { Refusal } from '../refusal.ts';
import { attributeOf } from '../state/attributes.ts';
import { emailFor } from '../state/emails.ts';
import type { Actor, World } from '../world.ts';

/** ReqPre: null to take the value away, or one of the attribute's values, by its key. */
function valueOf(attribute: Attribute, given: unknown): string | null {
  if (given === null || given === '') return null;
  const value = attribute.values.find((v) => v.key === String(given));
  if (!value || attribute.key === STATUS) throw new Refusal('invalid', 'attributes.valueUnknown');
  return value.key;
}

const keep = async (db: Db, emailId: number, key: string, value: string): Promise<void> =>
  void (await db.run(`UPDATE emails SET attributes_json = (attributes_json::jsonb || $1::jsonb)::text WHERE id = $2`, [JSON.stringify({ [key]: { value, source: 'user' } }), emailId]));

const forget = async (db: Db, emailId: number, key: string): Promise<void> =>
  void (await db.run(`UPDATE emails SET attributes_json = (attributes_json::jsonb - $1)::text WHERE id = $2`, [key, emailId]));

export async function setEmailAttribute({ db }: World, actor: Actor, emailId: unknown, key: unknown, given: unknown): Promise<void> {
  const email = await emailFor(db, actor, emailId);
  const attribute = await attributeOf(db, actor.organization, key);
  const value = valueOf(attribute, given);
  // Priority is also kept where the lists read it; without a value it goes back to normal.
  if (attribute.key === PRIORITY) await db.run('UPDATE emails SET priority = $1 WHERE id = $2', [value ?? 'normal', email.id]);
  await (value === null ? forget(db, email.id, attribute.key) : keep(db, email.id, attribute.key, value));
}
