// Boards: named views of emails. One function per operation of tests/operations, and what they show.
import type { Board, BoardFilter, BoardGiven, EmailsOfBoard, FilterTried } from '../../shared/board.ts';
import { api } from '../api.ts';

export const readBoards = (): Promise<Board[]> => api<Board[]>('GET', '/boards');
/** A board with the emails it shows. */
export const readBoard = (id: number, search = ''): Promise<EmailsOfBoard> => api<EmailsOfBoard>('GET', `/boards/${id}/emails${search ? `?search=${encodeURIComponent(search)}` : ''}`);
/** What a filter would show, before any board keeps it. */
export const tryFilter = (filter: BoardFilter): Promise<FilterTried> => api<FilterTried>('POST', '/boards/try', { filter });
export const createBoard = (board: BoardGiven): Promise<Board> => api<Board>('POST', '/boards', board);
export const editBoard = (id: number, board: BoardGiven): Promise<Board> => api<Board>('PUT', `/boards/${id}`, board);
export const deleteBoard = (id: number): Promise<unknown> => api('DELETE', `/boards/${id}`);
/** ArrangeBoards: the boards of the member's menu, in the order they want them. */
export const arrangeBoards = (boards: number[]): Promise<unknown> => api('PUT', '/boards/order', { boards });
