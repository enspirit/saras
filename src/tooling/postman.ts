// The server's own outgoing mail: the few messages saras writes itself, such as a link to
// choose a new password. Not the members' mailboxes, which send their replies.
import nodemailer from 'nodemailer';
import type { Config } from './config.ts';

export interface Letter {
  to: string;
  subject: string;
  text: string;
}

export interface Postman {
  /** Whether this server was given a way to send mail. */
  configured: boolean;
  send(letter: Letter): Promise<void>;
}

const unconfigured: Postman = { configured: false, send: async () => {} };

export function createPostman({ smtpUrl, mailFrom }: Pick<Config, 'smtpUrl' | 'mailFrom'>): Postman {
  if (!smtpUrl || !mailFrom) return unconfigured;
  const transport = nodemailer.createTransport(smtpUrl);
  return { configured: true, send: async (letter) => void (await transport.sendMail({ from: mailFrom, ...letter })) };
}
