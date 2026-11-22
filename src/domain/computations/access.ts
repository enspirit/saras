// Pure decisions about who may do what.
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import type { Actor } from '../world.ts';

/** ReqPre of everything that maintains the organisation: the member is one of its administrators. */
export const isAdministrator = ({ member }: Actor): Verdict<true> => (member.role === 'admin' ? accept(true) : refuse('forbidden', 'auth.adminOnly'));
