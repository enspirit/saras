// Routes: the boards of a member, and the emails each shows. The operations are in domain/boards.
import { createBoard } from '../../domain/boards/create-board.ts';
import { deleteBoard } from '../../domain/boards/delete-board.ts';
import { editBoard } from '../../domain/boards/edit-board.ts';
import { boardsFor, emailsOfBoard } from '../../domain/observations/boards.ts';
import { actorOf, done } from './route.ts';
import type { Handle, Route } from './route.ts';

const list: Handle = async ({ world }, req, res) => void res.json(await boardsFor(world.db, actorOf(req)));

const emails: Handle = async ({ world }, req, res) => void res.json(await emailsOfBoard(world.db, actorOf(req), req.params.id));

const create: Handle = async ({ world }, req, res) => void res.status(201).json(await createBoard(world, actorOf(req), req.body));

const edit: Handle = async ({ world }, req, res) => void res.json(await editBoard(world, actorOf(req), req.params.id, req.body));

const remove: Handle = async ({ world }, req, res) => {
  await deleteBoard(world, actorOf(req), req.params.id);
  done(res);
};

export const BOARDS: Route[] = [
  { method: 'get', path: '/boards', handle: list },
  { method: 'post', path: '/boards', handle: create },
  { method: 'get', path: '/boards/:id/emails', handle: emails },
  { method: 'put', path: '/boards/:id', handle: edit },
  { method: 'delete', path: '/boards/:id', handle: remove },
];
