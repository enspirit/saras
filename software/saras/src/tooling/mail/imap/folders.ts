// The folders of a mailbox reached by its servers, and the new emails of one of them.
import { simpleParser } from 'mailparser';
import type { IncomingEmail } from '../../../domain/model/email.ts';
import type { ImapCredentials, MailFolder, ListQuery, NewEmails } from '../../../domain/model/mailbox.ts';
import { withFolder, withMailbox } from './connection.ts';
import { parsedToEmail } from './message.ts';

/** The inbox first, then the others by name. */
const rank = (path: string): number => (path.toUpperCase() === 'INBOX' ? 0 : 1);

export const listFolders = (cfg: ImapCredentials): Promise<MailFolder[]> =>
  withMailbox(cfg, async (client) => {
    const boxes = (await client.list()).filter((box) => !box.flags.has('\\Noselect'));
    return boxes
      .map((box) => ({ id: box.path, name: rank(box.path) === 0 ? 'Inbox' : box.path }))
      .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
  });

/** The messages of a folder received since a date that we do not know yet: the most recent ones, up to the limit, and how many older ones that leaves. */
export const listNew = (cfg: ImapCredentials, { folder, since, unreadOnly, limit, known }: ListQuery): Promise<NewEmails> =>
  withFolder(cfg, folder, async (client, validity) => {
    const uids = (await client.search(unreadOnly ? { since, seen: false } : { since }, { uid: true })) || [];
    const unknown = uids.filter((uid) => !known.has(`${validity}:${uid}`));
    const fresh = unknown.slice(-limit);
    if (!fresh.length) return { emails: [], toCome: 0 };
    const out: IncomingEmail[] = [];
    for await (const msg of client.fetch(fresh, { uid: true, flags: true, source: true }, { uid: true })) {
      if (!msg.source) continue;
      const parsed = await simpleParser(msg.source);
      out.push(parsedToEmail(parsed, { providerId: `${validity}:${msg.uid}`, answered: Boolean(msg.flags?.has('\\Answered')) }));
    }
    return { emails: out, toCome: unknown.length - fresh.length };
  });
