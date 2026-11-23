// Settings: who is signed in, their own settings, and those of their organisation. PUT /settings
// and PUT /organization each carry several operations of OPERATIONS.md, one per field sent.
import type { Profile } from '../../shared/member.ts';
import { api } from '../api.ts';

export const readMe = (): Promise<Profile> => api<Profile>('GET', '/me');
export const chooseLanguage = (language: string): Promise<unknown> => api('PUT', '/settings', { language });
/** SetOwnName, SetSignature, ChooseOwnModel, and SetOwnKey when a key is given. */
export const changeOwnSettings = (settings: { name: string; model: string; signature: string; openrouterKey?: string }): Promise<unknown> =>
  api('PUT', '/settings', settings);
export const removeOwnKey = (): Promise<unknown> => api('PUT', '/settings', { openrouterKey: '' });

/** RenameOrganization, ChooseSorting, ChooseWriting, SetAsideAutomatedFirst, SetOrganizationModel, and SetOrganizationKey when a key is given. */
export const changeOrganizationSettings = (settings: Record<string, unknown>): Promise<unknown> => api('PUT', '/organization', settings);
/** ChooseSorting and ChooseWriting: what the AI does at each of the two steps an email goes through. */
export const chooseSortingAndWriting = (sorting: string, writing: string): Promise<unknown> => api('PUT', '/organization', { sorting, writing });
export const setOrganizationKey = (openrouterKey: string): Promise<unknown> => api('PUT', '/organization', { openrouterKey });
export const removeOrganizationKey = (): Promise<unknown> => api('PUT', '/organization', { openrouterKey: '' });
