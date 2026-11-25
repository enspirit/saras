// Routes: what an administrator asks the assistant. The operations are in domain/advice.
import { proposeConfiguration } from '../../domain/advice/propose-configuration.ts';
import { actorOf } from './route.ts';
import type { Handle, Route } from './route.ts';

const configuration: Handle = async ({ world }, req, res) => void res.json(await proposeConfiguration(world, actorOf(req), req.body));

export const ADVICE: Route[] = [{ method: 'post', path: '/assistant/configuration', handle: configuration, for: 'administrators' }];
