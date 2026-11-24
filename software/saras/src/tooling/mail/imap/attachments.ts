// A file attached to an email of a mailbox reached by its servers: the message is fetched
// again and read, since nothing of a file is kept but its description.
import { simpleParser } from 'mailparser';
import type { Email } from '../../../domain/model/email.ts';
import type { AttachedFile, ImapCredentials } from '../../../domain/model/mailbox.ts';
import { withFolder } from './connection.ts';

/** Null when the folder was rebuilt since (another UID validity), the message is gone, or it has no such file. */
export const attachment = (cfg: ImapCredentials, { providerId, folder }: Pick<Email, 'providerId' | 'folder'>, index: number): Promise<AttachedFile | null> =>
  withFolder(cfg, folder, async (client, uidValidity) => {
    const [validity, uid] = providerId.split(':');
    if (!uid || validity !== uidValidity) return null;
    const message = await client.fetchOne(uid, { source: true }, { uid: true });
    if (!message || !message.source) return null;
    const file = (await simpleParser(message.source)).attachments[index];
    return file ? { name: file.filename || '', type: file.contentType || 'application/octet-stream', content: file.content } : null;
  });
