// node scripts/demo-onto.ts <url> — sets the demo organisation up on a saras server that is
// already running, through its API, as `npm run demo` does on a server of its own. The demo
// mailbox is started beside this script, for the time of the fetch: the server must reach
// this machine as 127.0.0.1. It is how the demo seed of software/storage is made.
import { startDemoMailbox } from './demo/mailbox.ts';
import { setUpDemo } from './demo/setup.ts';

const url = process.argv[2];
if (!url) {
  console.error('usage: node scripts/demo-onto.ts <url of a running saras server>');
  process.exit(2);
}

const mailbox = await startDemoMailbox();
await setUpDemo(url.replace(/\/+$/, ''), mailbox.imapAccount, false);
console.log(`The demo organisation is set up on ${url}.`);
process.exit(0);
