// Making a board, or changing one: its name, who sees it, the conditions that say which emails
// it shows, and beside them what it shows now, before anything is kept.

import type { Attribute } from '../../shared/attribute.ts';
import type { Board, BoardFilter, BoardGiven, FilterTried } from '../../shared/board.ts';
import type { EmailSummary } from '../../shared/email.ts';
import { readAttributes } from '../api/attributes.ts';
import { createBoard, deleteBoard, editBoard, readBoards, tryFilter } from '../api/boards.ts';
import { readMailboxes } from '../api/mailboxes.ts';
import { t } from '../i18n.ts';
import { fmtDate } from '../i18n/dates.ts';
import { ActionButton, confirmAction, guard, SubmitForm, toast } from './actions.ts';
import { chipFor } from './attribute-values.ts';
import { boardConditions } from './board-conditions.ts';
import { boardHref } from './board.ts';
import { shell } from './shell.ts';
import { isAdmin, refreshBoards } from '../session.ts';
import { Button, ButtonLink } from '../ui/atoms/button.ts';
import { Checkbox, Input } from '../ui/atoms/input.ts';
import { Muted, Small, Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { EmailListItem } from '../ui/molecules/email-list-item.ts';
import { CheckField, Field } from '../ui/molecules/field.ts';
import { Actions } from '../ui/molecules/form.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Live, PartTitle, SplitPanel } from '../ui/molecules/split-panel.ts';
import { Page } from '../ui/organisms/page.ts';

/** One email the conditions keep: who, when, what about, and its values for the organisation's attributes. */
const match = (email: EmailSummary, attributes: Attribute[]): HTMLElement => EmailListItem({
  from: email.fromName || email.fromAddr,
  date: fmtDate(email.date),
  subject: email.subject || t('mailbox.noSubject'),
  snippet: '',
  tags: attributes.filter((a) => !a.system).map((a) => chipFor(a, email.attributes[a.key]?.value, true)),
});

/** What the conditions show now: how many emails, and the most recent of them. */
const shown = ({ count, emails }: FilterTried, attributes: Attribute[]): Child => [
  PartTitle(t('boards.matches', { count })),
  Text({ muted: true, small: true }, t('boards.matchesHint')),
  emails.map((email) => match(email, attributes)),
  count > emails.length && Text({ muted: true, small: true }, t('boards.moreMatches', { count: count - emails.length })),
];

/** Beside the conditions, what they show: asked again a moment after each change, the latest answer winning. */
function preview(attributes: Attribute[]): { element: HTMLElement; show(filter: BoardFilter): void } {
  const live = Live(Text({ muted: true, small: true }, t('boards.matchesHint')));
  let asked = 0;
  let timer = 0;
  const ask = async (filter: BoardFilter): Promise<void> => {
    const mine = (asked += 1);
    const tried = await tryFilter(filter).catch(() => null);
    if (tried && mine === asked) live.show(shown(tried, attributes));
  };
  return { element: live.element, show: (filter) => (window.clearTimeout(timer), void (timer = window.setTimeout(() => void ask(filter), 300))) };
}

/** DeleteBoard, once confirmed: the emails it showed stay where they are. */
const deleteButton = (board: Board): HTMLButtonElement => ActionButton(t('boards.delete'), '…', async () => {
  if (!(await confirmAction(t('boards.confirmDelete', { name: board.name }), t('boards.delete')))) return;
  await deleteBoard(board.id);
  await refreshBoards();
  location.hash = '#/inbox';
}, { variant: 'danger' });

/** CreateBoard or EditBoard, then on to the board. */
function boardForm(board: Board | null, name: HTMLInputElement, conditions: HTMLElement, given: () => BoardGiven, shared: HTMLInputElement): HTMLFormElement {
  const save = Button(board ? t('common.save') : t('boards.create'), { variant: 'primary', type: 'submit' });
  return SubmitForm(save, '…', async () => {
    const saved = await (board ? editBoard(board.id, given()) : createBoard(given()));
    toast(t('boards.saved'));
    location.hash = boardHref(saved.id);
  },
    Field(t('boards.name'), name),
    isAdmin() && CheckField(t('boards.shared'), shared),
    PartTitle(t('boards.showsWhere')),
    conditions,
    Actions(save, ButtonLink(t('common.cancel'), { href: board ? boardHref(board.id) : '#/inbox' }), board && deleteButton(board), Muted(Small(t('boards.movesNothing')))),
  );
}

/** The form for a new board, or with `boardId` for one the member manages. */
export const editBoardPage = guard(async (boardId: number | null) => {
  const [boards, attributes, mailboxes] = await Promise.all([readBoards(), readAttributes(), readMailboxes()]);
  const board = boards.find((b) => b.id === boardId && b.canManage) ?? null;
  const beside = preview(attributes);
  const name = Input({ required: true, maxLength: 80, value: board?.name ?? '' });
  const shared = Checkbox({ checked: board?.shared ?? false });
  const conditions = boardConditions(board?.filter ?? {}, attributes, mailboxes, () => beside.show(conditions.filter()));
  const given = (): BoardGiven => ({ name: name.value, shared: shared.checked, filter: conditions.filter() });
  shell(Page(
    PageHeader({ title: board ? t('boards.editTitle', { name: board.name }) : t('boards.newTitle'), intro: t('boards.intro') }),
    SplitPanel(boardForm(board, name, conditions.element, given, shared), beside.element),
  ));
  beside.show(conditions.filter());
  name.focus();
});
