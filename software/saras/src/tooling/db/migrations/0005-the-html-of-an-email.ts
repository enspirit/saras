// The HTML of an email, kept beside its text so that it can be shown as it was written. Empty
// for an email that has none, and for those fetched before: the version before this one
// neither reads nor writes the column, and what it fetches meanwhile is shown as text.
import type { Migration } from '../migrations.ts';

const sql = `
ALTER TABLE emails ADD COLUMN body_html TEXT NOT NULL DEFAULT '';
`;

export const theHtmlOfAnEmail: Migration = { id: '0005-the-html-of-an-email', sql };
