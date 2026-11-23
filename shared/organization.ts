// An organisation: a team's private space, and what it has the AI do before a member replies.

/**
 * An email goes through two steps before a member replies: it is sorted, then a reply is
 * written. The organisation chooses what the AI does at each.
 *
 * Sorting — who says whether a fetched email needs a reply:
 *   none  nobody: every email of the watched folder is to handle
 *   ai    the AI: it sets aside what needs no reply, and suggests a prompt
 */
export const SORTING = ['none', 'ai'] as const;
export type Sorting = (typeof SORTING)[number];

/**
 * Writing — when a proposal is written for an email to handle:
 *   none     on demand: when a member asks
 *   draft    at fetch: it waits in saras, to review
 *   mailbox  at fetch, and it is filed in the drafts of the mailbox
 */
export const WRITING = ['none', 'draft', 'mailbox'] as const;
export type Writing = (typeof WRITING)[number];

/** The organisation as one of its members sees it. Its model and key are told to administrators only. */
export interface Organization {
  name: string;
  sorting: Sorting;
  writing: Writing;
  /** Whether plainly automated mail is set aside by rule before anything else. */
  skipAutomated: boolean;
  model?: string;
  hasKey?: boolean;
}
