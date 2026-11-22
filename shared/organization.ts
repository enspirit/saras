// An organisation: a team's private space, and the way it works.

/**
 * The four ways of working, each one adding to the one before:
 *   manual   every fetched email is to handle; the AI writes when a member asks
 *   sort     the AI sorts what is fetched
 *   draft    and a proposal is written at fetch, to review in saras
 *   mailbox  and each proposal is filed in the drafts of the mailbox
 */
export const WAYS_OF_WORKING = ['manual', 'sort', 'draft', 'mailbox'] as const;
export type WayOfWorking = (typeof WAYS_OF_WORKING)[number];

/** The organisation as one of its members sees it. Its model and key are told to administrators only. */
export interface Organization {
  name: string;
  way: WayOfWorking;
  /** Whether plainly automated mail is set aside by rule before anything else. */
  skipAutomated: boolean;
  model?: string;
  hasKey?: boolean;
}
