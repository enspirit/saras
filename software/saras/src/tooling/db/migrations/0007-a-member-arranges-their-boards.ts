// The order a member gave to the boards of their menu: the numbers of the boards, first to
// last, kept with the member. Empty until they arrange them: boards then come as they always
// did. The version before this one neither reads nor writes the column.
import type { Migration } from '../migrations.ts';

const sql = `
ALTER TABLE users ADD COLUMN board_order_json TEXT NOT NULL DEFAULT '[]';
`;

export const aMemberArrangesTheirBoards: Migration = { id: '0007-a-member-arranges-their-boards', sql };
