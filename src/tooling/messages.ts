/**
 * Everything the server tells a user, as a code plus parameters. The text here is the English
 * default; the interface translates the code (key `server.<code>` of its translation files)
 * and falls back to this text when it has no translation.
 */
export const MESSAGES = {
  // Requests
  'request.jsonRequired': 'Content-Type application/json is required.',
  'request.unknownRoute': 'Unknown route.',
  'request.tooManyAttempts': 'Too many attempts, try again in a few minutes.',
  'error.internal': 'Internal server error.',

  // Accounts of the application
  'auth.signedOut': 'Not signed in.',
  'auth.adminOnly': 'Reserved for administrators.',
  'auth.invalidCredentials': 'Wrong email or password.',
  'auth.wrongPassword': 'This is not your current password.',
  'auth.wrongCode': 'This code is not the right one, or was already used.',
  'auth.signInExpired': 'This sign-in took too long: start again with your password.',
  'auth.resetInvalid': 'This link is no longer valid: ask for a new one.',
  'auth.resetNotByEmail': 'This server sends no email: ask an administrator for a link to a new password.',
  'auth.invalidEmail': 'Invalid email address.',
  'auth.passwordTooShort': 'Password: 10 characters minimum.',
  'auth.emailTaken': 'An account already exists with this address.',
  'auth.signupClosed': 'Sign-up is closed: ask an administrator for an invitation.',
  'invitation.invalid': 'Invalid or expired invitation. Ask your administrator for a new one.',
  'members.notFound': 'User not found.',
  'members.cannotDeleteSelf': 'Your own account is deleted from your settings.',
  'members.invalidRole': 'Invalid role.',
  'members.lastAdmin': 'At least one administrator must remain.',
  'settings.invalidModel': 'Invalid model: expected "provider/model".',

  // Mailboxes
  'mailboxes.notFound': 'Mailbox not found.',
  'mailboxes.serversRequired': 'IMAP and SMTP servers and ports are required.',
  'mailboxes.passwordRequired': 'Password required.',
  'mailboxes.connectionFailed': 'Could not connect: {detail}',
  'oauth.notConfigured': 'This OAuth provider is not configured on this server.',
  'oauth.denied': 'Authorisation refused ({detail}).',
  'oauth.expired': 'The OAuth session expired, start again.',
  'oauth.failed': 'Connection failed: {detail}',
  'oauth.partialGrant': 'Access was granted only in part. Start again and tick every permission asked: reading the mailbox, and creating and sending replies.',
  'sync.fetchFailed': 'Could not read the mailbox: {detail}',
  'sync.triageFailed': 'Triage failed: {detail}',
  'sync.prepareFailed': 'Could not prepare a proposal: {detail}',
  'mailboxes.adminOnly': 'A shared mailbox is managed by administrators.',
  'mailboxes.alreadyConnected': 'This mailbox is already connected in your organisation.',
  'mailboxes.otherMailbox': 'You signed in to another mailbox than the one to renew.',
  'mailboxes.renewAtHost': 'Access to this mailbox is renewed by signing in at its host.',
  'organization.invalidSorting': 'Unknown way of sorting.',
  'organization.invalidWriting': 'Unknown way of preparing replies.',
  'organization.nameMismatch': 'This is not the name of the organisation.',
  'mailboxes.folderRequired': 'Choose the folder to watch.',
  'mailboxes.unknownFolder': 'This folder does not exist in the mailbox.',
  'mailboxes.foldersFailed': 'Could not list the folders: {detail}',

  // Prompts and emails
  'prompts.notFound': 'Prompt not found.',
  'prompts.incomplete': 'Name and instructions are required.',
  'emails.notFound': 'Email not found.',
  'emails.invalidStatus': 'Invalid status.',
  'emails.alreadySent': 'A reply has already been sent.',
  'emails.alreadyHandled': 'A reply has already been handled for this email.',
  'emails.contentErased': 'The content of this email has been erased (retention period exceeded).',
  'reply.empty': 'The reply is empty.',
  'assist.nothingWritten': 'Write something first: there is nothing to check or improve.',
  'assist.invalidAction': 'Unknown kind of assistance.',
  'reply.noRecipient': 'At least one recipient is required.',
  'reply.invalidAddress': 'Invalid address: {address}',
  'reply.sendFailed': 'Could not send: {detail}',
  'reply.draftFailed': 'Could not save the draft: {detail}',

  // LLM
  'llm.noKey': 'No OpenRouter key configured. Add one in Settings.',
  'llm.unreachable': 'OpenRouter cannot be reached ({detail}).',
  'llm.keyRefused': 'OpenRouter refused the key. Check it in Settings.',
  'llm.noCredit': 'Not enough OpenRouter credit.',
  'llm.noZdrProvider': 'No provider of the model "{model}" guarantees zero data retention (ZDR). Choose another model in Settings. {detail}',
  'llm.rateLimited': 'OpenRouter rate limit reached, try again in a moment.',
  'llm.failed': 'OpenRouter error ({status}). {detail}',
  'llm.emptyAnswer': 'The model returned an empty answer.',

  // Verdicts of the header rules applied before the triage gate
  'triage.unknownSender': 'Unknown sender.',
  'triage.ownMessage': 'Message sent by yourself.',
  'triage.alreadyAnswered': 'Already answered from your mail client.',
  'triage.automatedAddress': 'Automated address (no-reply, notification…).',
  'triage.autoSubmitted': 'Automated message (Auto-Submitted).',
  'triage.newsletter': 'Mailing list or newsletter.',
  'triage.bulk': 'Bulk mail.',
} as const;

export type MessageCode = keyof typeof MESSAGES;
export type MessageParams = Record<string, string | number>;

/** A problem as the server words it: its code is one of the server's own. Told to the interface as a shared Problem. */
export interface ServerProblem {
  code: MessageCode;
  params: MessageParams;
  message: string;
}

export function problem(code: MessageCode, params: MessageParams = {}): ServerProblem {
  const message = MESSAGES[code].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? '')).trim();
  return { code, params, message };
}

/** How a problem is kept in a text column. */
export const encodeProblem = (p: ServerProblem | null): string | null => (p ? JSON.stringify({ code: p.code, params: p.params }) : null);

/** Reads back what `encodeProblem` wrote. Anything else is ignored. */
export function decodeProblem(stored: string | null): ServerProblem | null {
  if (!stored) return null;
  try {
    const { code, params } = JSON.parse(stored) as { code?: string; params?: MessageParams };
    return code && code in MESSAGES ? problem(code as MessageCode, params || {}) : null;
  } catch {
    return null;
  }
}

/** A triage reason is either free text written by the LLM, or a code, stored with this prefix. */
const CODE_PREFIX = 'code:';
export const reasonCode = (code: MessageCode): string => `${CODE_PREFIX}${code}`;

/** Splits a stored triage reason into its text and, when it is a coded one, its code. */
export function readReason(stored: string): { text: string; code: MessageCode | null } {
  const code = stored.startsWith(CODE_PREFIX) ? stored.slice(CODE_PREFIX.length) : '';
  return code in MESSAGES ? { text: MESSAGES[code as MessageCode], code: code as MessageCode } : { text: stored, code: null };
}
