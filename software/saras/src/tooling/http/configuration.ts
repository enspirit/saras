// Routes: the configuration of an organisation as data. The operation is in domain/configuration.
import { applyConfiguration } from '../../domain/configuration/apply-configuration.ts';
import { checkConfiguration, configurationOf } from '../../domain/observations/configuration.ts';
import { actorOf } from './route.ts';
import type { Handle, Route } from './route.ts';

const read: Handle = async ({ world }, req, res) => void res.json(await configurationOf(world.db, actorOf(req)));

const check: Handle = async ({ world }, req, res) => void res.json(await checkConfiguration(world.db, actorOf(req), req.body));

const apply: Handle = async ({ world }, req, res) => void res.json(await applyConfiguration(world, actorOf(req), req.body));

export const CONFIGURATION: Route[] = [
  { method: 'get', path: '/configuration', handle: read, for: 'administrators' },
  { method: 'post', path: '/configuration/check', handle: check, for: 'administrators' },
  { method: 'put', path: '/configuration', handle: apply, for: 'administrators' },
];
