// Emails as the server keeps them: the boxes they stand in, and one email in full.
import type { Box, EmailWithItsReply, EmailsOfBox } from '../../shared/email.ts';
import { api } from '../api.ts';

export const readBox = (box: Box): Promise<EmailsOfBox> => api<EmailsOfBox>('GET', `/emails?box=${box}`);
export const readEmail = (id: number): Promise<EmailWithItsReply> => api<EmailWithItsReply>('GET', `/emails/${id}`);
