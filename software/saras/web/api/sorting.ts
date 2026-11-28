// Sorting: the decisions a member takes about an email.
// One function per operation of tests/operations.
import { api } from '../api.ts';

export const markNoReplyNeeded = (id: number): Promise<unknown> => api('POST', `/emails/${id}/status`, { status: 'no_reply' });
export const ignoreEmail = (id: number): Promise<unknown> => api('POST', `/emails/${id}/status`, { status: 'ignored' });
export const moveBackToHandle = (id: number): Promise<unknown> => api('POST', `/emails/${id}/status`, { status: 'needs_reply' });
