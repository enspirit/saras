// ChooseLanguage — a member, or the interface on their behalf, says which language they use.
//
//   DomPre   (none)
//   DomPost  the member's language is this one; what the server writes for them follows it
//   ReqPost  a tag we do not recognise is taken as English
import { languageGiven } from '../computations/given.ts';
import type { Actor, World } from '../world.ts';

export const chooseLanguage = async ({ db }: World, { member }: Actor, value: unknown): Promise<void> =>
  void (await db.run('UPDATE users SET language = $1 WHERE id = $2', [languageGiven(value), member.id]));
