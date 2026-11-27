// How the suite meets saras: what opspicy cannot know of the system it runs against.
//
// The type is imported from where opspicy's image has it: Node drops the line when it runs the
// file, and `emb run operations:lint` type-checks it in that image.
import type { Configure } from '/opt/opspicy/src/configuration.ts';

const configure: Configure = ({ env, dbagent, noKeyHeld }) => ({
  // The front door, as the suite's container reaches it.
  api: env('SARAS_API'),

  // Every case installs a seed, which empties the database. Only the stack under the suites
  // says it may (docker-compose.test.yml): the development stack does not, and nothing runs there.
  mayEmptyTheDatabase: process.env.OPERATIONS_MAY_EMPTY_THE_DATABASE === 'yes',

  // A Background is a seed of software/storage, installed by dbagent, beside the front door.
  background: dbagent(env('STORAGE_API')),

  // The relations of state.yml are read there, and never written.
  database: env('DATABASE_URL'),

  // saras counts wrong guesses by origin, and is told the origin by its proxy.
  originHeader: 'x-forwarded-for',

  // Somebody signs in with their address and their password. No second factor in this stack.
  signIn: async (browser, { email, password }, name) => {
    const answer = await browser.call('POST', '/api/auth/login', { email, password });
    if (answer.status !== 200) throw new Error(`"${name}" cannot sign in: ${answer.status} ${JSON.stringify(answer.body)}`);
  },

  // A refusal says why in a code the interface translates (specification/_shared/types.elo).
  refusal: { type: 'Refusal', code: (body) => (body as { code?: unknown } | null)?.code },

  // A fetch started by an operation outlives its answer, and holds a key in the database for as long as it lasts.
  atRest: noKeyHeld,
});

export default configure;
