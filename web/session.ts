// What the application remembers between pages: who is signed in, how many emails each box
// holds, and the brand of the installation.

import type { BoxId } from './api/emails.ts';
import { readMe } from './api/settings.ts';
import type { Me } from './api/settings.ts';
import type { Brand } from './ui/brand.ts';

export const session: { me: Me | null; counts: Partial<Record<BoxId, number>>; brand: Brand } = {
  me: null,
  counts: {},
  brand: { name: '', tagline: '', logo: null, logoDark: null, byline: '', credit: '', euHosting: false },
};

/** The signed-in user. Only called from pages shown after sign-in. */
export const me = (): Me => session.me as Me;

export const isAdmin = (): boolean => session.me?.role === 'admin';

/** Whether the path still has to ask for the AI's key: no key is available, and this person may give the organisation's. */
export const needsKey = (): boolean => isAdmin() && !me().hasKey;

/** Asks the server again who is signed in, and remembers the answer. */
export async function refreshMe(): Promise<Me> {
  session.me = await readMe();
  return session.me;
}
