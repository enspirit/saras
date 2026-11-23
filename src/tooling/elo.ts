// Running rules written in Elo (elo-lang.org): a small, safe expression language. A rule is
// compiled once and run on plain data in a context of its own, under a time limit: Elo's
// compiled code can do no input or output, but nothing in the language bounds how long it runs.
import { compileToJavaScript, parse } from '@enspirit/elo';
import { DateTime, Duration, Interval } from 'luxon';
import { Script, createContext } from 'node:vm';

const MAX_SOURCE = 4000;
const TIMEOUT_MS = 100;

/** A rule that cannot be compiled or run: what Elo says of it. */
export class EloError extends Error {}

export interface Rule {
  /** What the rule gives for this input, as plain data. Throws EloError when it fails or takes too long. */
  run(input: unknown): unknown;
}

const firstLine = (e: unknown): string => String(e instanceof Error ? e.message : e).split('\n')[0] ?? '';

/** The JavaScript a rule compiles to, applied to the input the context holds, its result as JSON: nothing but text crosses back. */
function scriptOf(source: string): Script {
  if (source.length > MAX_SOURCE) throw new EloError(`the rule is longer than ${MAX_SOURCE} characters`);
  try {
    return new Script(`JSON.stringify((${compileToJavaScript(parse(source))})(JSON.parse(input)) ?? null)`);
  } catch (e) {
    throw new EloError(firstLine(e));
  }
}

export function compileRule(source: string): Rule {
  const script = scriptOf(source);
  const run = (input: unknown): unknown => {
    try {
      return JSON.parse(script.runInContext(createContext({ DateTime, Duration, Interval, input: JSON.stringify(input) }), { timeout: TIMEOUT_MS }));
    } catch (e) {
      throw new EloError(firstLine(e));
    }
  };
  return { run };
}
