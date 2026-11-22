// How a refusal is told to the interface: a status, and a message code it can translate.
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Refusal } from '../../domain/refusal.ts';
import type { RefusalKind } from '../../domain/refusal.ts';
import { LlmError } from '../llm/openrouter.ts';
import { problem } from '../messages.ts';
import type { MessageCode, Problem } from '../messages.ts';

/** The status that says each kind of refusal. */
const STATUS: Record<RefusalKind, number> = { invalid: 400, unauthenticated: 401, forbidden: 403, notFound: 404, conflict: 409, gone: 410, tooMany: 429, upstream: 502 };

/** A refusal that is HTTP's own, not the domain's: it comes with its status. */
export class HttpError extends Error {
  status: number;
  problem: Problem;

  constructor(status: number, code: MessageCode) {
    const described = problem(code);
    super(described.message);
    this.status = status;
    this.problem = described;
  }
}

type Thrown = Error & { status?: number; statusCode?: number };
const isKnown = (err: Thrown): err is HttpError | LlmError | Refusal => err instanceof HttpError || err instanceof LlmError || err instanceof Refusal;

function statusOf(err: Thrown): number {
  if (err instanceof LlmError) return 502;
  if (err instanceof Refusal) return STATUS[err.kind];
  return err.status || err.statusCode || 500;
}

/** Malformed requests refused by the framework (4xx) keep its own message, without a code. */
function bodyOf(err: Thrown, status: number): object {
  const described = isKnown(err) ? err.problem : status >= 500 ? problem('error.internal') : null;
  return described ? { error: described.message, code: described.code, params: described.params } : { error: err.message };
}

export const unknownRoute: RequestHandler = (_req, _res, next) => next(new Refusal('notFound', 'request.unknownRoute'));

export const tellRefusal: ErrorRequestHandler = (err: Thrown, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = statusOf(err);
  // Only the message is logged, never request bodies: they contain mail content.
  if (!isKnown(err) && status >= 500) console.error(`${req.method} ${req.path}: ${err.message}`);
  res.status(status).json(bodyOf(err, status));
};
