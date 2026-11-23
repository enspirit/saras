// An organisation, and how it has proposals prepared.
/** The tenant: who signs up creates one and administers it; everything else lives inside it. */
/** 'none': proposals on demand. 'draft': one is prepared at fetch, to review here. 'mailbox': it is also filed in the mailbox's Drafts folder. Nothing is ever sent. */
export type Automation = 'none' | 'draft' | 'mailbox';

export const AUTOMATIONS: readonly Automation[] = ['none', 'draft', 'mailbox'];

export interface OrganizationRow {
  id: number;
  name: string;
  /** Name of the triage strategy its mailboxes go through ('none', 'ai'…). */
  triage_strategy: string;
  /** Set plainly automated mail aside before the triage gate. */
  skip_automated: boolean;
  /** What is prepared at fetch for an email that needs a reply: nothing, a proposal kept here, or one filed in the mailbox's drafts. */
  automation: Automation;
  /** The organisation's own OpenRouter key, sealed by the vault. */
  openrouter_key_enc: string | null;
  model: string | null;
  created_at: Date;
}
