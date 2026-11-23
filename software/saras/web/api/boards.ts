// Boards: named views of emails. One function per operation of doc/2-operations.md, and what they show.
import type { Board, BoardGiven, EmailsOfBoard } from '../../shared/board.ts';
import { api } from '../api.ts';

export const readBoards = (): Promise<Board[]> => api<Board[]>('GET', '/boards');
/** A board with the emails it shows. */
export const readBoard = (id: number): Promise<EmailsOfBoard> => api<EmailsOfBoard>('GET', `/boards/${id}/emails`);
export const createBoard = (board: BoardGiven): Promise<Board> => api<Board>('POST', '/boards', board);
export const editBoard = (id: number, board: BoardGiven): Promise<Board> => api<Board>('PUT', `/boards/${id}`, board);
export const deleteBoard = (id: number): Promise<unknown> => api('DELETE', `/boards/${id}`);
