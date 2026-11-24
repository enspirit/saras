// An organisation: a team's private space, and what it has the AI do before a member replies.

/**
 * An email is sorted, then a reply is written. Sorting is never the AI's: rules do it, and
 * members. The organisation chooses when the AI writes.
 *
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
  writing: Writing;
  /** Whether plainly automated mail is set aside by rule before anything else. */
  skipAutomated: boolean;
  model?: string;
  hasKey?: boolean;
}
