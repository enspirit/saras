// A mailbox connected and fetched, as the stories that begin after that step need it.
import assert from 'node:assert/strict';
import type { ApiClient } from './client.ts';
import type { Stack } from './stack.ts';

/** Chooses the folder to watch and waits for the fetch this starts. */
export async function watchFolder(as: ApiClient, accountId: number, folder: string): Promise<void> {
  assert.equal((await as('PUT', `/mailboxes/${accountId}/folder`, { folder })).status, 200);
  await as('POST', `/mailboxes/${accountId}/fetch`);
}

/** Connects the test mailbox by its servers, personal unless said shared, and returns its id. */
export async function connectMailbox(as: ApiClient, credentials: Stack['imapAccount'], shared = false): Promise<number> {
  const account = await as('POST', '/mailboxes/imap', { ...credentials, shared });
  assert.equal(account.status, 201);
  return account.body.id;
}

/** Connects the test mailbox, watches its inbox and waits for it to be fetched; returns the mailbox's id. */
export async function connectInbox(as: ApiClient, credentials: Stack['imapAccount'], shared = false): Promise<number> {
  const id = await connectMailbox(as, credentials, shared);
  await watchFolder(as, id, 'INBOX');
  return id;
}
