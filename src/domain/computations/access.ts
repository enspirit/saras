// Pure decisions about who may come in and who may do what.
import { isEmailAddress } from '../../tooling/text.ts';
import type { Role } from '../../types.ts';
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import type { Actor } from '../world.ts';

/** ReqPre of everything that maintains the organisation: the member is one of its administrators. */
export const isAdministrator = ({ member }: Actor): Verdict<true> => (member.role === 'admin' ? accept(true) : refuse('forbidden', 'auth.adminOnly'));

/** Derived notion "sign-up is open": the operator allows it, or nobody has an account yet. */
export const signUpIsOpen = (allowedByOperator: boolean, installationIsEmpty: boolean): boolean => allowedByOperator || installationIsEmpty;

/** ReqPre of CreateOrganization: sign-up is open. */
export const maySignUp = (open: boolean): Verdict<true> => (open ? accept(true) : refuse('forbidden', 'auth.signupClosed'));

/** ReqPre wherever an address is given for an account or an invitation: it is one. */
export const isAnAddress = (address: string): Verdict<true> => (isEmailAddress(address) ? accept(true) : refuse('invalid', 'auth.invalidEmail'));

/** A password has ten characters or more. */
export const isLongEnough = (password: unknown): Verdict<string> =>
  typeof password === 'string' && password.length >= 10 ? accept(password) : refuse('invalid', 'auth.passwordTooShort');

/** ReqPre of opening an account: a valid address, and a password of ten characters or more. */
export function mayOpenAccount(address: string, password: unknown): Verdict<string> {
  if (!isEmailAddress(address)) return refuse('invalid', 'auth.invalidEmail');
  return isLongEnough(password);
}

/** ReqPre of opening an account and of inviting: nobody has this address yet. */
export const addressIsFree = (taken: boolean): Verdict<true> => (taken ? refuse('conflict', 'auth.emailTaken') : accept(true));

/** An organisation created without a name is called after the domain of its creator's address. */
export const organizationNameFor = (name: string, address: string): string => name || address.split('@')[1] || address;

/** The role an invitation grants: administrator when asked for, user in every other case. */
export const roleInvitedAs = (asked: unknown): Role => (asked === 'admin' ? 'admin' : 'user');

/** ReqPre of RemoveAdministratorRole: an organisation keeps at least one administrator. */
export const mayRemoveAdministratorRole = (currentRole: Role, administrators: number): Verdict<true> =>
  currentRole === 'admin' && administrators === 1 ? refuse('conflict', 'users.lastAdmin') : accept(true);

/** ReqPre of DeleteMember: not oneself. */
export const mayDeleteMember = (targetId: number, actorId: number): Verdict<true> => (targetId === actorId ? refuse('conflict', 'users.cannotDeleteSelf') : accept(true));

/** ReqPre of DeleteOwnAccount: an organisation keeps an administrator, so its last one does not leave. */
export const mayLeave = (role: Role, administrators: number): Verdict<true> => mayRemoveAdministratorRole(role, administrators);

/** ReqPre of DeleteOrganization: the name typed is the organisation's, spaces around and letter case aside. */
export const namesTheOrganization = (typed: unknown, name: string): Verdict<true> =>
  typeof typed === 'string' && typed.trim().toLowerCase() === name.trim().toLowerCase() ? accept(true) : refuse('invalid', 'organization.nameMismatch');

// ---- the brake on guessing -------------------------------------------------------------------

/** Wrong guesses from one origin: how many, and until when they count. */
export interface Attempts {
  count: number;
  /** Epoch milliseconds. */
  reset: number;
}

export const MAX_WRONG_GUESSES = 10;
export const LOCK_OUT_MS = 15 * 60_000;

/** Derived notion "locked out": ten wrong guesses within the window. */
export const isLockedOut = (attempts: Attempts | undefined, now: number): boolean => Boolean(attempts && attempts.reset > now && attempts.count >= MAX_WRONG_GUESSES);

/** Whether a wrong guess opens a new window of fifteen minutes, or counts in the one in progress. */
export const opensNewWindow = (attempts: Attempts | undefined, now: number): boolean => !attempts || attempts.reset <= now;
