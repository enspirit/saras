// Settings: who is signed in, their own settings, and those of their organisation. PUT /settings
// and PUT /organization each carry several operations of OPERATIONS.md, one per field sent.
import { api } from '../api.ts';
import type { Role } from './access.ts';

/** The ways of working an administrator chooses between, as the tour and the settings name them. */
export const WAYS = ['manual', 'sort', 'draft', 'mailbox'] as const;
export type Way = (typeof WAYS)[number];

/** The organisation of the signed-in user. Its key and model are told to administrators only. */
export interface Organization {
  name: string;
  /** Who sorts what is fetched, when proposals are written, where they wait. */
  way: Way;
  skipAutomated: boolean;
  /** What is prepared at fetch for an email that needs a reply: nothing, a proposal to review here, or one filed in the mailbox's drafts. */
  model?: string;
  hasKey?: boolean;
}

export interface Me {
  email: string;
  /** How the other members see this person; empty until given. */
  name: string;
  organization: Organization;
  role: Role;
  /** The language the server last knew this user to use. */
  language: string;
  signature: string;
  model: string;
  defaultModel: string;
  hasOwnKey: boolean;
  /** An OpenRouter key is available, the user's own or the server's. */
  hasKey: boolean;
  oauth: { google: boolean; microsoft: boolean };
  privacy: Record<string, unknown>;
  retentionDays: number;
}

export const readMe = (): Promise<Me> => api<Me>('GET', '/me');
export const chooseLanguage = (language: string): Promise<unknown> => api('PUT', '/settings', { language });
/** SetOwnName, SetSignature, ChooseOwnModel, and SetOwnKey when a key is given. */
export const changeOwnSettings = (settings: { name: string; model: string; signature: string; openrouterKey?: string }): Promise<unknown> =>
  api('PUT', '/settings', settings);
export const removeOwnKey = (): Promise<unknown> => api('PUT', '/settings', { openrouterKey: '' });

/** RenameOrganization, ChooseWayOfWorking, SetAsideAutomatedFirst, SetOrganizationModel, and SetOrganizationKey when a key is given. */
export const changeOrganizationSettings = (settings: Record<string, unknown>): Promise<unknown> => api('PUT', '/organization', settings);
export const chooseWayOfWorking = (way: string): Promise<unknown> => api('PUT', '/organization', { way });
export const setOrganizationKey = (openrouterKey: string): Promise<unknown> => api('PUT', '/organization', { openrouterKey });
export const removeOrganizationKey = (): Promise<unknown> => api('PUT', '/organization', { openrouterKey: '' });
