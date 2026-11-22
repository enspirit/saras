// Pure: the way an organisation works — who sorts what is fetched, when proposals are
// written, and where they wait. Sending is always a member's, whichever the way.
import { WAYS_OF_WORKING } from '../../../shared/organization.ts';
import type { WayOfWorking } from '../../../shared/organization.ts';
import type { Automation, OrganizationRow } from '../model/organization.ts';
import { accept, refuse } from '../refusal.ts';
import type { Verdict } from '../refusal.ts';
import type { TriageStrategy } from '../sorting/strategies.ts';

/** What each way means for a fetch: who sorts, and whether proposals are written and filed. */
export const WAYS: Record<WayOfWorking, { sorting: TriageStrategy; proposals: Automation }> = {
  manual: { sorting: 'none', proposals: 'none' },
  sort: { sorting: 'ai', proposals: 'none' },
  draft: { sorting: 'ai', proposals: 'draft' },
  mailbox: { sorting: 'ai', proposals: 'mailbox' },
};

export type { WayOfWorking } from '../../../shared/organization.ts';

/** ReqPre of ChooseWayOfWorking: one of the four. */
export const wayGiven = (value: unknown): Verdict<WayOfWorking> =>
  WAYS_OF_WORKING.includes(value as WayOfWorking) ? accept(value as WayOfWorking) : refuse('invalid', 'organization.invalidWay');

/** The way an organisation is in, from how it is kept. */
export const wayOf = ({ triage_strategy, automation }: Pick<OrganizationRow, 'triage_strategy' | 'automation'>): WayOfWorking =>
  automation === 'mailbox' ? 'mailbox' : automation === 'draft' ? 'draft' : triage_strategy === 'ai' ? 'sort' : 'manual';
