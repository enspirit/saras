// ErasePastRetention — the backend erases the content of emails older than the retention period.
//
//   DomPre   emails older than the retention period, with content
//   DomPost  their text, their proposals and the text of their replies are erased
//   ReqPost  the email itself stays, sorted as it was, so that it is not fetched again
//            the reasons given for corrections are kept: they are the member's own words
//   ReqTrig  every hour, and when the server starts, when a retention period is set
import { purgeOldContent } from '../../tooling/db.ts';
import type { Reach } from '../world.ts';

export const erasePastRetention = ({ db, config }: Pick<Reach, 'db' | 'config'>): Promise<number> => purgeOldContent(db, config.retentionDays);
