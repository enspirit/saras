// A sample email as a mail server holds it: its headers and its body, as mail carries them.
import type { SampleEmail } from './emails.ts';

/** The address the mailbox answers to. */
export const ADDRESS = 'me@corp.example';

export interface Message {
  raw: string;
  internaldate: Date;
  flags: string[];
}

const received = ({ hoursAgo }: SampleEmail): Date => new Date(Date.now() - hoursAgo * 3_600_000);

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);

/** A header value as mail carries it: as it is when plain, encoded when it has accents or other signs. */
const header = (value: string): string => (/^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=`);

/** A text as mail carries it whatever its letters: encoded, in lines of a fixed length. */
const encoded = (text: string): string[] => ['Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', ...(Buffer.from(text.replaceAll('\n', '\r\n')).toString('base64').match(/.{1,76}/g) ?? [])];

/** The text of an email alone, or with the PDF it carries. */
function bodyOf({ text, pdf }: SampleEmail): string[] {
  if (!pdf) return encoded(text);
  return [
    'Content-Type: multipart/mixed; boundary="sample"', '',
    '--sample', ...encoded(text),
    '--sample', `Content-Type: application/pdf; name="${pdf}"`, `Content-Disposition: attachment; filename="${pdf}"`, 'Content-Transfer-Encoding: base64', '', 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCg==',
    '--sample--',
  ];
}

/** A sample email as the mail server holds it. */
export const message = (email: SampleEmail, index: number): Message => ({
  raw: [
    `From: ${header(email.from)} <${email.address}>`,
    `To: ${ADDRESS}`,
    `Subject: ${header(email.subject)}`,
    `Message-ID: <${index}-${slug(email.subject)}@${email.address.split('@')[1]}>`,
    `Date: ${received(email).toUTCString()}`,
    'MIME-Version: 1.0',
    ...(email.headers ?? []),
    ...bodyOf(email),
  ].join('\r\n'),
  internaldate: received(email),
  flags: email.read ? ['\\Seen'] : [],
});
