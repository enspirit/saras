// Sorting: the decisions a member takes about an email, and sorting again what no strategy sorted.
// One function per operation of doc/2-operations.md.
import { api } from '../api.ts';

export const markNoReplyNeeded = (id: number): Promise<unknown> => api('POST', `/emails/${id}/status`, { status: 'no_reply' });
export const ignoreEmail = (id: number): Promise<unknown> => api('POST', `/emails/${id}/status`, { status: 'ignored' });
export const moveBackToHandle = (id: number): Promise<unknown> => api('POST', `/emails/${id}/status`, { status: 'needs_reply' });
export const sortAgainUnsorted = (): Promise<unknown> => api('POST', '/organization/sort-again');
