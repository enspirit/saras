// What a route is: an operation of the specification, or a method and a path under /api; who
// may call it, and what it does with what it is given.
import type { Request, Response } from 'express';
import type { Actor, World } from '../../domain/world.ts';
import type { Fetch } from '../fetch.ts';

/** What every route is given: the world the operations act in, and how this server reaches other hosts. */
export interface Http {
  world: World;
  fetchImpl: Fetch;
}

/** What a route does. `input` is what the request gives, of the type of the operation's input: checked, and converted to it. */
export type Handle<Input = never> = (http: Http, req: Request, res: Response, input: Input) => Promise<void> | void;

interface Guarded {
  handle: Handle;
  /** Who may call it: anyone, a signed-in member (the default), or an administrator. */
  for?: 'visitors' | 'members' | 'administrators';
}

/** A route of the specification: its entry, and the type of its input, are the operation's there. */
interface Specified extends Guarded {
  operation: string;
}

/** A route the specification does not name yet: nothing checks what it is given. */
interface Unspecified extends Guarded {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
}

export type Route = Specified | Unspecified;

/** The member a request is made by, with their organisation. */
export const actorOf = (req: Request): Actor => ({ member: req.user, organization: req.org });

/** Where a request comes from: what the brake on guessing counts by. */
export const originOf = (req: Request): string => req.ip || '';

/** The usual answer of an operation that returns nothing. */
export const done = (res: Response): void => void res.json({ ok: true });
