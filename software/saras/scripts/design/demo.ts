// The demo organisation and its mailbox of sample emails, on a server that is running: each is
// set up when it is not there yet, so `npm run design` can be run again and again.
import { DEMO_ACCOUNT, caller } from '../demo/api.ts';
import { connectMailbox, emailsHeld } from '../demo/mailbox.ts';
import { setUpDemo } from '../demo/setup.ts';

/** Has the demo organisation on the server, with the mailbox of sample emails connected, and says how many emails it holds. */
export async function demoOn(url: string): Promise<number> {
  const call = caller(url);
  const signIn = (): Promise<unknown> => call('POST', '/auth/login', { email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password });
  // A server nobody signed up on is not asked who the demo account is: it would log a refusal.
  const { firstAccount } = await call<{ firstAccount: boolean }>('GET', '/public');
  const there = !firstAccount && (await signIn().then(() => true, () => false));
  if (!there) {
    await setUpDemo(url);
    await signIn();
  }
  const mailboxes = await call<unknown[]>('GET', '/mailboxes');
  return mailboxes.length === 0 ? connectMailbox(call) : emailsHeld(call);
}
