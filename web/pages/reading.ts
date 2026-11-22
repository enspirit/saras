// Reading an email: its header, the decisions about it, its text, and under it the reply
// that was sent or the place to write one.

import { problemText } from '../api.ts';
import type { EmailDetail } from '../api/emails.ts';
import type { Prompt } from '../api/prompts.ts';
import type { SentReply } from '../api/replying.ts';
import { ignoreEmail, markNoReplyNeeded, moveBackToHandle } from '../api/sorting.ts';
import { t } from '../i18n.ts';
import { fmtFull, fmtWhen } from '../i18n/dates.ts';
import { ActionButton, toast } from './actions.ts';
import type { Box } from './boxes.ts';
import { called } from './people.ts';
import { replyArea } from './replying.ts';
import { me } from '../session.ts';
import { Badge } from '../ui/atoms/badge.ts';
import { Button } from '../ui/atoms/button.ts';
import { Notice } from '../ui/atoms/notice.ts';
import { Prose, RichText, Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Block } from '../ui/molecules/field.ts';
import { Message } from '../ui/molecules/message.ts';
import { Panel } from '../ui/molecules/panel.ts';
import { Reading, ReadingHeader } from '../ui/organisms/reading.ts';
import { ClosedDock } from '../ui/organisms/reply-dock.ts';

/** After a decision about the email: says so, and goes back to the list. */
type Done = (message: string) => void;

/** Who sorted the email, as a badge label. */
function triageSourceLabel(source: EmailDetail['triageSource']): string {
  if (source === 'ai') return t('reading.triage.ai');
  if (source === 'rule') return t('reading.triage.rule');
  if (source === 'user') return t('reading.triage.user');
  return t('reading.triage.unknown');
}

const isWaiting = (email: EmailDetail): boolean => email.status === 'pending' || email.status === 'needs_reply';
/** The reply this email got, once it has one. */
const replyOf = (email: EmailDetail): SentReply | null => (email.status === 'sent' ? email.reply : null);

const deciding = (decide: (emailId: number) => Promise<unknown>, email: EmailDetail, message: string, done: Done) => async (): Promise<void> => {
  await decide(email.id);
  done(message);
};

/** Decisions about the email itself: they sit with the email, not with the reply. */
function decisions(email: EmailDetail, done: Done): Child {
  if (isWaiting(email)) {
    return [
      ActionButton(t('composer.noReplyNeeded'), '…', deciding(markNoReplyNeeded, email, t('composer.markedNoReply'), done), { variant: 'ghost', size: 'small', icon: 'mail-check' }),
      ActionButton(t('composer.ignore'), '…', deciding(ignoreEmail, email, t('composer.ignored'), done), { variant: 'ghost', size: 'small', icon: 'archive' }),
    ];
  }
  return !replyOf(email) && ActionButton(t('composer.restore'), '…', deciding(moveBackToHandle, email, t('composer.restored'), done), { size: 'small', icon: 'undo' });
}

/** The verdict line: who sorted the email, and why. */
function verdict(email: EmailDetail): Child {
  const pending = email.status === 'pending';
  return (email.triageReason || pending) && [
    pending ? Badge(t('mailbox.untriaged'), 'neutral') : Badge(triageSourceLabel(email.triageSource), 'neutral'),
    pending ? t('reading.pendingTriage') : email.triageReasonCode ? problemText({ code: email.triageReasonCode, params: {}, message: email.triageReason }) : email.triageReason,
  ];
}

function emailHeader(email: EmailDetail, done: Done): HTMLElement {
  const names = (list: { name: string; address: string }[]): string => list.map((a) => a.name || a.address).join(', ');
  return ReadingHeader({
    subject: email.subject || t('mailbox.noSubject'),
    actions: decisions(email, done),
    sender: { name: email.fromName || email.fromAddr, address: email.fromName ? email.fromAddr : undefined },
    to: email.cc.length ? t('reading.toCc', { to: names(email.to) || email.account, cc: names(email.cc) }) : t('reading.to', { to: names(email.to) || email.account }),
    attachments: email.attachments.map((a) => a.name || a.type),
    date: fmtWhen(email.date),
    dateTitle: fmtFull(email.date),
    triage: verdict(email),
  });
}

/** The reply that was sent or filed as a draft: by whom, to whom, and whether the proposal was changed. */
function sentReply(r: SentReply): Child {
  const draft = r.mode === 'draft';
  const author = r.by && r.by !== me().email ? called(r.byName, r.by) : null;
  const facts: [string, Child][] = [[t('composer.to'), r.to.join(', ')]];
  if (r.cc.length) facts.push([t('composer.cc'), r.cc.join(', ')]);
  if (r.changeReason) facts.push([t('reply.why'), r.changeReason]);
  return Panel({
    icon: 'check',
    title: draft ? t('reply.draftTitle') : t('reply.sentTitle'),
    meta: [author && `${t('reply.by', { user: author })} · `, fmtWhen(r.sentAt)],
    // An edited proposal is a fact, not a problem.
    badges: [Badge(r.wasEdited ? t('reply.edited') : t('reply.unedited'), 'neutral')],
    facts,
  },
    draft && Block(Notice('info', t('reply.draftNotice'))),
    Message(r.finalHtml ? RichText(r.finalHtml) : Prose(r.finalText || t('reply.textErased'))),
  );
}

/** Set aside: no reply is expected, so the reply area opens only when asked for. */
function closedReplyArea(email: EmailDetail, prompts: Prompt[], done: Done): HTMLElement {
  const closed: HTMLElement = ClosedDock(
    email.status === 'ignored' ? t('composer.closedIgnored') : t('composer.closedNone'),
    Button(t('composer.replyAnyway'), { size: 'small', icon: 'reply', onClick: () => closed.replaceWith(replyArea(email, prompts, done)) }),
  );
  return closed;
}

export function emailDetail(email: EmailDetail, prompts: Prompt[], box: Box): Child {
  const done: Done = (message) => {
    toast(message);
    location.hash = `#/${box.path}`;
  };
  const header = emailHeader(email, done);
  const original = email.bodyText ? Message(Prose(email.bodyText)) : Text({ muted: true }, t('reading.erased'));
  const sent = replyOf(email);
  if (sent) return Reading({ header }, original, sentReply(sent));
  if (isWaiting(email)) return Reading({ header, dock: replyArea(email, prompts, done) }, original);
  return Reading({ header, dock: closedReplyArea(email, prompts, done) }, original);
}
