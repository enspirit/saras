// Pure: the way an organisation works — who sorts what is fetched, when proposals are
// written, and where they wait. Sending is always a member's, whichever the way.
import type { Automation, OrganizationRow } from '../model/organization.ts';
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import type { TriageStrategy } from '../sorting/strategies.ts';

/**
 * The four ways, each one adding to the one before:
 *   manual   every fetched email is to handle; the AI writes when a member asks
 *   sort     the AI sorts what is fetched
 *   draft    and a proposal is written at fetch, to review in saras
 *   mailbox  and each proposal is filed in the drafts of the mailbox
 */
export const WAYS = {
  manual: { sorting: 'none', proposals: 'none' },
  sort: { sorting: 'ai', proposals: 'none' },
  draft: { sorting: 'ai', proposals: 'draft' },
  mailbox: { sorting: 'ai', proposals: 'mailbox' },
} as const satisfies Record<string, { sorting: TriageStrategy; proposals: Automation }>;

export type WayOfWorking = keyof typeof WAYS;

/** ReqPre of ChooseWayOfWorking: one of the four. */
export const wayGiven = (value: unknown): Verdict<WayOfWorking> =>
  typeof value === 'string' && Object.hasOwn(WAYS, value) ? accept(value as WayOfWorking) : refuse('invalid', 'organization.invalidWay');

/** The way an organisation is in, from how it is kept. */
export const wayOf = ({ triage_strategy, automation }: Pick<OrganizationRow, 'triage_strategy' | 'automation'>): WayOfWorking =>
  automation === 'mailbox' ? 'mailbox' : automation === 'draft' ? 'draft' : triage_strategy === 'ai' ? 'sort' : 'manual';
