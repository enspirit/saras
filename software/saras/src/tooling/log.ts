// What the server tells its operator: one JSON object per line on the standard output (JSON
// Lines), with `time`, `level` and `msg`, then what the line is about. Every line passes
// through tooling/redaction.ts. See doc/decisions/0012 for what is logged and what never is.
import { AsyncLocalStorage } from 'node:async_hooks';
import { redacted } from './redaction.ts';

export const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type Level = (typeof LEVELS)[number];
export type Fields = Record<string, unknown>;
type Write = (line: string) => void;

export const isLevel = (name: string): name is Level => (LEVELS as readonly string[]).includes(name);

const toStandardOutput: Write = (line) => void process.stdout.write(`${line}\n`);

/** Nothing is written until the server starts logging: an application that a test starts says nothing. */
let write: Write | null = null;
let threshold: Level = 'info';

/** What every line logged while something runs is about: the request, the task, the mailbox. */
const within = new AsyncLocalStorage<Fields>();

export function startLogging(level: Level = 'info', to: Write = toStandardOutput): void {
  threshold = level;
  write = to;
}

/** Whether a line of this level would be written: spares the work of saying what nobody reads. */
export const logs = (level: Level): boolean => write !== null && LEVELS.indexOf(level) >= LEVELS.indexOf(threshold);

function lineOf(level: Level, msg: string, fields: Fields): string {
  const head = { time: new Date().toISOString(), level, msg: redacted(msg) };
  // The head comes first and is nobody else's to set.
  return JSON.stringify(Object.assign({}, head, redacted({ ...within.getStore(), ...fields }), head));
}

function tell(level: Level, msg: string, fields: Fields = {}): void {
  if (!logs(level)) return;
  try {
    write?.(lineOf(level, msg, fields));
  } catch {
    // Logging never fails what it tells of: the line is lost.
  }
}

export const log = {
  debug: (msg: string, fields?: Fields): void => tell('debug', msg, fields),
  info: (msg: string, fields?: Fields): void => tell('info', msg, fields),
  warn: (msg: string, fields?: Fields): void => tell('warn', msg, fields),
  error: (msg: string, fields?: Fields): void => tell('error', msg, fields),
};

/** Runs something, every line logged meanwhile carrying these fields, however deep it is logged from. */
export const about = <T>(fields: Fields, run: () => T): T => within.run({ ...within.getStore(), ...fields }, run);
