// CreateOrganization — a visitor signs up: their team gets its own space, and they administer it.
//
//   DomPre   nobody has this address
//   DomPost  an organisation exists, with this person as its administrator, signed in
//   ReqPre   the origin is not locked out
//            sign-up is open: the operator allows it, or nobody has an account yet
//            the address is one
//            the password has ten characters or more
//   ReqPost  named after the domain of the address when no name is given
//            it starts with the installation's way of sorting and one prompt, in the person's language
//            a refused sign-up leaves no organisation behind
import { addressGiven, clipped, languageGiven } from '../computations/given.ts';
import { isAnAddress, maySignUp, organizationNameFor, signUpIsOpen } from '../computations/access.ts';
import { accepted } from '../refusal.ts';
import { addFirstPrompt, addOrganization, installationIsEmpty } from '../state/members.ts';
import { openSession } from '../state/sessions.ts';
import type { Session } from '../state/sessions.ts';
import type { World } from '../world.ts';
import { withGuessingBrake } from './guessing-brake.ts';
import { openAccount } from './open-account.ts';

export interface SignUp {
  organization?: unknown;
  email?: unknown;
  password?: unknown;
  name?: unknown;
  language?: unknown;
}

export function createOrganization(world: World, origin: string, given: SignUp): Promise<Session> {
  const { db, config } = world;
  return withGuessingBrake(world, origin, async () => {
    accepted(maySignUp(signUpIsOpen(config.allowSignup, await installationIsEmpty(db))));
    const address = addressGiven(given.email);
    const language = languageGiven(given.language);
    const memberId = await db.transaction(async (tx) => {
      // Checked first, so that a refused account leaves no organisation behind even outside a transaction.
      accepted(isAnAddress(address));
      const organizationId = await addOrganization(tx, { name: organizationNameFor(clipped(given.organization, 120), address), triage: config.triageStrategy, skipAutomated: config.skipAutomated });
      const id = await openAccount(tx, { organizationId, address, password: given.password, role: 'admin', language, name: clipped(given.name, 120) });
      await addFirstPrompt(tx, organizationId, id, language);
      return id;
    });
    return openSession(db, memberId);
  });
}
