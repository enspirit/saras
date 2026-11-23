// ErasePastRetention — the backend erases the content of emails older than the retention period.
//
//   DomPre   emails older than the retention period, with content
//   DomPost  their text, their proposals and the text of their replies are erased
//   ReqPost  the email itself stays, sorted as it was, so that it is not fetched again
//            the reasons given for corrections are kept: they are the member's own words
//   ReqTrig  every hour, and when the server starts, when a retention period is set
import type { Reach } from '../world.ts';

/** The number of emails whose text was erased. */
export async function erasePastRetention({ db, config }: Pick<Reach, 'db' | 'config'>): Promise<number> {
  const { retentionDays } = config;
  if (!retentionDays) return 0;
  const old = `(SELECT id FROM emails WHERE date < now() - make_interval(days => $1))`;
  const days = [Number(retentionDays)];
  await db.run(`DELETE FROM drafts WHERE email_id IN ${old}`, days);
  await db.run(`UPDATE replies SET ai_text = NULL, final_text = '', final_html = '' WHERE email_id IN ${old}`, days);
  return db.run(`UPDATE emails SET body_text = '' WHERE body_text != '' AND date < now() - make_interval(days => $1)`, days);
}
