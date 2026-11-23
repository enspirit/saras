// RequestPasswordReset — someone who lost their password asks for a link to choose a new one,
// sent to their address.
//
//   DomPre   (none)
//   DomPost  if the address is a member's: a link to choose a new password exists for them,
//            replacing any earlier one, and was sent to that address
//   ReqPre   this server was given a way to send mail (otherwise an administrator gives the link)
//   ReqPost  the answer is the same whether the address is a member's or not
//            the link is good once, for an hour; only its hash is kept
//            asking again within two minutes sends nothing more
import { randomToken } from '../../tooling/crypto.ts';
import { addressGiven } from '../computations/given.ts';
import { resetLetter, resetLink } from '../computations/password-reset.ts';
import { Refusal } from '../refusal.ts';
import { memberByAddress } from '../state/members.ts';
import { askedRecently, keepPasswordReset, RESET_MINUTES } from '../state/password-resets.ts';
import type { World } from '../world.ts';

export async function requestPasswordReset({ db, postman, config }: World, address: unknown): Promise<void> {
  if (!postman.configured) throw new Refusal('invalid', 'auth.resetNotByEmail');
  const member = await memberByAddress(db, addressGiven(address));
  if (!member || (await askedRecently(db, member.id))) return;
  const token = randomToken();
  await keepPasswordReset(db, member.id, token);
  // A letter that cannot be sent is the server's trouble, not something to tell a visitor.
  await postman.send(resetLetter(member.email, member.language, resetLink(config.baseUrl, token), RESET_MINUTES)).catch((e) => console.error(`password reset letter not sent: ${e instanceof Error ? e.message : e}`));
}
