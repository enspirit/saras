// Nothing is kept of the AI's sorting. Migration 0003 left two things in the schema for a
// server of the version before: the way of sorting of an organisation, and the status of an
// email that waits to be sorted. No installation runs such a server, so both go now rather
// than in a later release, and a server of that version does not work on the result:
//   - an email that waits to be sorted is to handle, as nobody's decision: none should be
//     left since 0003, and the status could not go while one was;
//   - 'pending' is no longer a status an email may have;
//   - `organizations.triage_strategy` is gone.
import type { Migration } from '../migrations.ts';

const sql = `
UPDATE emails SET status = 'needs_reply', triage_source = 'none', triage_reason = '' WHERE status = 'pending';
ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_status_check;
ALTER TABLE emails ADD CONSTRAINT emails_status_check CHECK (status IN ('needs_reply','no_reply','ignored','sent'));
ALTER TABLE organizations DROP COLUMN triage_strategy;
`;

export const nothingKeptOfTheAiSorting: Migration = { id: '0004-nothing-kept-of-the-ai-sorting', sql };
