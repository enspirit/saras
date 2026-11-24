// The AI no longer sorts emails: rules do, and members. What it left behind is put right, so
// that nothing is lost from sight and the version before this one, while it still runs, sorts
// nothing with it either:
//   - no organisation has the AI sort: a server of the version before then asks it nothing,
//     and leaves no email waiting, which this version would not show;
//   - an email that waited to be sorted (the AI had failed, or said nothing of it) is to
//     handle, as nobody's decision;
//   - an attribute the AI had a say in is decided by its rule alone, or by nobody.
// `organizations.triage_strategy` and the status 'pending' of an email remain, for the version
// before; this one reads neither.
import type { Migration } from '../migrations.ts';

const sql = `
UPDATE organizations SET triage_strategy = 'none' WHERE triage_strategy <> 'none';
UPDATE emails SET status = 'needs_reply', triage_source = 'none', triage_reason = '' WHERE status = 'pending';
UPDATE attributes SET decided_by = 'elo' WHERE decided_by = 'eloAi';
UPDATE attributes SET decided_by = 'nobody' WHERE decided_by = 'ai';
`;

export const noSortingByTheAi: Migration = { id: '0003-no-sorting-by-the-ai', sql };
