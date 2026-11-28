/**
 * The HTTP API as the browser sees it: one typed call function. What the server can be asked
 * for is in ./api/, one file per area of tests/operations, each function named after its operation.
 */

import type { Problem } from '../shared/problem.ts';
import { hasMessage, t } from './i18n.ts';

export class ApiError extends Error {
  status: number;
  /** The server's message code, when it gave one. */
  code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; params?: Problem['params'] };
  if (!res.ok) {
    const text = data.code ? problemText({ code: data.code, params: data.params || {}, message: data.error || '' }) : data.error;
    throw new ApiError(text || t('common.httpError', { status: res.status }), res.status, data.code ?? null);
  }
  return data as T;
}

/** A server message in the user's language, or its English text when it has no translation. */
export function problemText(problem: Problem): string {
  const key = `server.${problem.code}`;
  return hasMessage(key) ? t(key, problem.params) : problem.message;
}

/**
 * True for the error of a request refused because the session is over. Told by its code, not
 * by the 401 status, which a wrong password also gets.
 */
export const isSignedOut = (e: unknown): boolean => e instanceof ApiError && e.code === 'auth.signedOut';
