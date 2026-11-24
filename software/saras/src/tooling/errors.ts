/**
 * The most useful text of anything that was thrown. IMAP and SMTP libraries put the
 * server's own answer in `responseText`, which says more than their generic message.
 */
export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object') {
    const { responseText, message } = e as { responseText?: unknown; message?: unknown };
    if (typeof responseText === 'string' && responseText) return responseText;
    if (typeof message === 'string') return message;
  }
  return String(e);
}

const KIND = ['code', 'command', 'responseCode', 'responseStatus', 'serverResponseCode', 'authenticationFailed', 'status'];

/** What kind of failure it is, in the codes of Node, of the mail libraries and of HTTP: none is a sentence, so that a log may hold them all. */
export function errorKind(e: unknown): Record<string, unknown> {
  const thrown = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
  return Object.fromEntries(KIND.filter((name) => ['string', 'number', 'boolean'].includes(typeof thrown[name])).map((name) => [name, thrown[name]]));
}
