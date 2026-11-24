// A board: the emails its filter keeps, shown as a box is, with the way to change it.

import { readBoard } from '../api/boards.ts';
import { readMailboxes } from '../api/mailboxes.ts';
import { readPrompts } from '../api/prompts.ts';
import { t } from '../i18n.ts';
import { guard } from './actions.ts';
import { showEmails } from './emails.ts';
import { refreshBoards } from '../session.ts';
import { Button } from '../ui/atoms/button.ts';

/** The address of a board, and of one of its emails open beside the list. */
export const boardHref = (boardId: number): string => `#/boards/${boardId}`;
/** The address of a board as searched, and of one of its emails open beside the list. */
const listHref = (boardId: number, search: string, emailId?: number): string => {
  const query = new URLSearchParams({ ...(emailId ? { email: String(emailId) } : {}), ...(search ? { search } : {}) }).toString();
  return `${boardHref(boardId)}${query ? `?${query}` : ''}`;
};

const editButton = (boardId: number): HTMLButtonElement =>
  Button(t('boards.edit'), { variant: 'ghost', icon: 'pencil', iconOnly: true, title: t('boards.edit'), onClick: () => (location.hash = `#/boards/edit/${boardId}`) });

export const boardPage = guard(async (boardId: number, selectedId: number | null, search: string) => {
  const [{ board, emails }, prompts, mailboxes] = await Promise.all([readBoard(boardId, search), readPrompts(), readMailboxes(), refreshBoards()]);
  await showEmails({
    title: board.name,
    icon: 'list',
    view: { board: board.id, search },
    emails,
    total: board.count,
    listHref: (text) => listHref(board.id, text),
    hrefOf: (id, text) => listHref(board.id, text, id),
    load: async (text) => (await readBoard(board.id, text)).emails,
    emptyText: t('boards.empty'),
    actions: board.canManage && editButton(board.id),
    selectedId,
  }, prompts, mailboxes);
});
