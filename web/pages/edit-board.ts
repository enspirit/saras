// Making a board, or changing one: its name, who sees it, and the filter on the attributes of
// emails that says which it shows.

import { PRIORITIES } from '../../shared/board.ts';
import type { Board, BoardFilter, BoardGiven } from '../../shared/board.ts';
import type { Box, Priority } from '../../shared/email.ts';
import type { Mailbox } from '../../shared/mailbox.ts';
import { createBoard, deleteBoard, editBoard, readBoards } from '../api/boards.ts';
import { readMailboxes } from '../api/mailboxes.ts';
import { t } from '../i18n.ts';
import { ActionButton, confirmAction, guard, SubmitForm, toast } from './actions.ts';
import { boardHref } from './board.ts';
import { BOXES_ON_SCREEN } from './boxes.ts';
import { shell } from './shell.ts';
import { isAdmin, refreshBoards } from '../session.ts';
import { Button, ButtonLink } from '../ui/atoms/button.ts';
import { Checkbox, Input, Select } from '../ui/atoms/input.ts';
import { Text } from '../ui/atoms/text.ts';
import { Card, CardSection } from '../ui/molecules/card.ts';
import { CheckGroup } from '../ui/molecules/check-group.ts';
import type { CheckGroupHandle } from '../ui/molecules/check-group.ts';
import { Block, CheckField, Field } from '../ui/molecules/field.ts';
import { Actions, FormRow } from '../ui/molecules/form.ts';
import { PageHeader } from '../ui/molecules/page-header.ts';
import { Page } from '../ui/organisms/page.ts';

const PRIORITY_LABEL: Record<Priority, string> = { high: 'boards.priorityHigh', normal: 'boards.priorityNormal', low: 'boards.priorityLow' };
/** How recent: any time, or within so many days. */
const RECENT = [0, 1, 7, 30, 90];
const ATTACHMENT = { any: 'boards.attachmentAny', with: 'boards.attachmentWith', without: 'boards.attachmentWithout' };

interface BoardFields {
  name: HTMLInputElement;
  shared: HTMLInputElement;
  mailbox: CheckGroupHandle;
  box: CheckGroupHandle;
  priority: CheckGroupHandle;
  received: HTMLSelectElement;
  from: HTMLInputElement;
  keywords: HTMLInputElement;
  attachment: HTMLSelectElement;
}

/** The attributes chosen among a few values: none ticked means any. */
const choiceFields = (filter: BoardFilter, mailboxes: Mailbox[]) => ({
  mailbox: CheckGroup({ legend: t('boards.mailbox'), name: 'mailbox', options: mailboxes.map((m) => ({ value: String(m.id), label: m.email, checked: filter.mailbox?.includes(m.id) })) }),
  box: CheckGroup({ legend: t('boards.box'), name: 'box', options: BOXES_ON_SCREEN.map((b) => ({ value: b.id, label: t(b.label), checked: filter.box?.includes(b.id) })) }),
  priority: CheckGroup({ legend: t('boards.priority'), name: 'priority', options: PRIORITIES.map((p) => ({ value: p, label: t(PRIORITY_LABEL[p]), checked: filter.priority?.includes(p) })), hint: t('boards.anyWhenNone') }),
});

const attachmentChoice = (filter: BoardFilter): keyof typeof ATTACHMENT => (filter.attachment === undefined ? 'any' : filter.attachment ? 'with' : 'without');

function boardFields(board: Board | null, mailboxes: Mailbox[]): BoardFields {
  const filter = board?.filter ?? {};
  return {
    name: Input({ required: true, maxLength: 80, value: board?.name ?? '' }),
    shared: Checkbox({ checked: board?.shared ?? false }),
    ...choiceFields(filter, mailboxes),
    received: Select(RECENT.map((days) => ({ value: days, label: days ? t('boards.receivedWithin', { days }) : t('boards.receivedAny'), selected: (filter.received ?? 0) === days }))),
    from: Input({ value: filter.from ?? '', placeholder: t('boards.fromPlaceholder') }),
    keywords: Input({ value: filter.keywords ?? '', placeholder: t('boards.keywordsPlaceholder') }),
    attachment: Select(Object.entries(ATTACHMENT).map(([value, label]) => ({ value, label: t(label), selected: attachmentChoice(filter) === value }))),
  };
}

/** What the form says, as the server takes it: only the conditions that say something. */
const written = (f: BoardFields): BoardGiven => ({
  name: f.name.value,
  shared: f.shared.checked,
  filter: {
    mailbox: f.mailbox.values().map(Number),
    box: f.box.values() as Box[],
    priority: f.priority.values() as Priority[],
    received: Number(f.received.value) || undefined,
    from: f.from.value,
    keywords: f.keywords.value,
    attachment: f.attachment.value === 'any' ? undefined : f.attachment.value === 'with',
  },
});

/** The filter: one control per attribute of an email. */
const filterSection = (f: BoardFields): HTMLDivElement =>
  CardSection(t('boards.filterTitle'),
    Block(Text({ muted: true, small: true }, t('boards.filterIntro'))),
    f.mailbox.element,
    f.box.element,
    f.priority.element,
    FormRow(Field(t('boards.received'), f.received), Field(t('boards.attachment'), f.attachment)),
    Field(t('boards.from'), f.from),
    Field(t('boards.keywords'), f.keywords, { hint: t('boards.keywordsHint') }),
  );

/** DeleteBoard, once confirmed: the emails it showed stay where they are. */
const deleteButton = (board: Board): HTMLButtonElement => ActionButton(t('boards.delete'), '…', async () => {
  if (!(await confirmAction(t('boards.confirmDelete', { name: board.name }), t('boards.delete')))) return;
  await deleteBoard(board.id);
  await refreshBoards();
  location.hash = '#/inbox';
}, { variant: 'danger' });

/** CreateBoard or EditBoard, then on to the board. */
function boardForm(board: Board | null, f: BoardFields): HTMLFormElement {
  const save = Button(board ? t('common.save') : t('boards.create'), { variant: 'primary', type: 'submit' });
  return SubmitForm(save, '…', async () => {
    const saved = await (board ? editBoard(board.id, written(f)) : createBoard(written(f)));
    toast(t('boards.saved'));
    location.hash = boardHref(saved.id);
  },
    Field(t('boards.name'), f.name),
    isAdmin() && CheckField(t('boards.shared'), f.shared),
    filterSection(f),
    Actions(save, ButtonLink(t('common.cancel'), { href: board ? boardHref(board.id) : '#/inbox' }), board && deleteButton(board)),
  );
}

/** The form for a new board, or with `boardId` for one the member manages. */
export const editBoardPage = guard(async (boardId: number | null) => {
  const [boards, mailboxes] = await Promise.all([readBoards(), readMailboxes()]);
  const board = boards.find((b) => b.id === boardId && b.canManage) ?? null;
  const fields = boardFields(board, mailboxes);
  shell(Page(
    PageHeader({ title: board ? t('boards.editTitle', { name: board.name }) : t('boards.newTitle'), intro: t('boards.intro') }),
    Card({ form: true }, boardForm(board, fields)),
  ));
  fields.name.focus();
});
