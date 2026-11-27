// What an operation is given, checked against the type the specification gives its input
// before the operation sees it. The check is Elo's: a type of the specification is compiled
// once, and what passes is converted to it (a number of a path is an Int). What does not pass
// is refused as invalid: with the code a constraint is labelled with when it is one of the
// server's (`String(s | 'boards.nameRequired': !isBlank(s))`), with `request.invalid` and where
// otherwise. What was given is never told back, nor logged: it may hold anything of a mail.
import { compile } from '@enspirit/elo';
import type { EloFailure } from '@enspirit/elo';
import type { Request } from 'express';
import { DateTime, Duration, Interval } from 'luxon';
import { Refusal } from '../../domain/refusal.ts';
import { MESSAGES } from '../messages.ts';
import type { MessageCode } from '../messages.ts';
import type { Specification } from '../specification.ts';

/** What a request gives, checked and converted to the type of the operation's input; throws its refusal. */
export type Check = (req: Request) => unknown;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** What a request gives, as the specification says it: what it sends (its query, for a read), and the parameters of its path. */
export function givenBy(req: Request): unknown {
  const sent: unknown = req.method === 'GET' ? req.query : (req.body ?? {});
  return isRecord(sent) ? { ...sent, ...req.params } : sent;
}

const isFailure = (error: unknown): error is EloFailure => error instanceof Error && typeof (error as Partial<EloFailure>).kind === 'string';
const isCode = (label: unknown): label is MessageCode => typeof label === 'string' && Object.hasOwn(MESSAGES, label);

/** How a value Elo refused is told: by the code its constraint is labelled with, or by where it is. */
export function refusalOf(failure: EloFailure): Refusal {
  return isCode(failure.label) ? new Refusal('invalid', failure.label) : new Refusal('invalid', 'request.invalid', { at: failure.path || '.' });
}

/** The check of an input of this type. Compiled now: a type the specification does not declare is found when the server starts. */
export function checkOf(specification: Specification, type: string): Check {
  const convert = compile<(input: unknown) => unknown>(`${specification.types}\n_ |> ${type}`, { runtime: { DateTime, Duration, Interval } });
  return (req) => {
    try {
      return convert(givenBy(req));
    } catch (error) {
      throw isFailure(error) ? refusalOf(error) : error;
    }
  };
}
