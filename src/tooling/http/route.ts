// What a route is: a method, a path under /api, who may call it, and what it does.
import type { Request, Response } from 'express';
import type { Actor, World } from '../../domain/world.ts';
import type { Fetch } from '../../types.ts';

/** What every route is given: the world the operations act in, and how this server reaches other hosts. */
export interface Http {
  world: World;
  fetchImpl: Fetch;
}

export type Handle = (http: Http, req: Request, res: Response) => Promise<void> | void;

export interface Route {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  handle: Handle;
  /** Who may call it: anyone, a signed-in member (the default), or an administrator. */
  for?: 'visitors' | 'members' | 'administrators';
}

/** The member a request is made by, with their organisation. */
export const actorOf = (req: Request): Actor => ({ member: req.user, organization: req.org });

/** Where a request comes from: what the brake on guessing counts by. */
export const originOf = (req: Request): string => req.ip || '';

/** The usual answer of an operation that returns nothing. */
export const done = (res: Response): void => void res.json({ ok: true });
