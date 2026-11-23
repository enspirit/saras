// Routes: the attributes an organisation gives its emails. The operations are in domain/attributes.
import { createAttribute } from '../../domain/attributes/create-attribute.ts';
import { deleteAttribute } from '../../domain/attributes/delete-attribute.ts';
import { editAttribute } from '../../domain/attributes/edit-attribute.ts';
import { setEmailAttribute } from '../../domain/attributes/set-email-attribute.ts';
import { tryRule } from '../../domain/observations/attributes.ts';
import { sortAgainByRule } from '../../domain/sorting/sort-again-by-rule.ts';
import { attributesOf } from '../../domain/state/attributes.ts';
import { actorOf, done } from './route.ts';
import type { Handle, Route } from './route.ts';

const list: Handle = async ({ world }, req, res) => void res.json(await attributesOf(world.db, req.org));

const create: Handle = async ({ world }, req, res) => void res.status(201).json(await createAttribute(world, actorOf(req), req.body));

const edit: Handle = async ({ world }, req, res) => void res.json(await editAttribute(world, actorOf(req), req.params.key, req.body));

const remove: Handle = async ({ world }, req, res) => {
  await deleteAttribute(world, actorOf(req), req.params.key);
  done(res);
};

const tryIt: Handle = async ({ world }, req, res) => void res.json(await tryRule(world.db, actorOf(req), req.body));

const sortAgain: Handle = async ({ world }, req, res) => void res.json(await sortAgainByRule(world, actorOf(req), req.params.key));

const setOnEmail: Handle = async ({ world }, req, res) => {
  await setEmailAttribute(world, actorOf(req), req.params.id, req.params.key, req.body.value);
  done(res);
};

export const ATTRIBUTES: Route[] = [
  { method: 'get', path: '/attributes', handle: list },
  { method: 'post', path: '/attributes', handle: create },
  { method: 'post', path: '/attributes/try', handle: tryIt, for: 'administrators' },
  { method: 'put', path: '/attributes/:key', handle: edit },
  { method: 'delete', path: '/attributes/:key', handle: remove },
  { method: 'post', path: '/attributes/:key/sort-again', handle: sortAgain },
  { method: 'put', path: '/emails/:id/attributes/:key', handle: setOnEmail },
];
