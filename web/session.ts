// What the application remembers between pages: who is signed in, how many emails each box
// holds, the boards of the menu, and the brand of the installation.

import type { Board } from '../shared/board.ts';
import type { Box } from '../shared/email.ts';
import type { Profile } from '../shared/member.ts';
import { readBoards } from './api/boards.ts';
import { readMe } from './api/settings.ts';
import type { Brand } from './ui/brand.ts';

export const session: { me: Profile | null; counts: Partial<Record<Box, number>>; boards: Board[]; brand: Brand } = {
  me: null,
  counts: {},
  boards: [],
  brand: { name: '', tagline: '', logo: null, logoDark: null, byline: '', credit: '', euHosting: false },
};

/** The signed-in user. Only called from pages shown after sign-in. */
export const me = (): Profile => session.me as Profile;

export const isAdmin = (): boolean => session.me?.role === 'admin';

/** Whether the path still has to ask for the AI's key: no key is available, and this person may give the organisation's. */
export const needsKey = (): boolean => isAdmin() && !me().hasKey;

/** Asks the server again who is signed in, and remembers the answer. */
export async function refreshMe(): Promise<Profile> {
  session.me = await readMe();
  return session.me;
}

/** Asks the server again for the boards of the menu, and remembers them. A failure leaves the menu as it was. */
export async function refreshBoards(): Promise<Board[]> {
  session.boards = await readBoards().catch(() => session.boards);
  return session.boards;
}
