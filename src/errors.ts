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
