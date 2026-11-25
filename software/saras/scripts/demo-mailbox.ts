// node scripts/demo-mailbox.ts <url> — connects the mailbox of the stack (world/mailbox) to
// the demo organisation of a saras server, as its administrator would in the interface, and
// fetches it. Part of `emb run demo`, after the seed: the access to a mailbox is sealed with
// the server's own APP_SECRET, so it is given to the server, not carried by a seed.
import { DEMO_ACCOUNT, caller, serverGiven } from './demo/api.ts';
import { connectMailbox } from './demo/mailbox.ts';

const url = serverGiven('demo-mailbox.ts');
const call = caller(url);
await call('POST', '/auth/login', { email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password });
const fetched = await connectMailbox(call);
if (fetched === 0) {
  console.error('The mailbox of the stack is connected, but no email was fetched from it.');
  process.exit(1);
}
console.log(`The mailbox of the stack is connected to the demo organisation: ${fetched} emails.`);
