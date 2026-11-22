// How people are named in the interface.

import type { Role } from '../api/access.ts';
import { t } from '../i18n.ts';

/** How a person is shown: by their name when they gave one, by their address otherwise. */
export const called = (name: string | null | undefined, email: string): string => name?.trim() || email;

export const roleLabel = (role: Role): string => (role === 'admin' ? t('role.admin') : t('role.user'));
