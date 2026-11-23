// The demo organisation, as its seed holds it (software/storage/data/demo): who signs in to
// it, and how these scripts speak to a saras server as that person.

/** Who signs in to the demo. */
export const DEMO_ACCOUNT = { email: 'demo@saras.example', password: 'saras-demo-password', organization: 'Brightwater Consulting' };

export type Call = <T = { id?: number; key?: string }>(method: string, path: string, body?: unknown) => Promise<T>;

/** Calls the API of a server as one person, keeping the cookie a sign-up or a sign-in gives. */
export function caller(url: string): Call {
  let cookie = '';
  return async <T>(method: string, path: string, body?: unknown) => {
    const answer = await fetch(`${url}/api${path}`, { method, headers: { 'content-type': 'application/json', cookie }, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) });
    cookie = answer.headers.getSetCookie()[0]?.split(';')[0] ?? cookie;
    const told = await answer.json().catch(() => ({}));
    if (!answer.ok) throw new Error(`${method} ${path}: ${answer.status} ${JSON.stringify(told)}`);
    return told as T;
  };
}

/** The address of the server a script was given, without a trailing slash; the script stops when it was given none. */
export function serverGiven(script: string): string {
  const url = process.argv[2];
  if (!url) {
    console.error(`usage: node scripts/${script} <url of a running saras server>`);
    process.exit(2);
  }
  return url.replace(/\/+$/, '');
}
