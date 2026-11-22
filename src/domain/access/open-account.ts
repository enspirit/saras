// What CreateOrganization and AcceptInvitation have in common: a person gets an account in an
// organisation.
//
//   ReqPre   the address is one
//            the password has ten characters or more
//            nobody has this address yet
import { hashPassword } from '../../tooling/crypto.ts';
import type { Db } from '../../tooling/db.ts';
import type { Role } from '../../types.ts';
import { addressIsFree, mayOpenAccount } from '../computations/access.ts';
import { accepted } from '../refusal.ts';
import { addMember, addressIsTaken } from '../state/members.ts';

/** `on` is the database, or the transaction the account is opened in. Returns the member's number. */
export async function openAccount(on: Db, account: { organizationId: number; address: string; password: unknown; role: Role; language: string; name: string }): Promise<number> {
  const password = accepted(mayOpenAccount(account.address, account.password));
  accepted(addressIsFree(await addressIsTaken(on, account.address)));
  return addMember(on, { organizationId: account.organizationId, address: account.address, passwordHash: hashPassword(password), role: account.role, language: account.language, name: account.name });
}
