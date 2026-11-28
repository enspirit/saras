// Settings: who is signed in, their own settings, and those of their organisation. PUT /settings
// and PUT /organization each carry several operations of tests/operations, one per field sent.
import type { Profile } from '../../shared/member.ts';
import { api } from '../api.ts';

export const readMe = (): Promise<Profile> => api<Profile>('GET', '/me');
export const chooseLanguage = (language: string): Promise<unknown> => api('PUT', '/settings', { language });
/** SetOwnName and SetSignature. */
export const changeOwnSettings = (settings: { name: string; signature: string }): Promise<unknown> => api('PUT', '/settings', settings);

/** RenameOrganization, ChooseWriting, SetOrganizationModel, and SetOrganizationKey when a key is given: one per field sent. */
export const changeOrganizationSettings = (settings: Record<string, unknown>): Promise<unknown> => api('PUT', '/organization', settings);
export const setOrganizationKey = (openrouterKey: string): Promise<unknown> => api('PUT', '/organization', { openrouterKey });
export const removeOrganizationKey = (): Promise<unknown> => api('PUT', '/organization', { openrouterKey: '' });
