// Routes: the boards of a member, and the emails each shows. The operations are in domain/boards;
// what each is given is checked against the type the specification gives it.
import type { BoardFilter, BoardGiven } from '../../../shared/board.ts';
import { arrangeBoards } from '../../domain/boards/arrange-boards.ts';
import { createBoard } from '../../domain/boards/create-board.ts';
import { deleteBoard } from '../../domain/boards/delete-board.ts';
import { editBoard } from '../../domain/boards/edit-board.ts';
import { boardsFor, emailsOfBoard, tryFilter } from '../../domain/observations/boards.ts';
import { actorOf, done } from './route.ts';
import type { Handle, Route } from './route.ts';

type Named = { id: number };

const list: Handle = async ({ world }, req, res) => void res.json(await boardsFor(world.db, actorOf(req)));

const emails: Handle<Named & { search?: string }> = async ({ world }, req, res, { id, search }) => void res.json(await emailsOfBoard(world.db, actorOf(req), id, search));

const tryIt: Handle<{ filter: BoardFilter }> = async ({ world }, req, res, { filter }) => void res.json(await tryFilter(world.db, actorOf(req), filter));

const create: Handle<BoardGiven> = async ({ world }, req, res, board) => void res.status(201).json(await createBoard(world, actorOf(req), board));

const edit: Handle<Named & BoardGiven> = async ({ world }, req, res, { id, ...board }) => void res.json(await editBoard(world, actorOf(req), id, board));

const arrange: Handle<{ boards: number[] }> = async ({ world }, req, res, { boards }) => {
  await arrangeBoards(world, actorOf(req), boards);
  done(res);
};

const remove: Handle<Named> = async ({ world }, req, res, { id }) => {
  await deleteBoard(world, actorOf(req), id);
  done(res);
};

// /boards/try and /boards/order before /boards/:id, which would take them.
export const BOARDS: Route[] = [
  { operation: 'ListBoards', handle: list },
  { operation: 'CreateBoard', handle: create },
  { operation: 'TryBoardFilter', handle: tryIt },
  { operation: 'ReadEmailsOfBoard', handle: emails },
  { operation: 'ArrangeBoards', handle: arrange },
  { operation: 'EditBoard', handle: edit },
  { operation: 'DeleteBoard', handle: remove },
];
