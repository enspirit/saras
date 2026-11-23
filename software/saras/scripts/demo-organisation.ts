// node scripts/demo-organisation.ts <url> — sets the demo organisation up on a saras server
// that is already running, through its API. It is how the demo seed of software/storage is
// made (`emb run storage:demo.rebuild`); to *have* the demo, load the seed: `emb run demo`.
import { serverGiven } from './demo/api.ts';
import { setUpDemo } from './demo/setup.ts';

const url = serverGiven('demo-organisation.ts');
await setUpDemo(url);
console.log(`The demo organisation is set up on ${url}.`);
