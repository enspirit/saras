// Emails as the server keeps them: the boxes they stand in, and one email in full.
import type { Box, EmailWithItsReply, EmailsOfBox, EmailStatus, Selection, SelectionDone } from '../../shared/email.ts';
import { api } from '../api.ts';

/** A box, or every box, as searched. */
export const readBox = (box: Box | 'all', search = ''): Promise<EmailsOfBox> => api<EmailsOfBox>('GET', `/emails?box=${box}${search ? `&search=${encodeURIComponent(search)}` : ''}`);

/** CorrectSortingOfSelection: which emails travel in the body, ticked or as a view, never in the address. */
export const correctSelection = (selection: Selection, status: EmailStatus): Promise<SelectionDone> => api<SelectionDone>('POST', '/emails/selection/status', { selection, status });

/** SetAttributeOfSelection; `value` null takes the value away. */
export const setOnSelection = (selection: Selection, key: string, value: string | null): Promise<SelectionDone> =>
  api<SelectionDone>('POST', `/emails/selection/attributes/${encodeURIComponent(key)}`, { selection, value });
export const readEmail = (id: number): Promise<EmailWithItsReply> => api<EmailWithItsReply>('GET', `/emails/${id}`);
