// Routes: the prompts of an organisation, shared by its members and maintained by its
// administrators. The operations are in domain/prompts; each checks for itself who asks.
import { correctionsOn, promptsFor, readyMadePromptsLeft } from '../../domain/observations/prompts.ts';
import { createPrompt } from '../../domain/prompts/create-prompt.ts';
import { deletePrompt } from '../../domain/prompts/delete-prompt.ts';
import { editPrompt } from '../../domain/prompts/edit-prompt.ts';
import { actorOf, done } from './route.ts';
import type { Handle, Route } from './route.ts';

const list: Handle = async ({ world }, req, res) => void res.json(await promptsFor(world.db, actorOf(req)));

const readyMade: Handle = async ({ world }, req, res) => void res.json(await readyMadePromptsLeft(world.db, actorOf(req)));

const create: Handle = async ({ world }, req, res) => void res.status(201).json(await createPrompt(world, actorOf(req), req.body));

const edit: Handle = async ({ world }, req, res) => {
  await editPrompt(world, actorOf(req), req.params.id, req.body);
  done(res);
};

const remove: Handle = async ({ world }, req, res) => {
  await deletePrompt(world, actorOf(req), req.params.id);
  done(res);
};

const corrections: Handle = async ({ world }, req, res) => void res.json(await correctionsOn(world.db, actorOf(req), req.params.id));

export const PROMPTS: Route[] = [
  { method: 'get', path: '/prompts', handle: list },
  { method: 'get', path: '/prompts/templates', handle: readyMade, for: 'administrators' },
  { method: 'post', path: '/prompts', handle: create },
  { method: 'put', path: '/prompts/:id', handle: edit },
  { method: 'delete', path: '/prompts/:id', handle: remove },
  { method: 'get', path: '/prompts/:id/corrections', handle: corrections, for: 'administrators' },
];
