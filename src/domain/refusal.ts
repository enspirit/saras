// How an operation says no. A refusal names the clause that failed, as a message code the
// interface can translate, and its kind: what sort of "no" it is. The domain knows nothing
// of HTTP; the tooling turns a kind into a status.
import { problem } from '../tooling/messages.ts';
import type { MessageCode, MessageParams, ServerProblem } from '../tooling/messages.ts';

/**
 * invalid:         what was asked makes no sense as asked (a ReqPre on the request itself)
 * unauthenticated: the agent is not who they claim to be
 * tooMany:         the agent tried too often
 * forbidden: this agent may not do it
 * notFound:  it concerns something that does not exist, or that this agent may not see
 * conflict:  the state it starts from is not the one the operation applies to (DomPre)
 * gone:      what it needs existed and no longer does
 * upstream:  another agent the operation depends on failed (the mailbox, the LLM)
 */
export type RefusalKind = 'invalid' | 'unauthenticated' | 'forbidden' | 'notFound' | 'conflict' | 'gone' | 'tooMany' | 'upstream';

export class Refusal extends Error {
  kind: RefusalKind;
  problem: ServerProblem;

  constructor(kind: RefusalKind, code: MessageCode, params: MessageParams = {}) {
    const described = problem(code, params);
    super(described.message);
    this.kind = kind;
    this.problem = described;
  }
}

/** A decision that may be a refusal: pure functions return it, operations throw what it refuses. */
export type Verdict<T> = { ok: true; value: T } | { ok: false; refusal: Refusal };
export const accept = <T>(value: T): Verdict<T> => ({ ok: true, value });
export const refuse = (kind: RefusalKind, code: MessageCode, params: MessageParams = {}): Verdict<never> => ({ ok: false, refusal: new Refusal(kind, code, params) });

/** The value of an accepted verdict; throws the refusal of a refused one. */
export function accepted<T>(verdict: Verdict<T>): T {
  if (!verdict.ok) throw verdict.refusal;
  return verdict.value;
}
