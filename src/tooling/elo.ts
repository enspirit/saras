// Running rules written in Elo (elo-lang.org): a small, safe expression language. A rule is
// checked against the shape of what it is given, compiled once, and run on plain data in a
// context of its own, under a time limit: Elo's compiled code can do no input or output, but
// nothing in the language bounds how long it runs.
import { compileToJavaScript, formatDiagnostic, parse, parseTypeExpr, typecheck } from '@enspirit/elo';
import type { Diagnostic } from '@enspirit/elo';
import { DateTime, Duration, Interval } from 'luxon';
import { Script, createContext } from 'node:vm';

const MAX_SOURCE = 4000;
const TIMEOUT_MS = 100;

/** A rule that cannot be read, does not fit what it is given, or fails when run: what Elo says of it. */
export class EloError extends Error {}

export interface Rule {
  /** What the rule gives for this input, as plain data. Throws EloError when it fails or takes too long. */
  run(input: unknown): unknown;
}

const firstLine = (e: unknown): string => String(e instanceof Error ? e.message : e).split('\n')[0] ?? '';

/** A diagnostic in a line: where, and what. The schema an unknown field was looked for in is left out: it is long, and shown beside the editor. */
const told = (diagnostic: Diagnostic): string => formatDiagnostic(diagnostic).replace(/ of \{.*\}: the schema is closed\./, '.');

/** Something wrong in a rule, and where. */
export interface Found {
  line: number;
  column: number;
  /** Elo's own name for the kind of problem, e.g. `unknown-field`; `syntax` when the rule cannot be read at all. */
  code: string;
  message: string;
}

/** Where Elo's reader stopped, from what it says: "… at line 1, column 10". */
function unread(e: unknown): Found {
  const message = firstLine(e);
  const [, line, column] = message.match(/ at line (\d+), column (\d+)$/) ?? [];
  return { line: Number(line) || 1, column: Number(column) || 1, code: 'syntax', message: message.replace(/ at line \d+, column \d+$/, '') };
}

/** Everything wrong in a rule, each with its place: what cannot be read, then what does not fit the type of its input `_`. */
export function foundIn(source: string, inputType: string): Found[] {
  try {
    const errors = typecheck(parse(source, { locations: true }), { inputType: parseTypeExpr(inputType) }).filter((d) => d.severity === 'error');
    return errors.map((d) => ({ line: d.loc?.line ?? 1, column: d.loc?.column ?? 1, code: d.code, message: d.message }));
  } catch (e) {
    return [unread(e)];
  }
}

/** What the type checker objects to in a rule, given the type of its input `_` as an Elo type expression. */
export function problemsOf(source: string, inputType: string): string[] {
  const errors = typecheck(parse(source, { locations: true }), { inputType: parseTypeExpr(inputType) }).filter((d) => d.severity === 'error');
  return errors.map(told);
}

/** The JavaScript a rule compiles to, applied to the input the context holds, its result as JSON: nothing but text crosses back. */
function scriptOf(source: string, inputType: string | undefined): Script {
  if (source.length > MAX_SOURCE) throw new EloError(`the rule is longer than ${MAX_SOURCE} characters`);
  try {
    const problems = inputType ? problemsOf(source, inputType) : [];
    if (problems.length) throw new EloError(problems.slice(0, 3).join(' — '));
    return new Script(`JSON.stringify((${compileToJavaScript(parse(source))})(JSON.parse(input)) ?? null)`);
  } catch (e) {
    throw new EloError(firstLine(e));
  }
}

/** Compiles a rule. With `inputType`, the type of what it is given, the rule must also fit it: a field that does not exist, a text used as a number, are refused here and not found out on an email. */
export function compileRule(source: string, inputType?: string): Rule {
  const script = scriptOf(source, inputType);
  const run = (input: unknown): unknown => {
    try {
      return JSON.parse(script.runInContext(createContext({ DateTime, Duration, Interval, input: JSON.stringify(input) }), { timeout: TIMEOUT_MS }));
    } catch (e) {
      throw new EloError(firstLine(e));
    }
  };
  return { run };
}
