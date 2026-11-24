/** What a test sees of an API answer. Bodies are free-form JSON, checked by the assertions themselves. */
export interface ApiResponse {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  /** The answer as it came, for those that are not JSON: a document, a file. */
  raw: Buffer;
  headers: Headers;
}

export type ApiClient = (method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<ApiResponse>;

/** Signs up with the password every test member has; an organisation is created, named as given or after the address. */
export const signUp = (as: ApiClient, email: string, organization?: string): Promise<ApiResponse> =>
  as('POST', '/auth/signup', { email, password: 'un-bon-mot-de-passe', organization });

/** Invites an address into the administrator's organisation and accepts the invitation as `guest`. */
export async function join(admin: ApiClient, guest: ApiClient, email: string, role: 'user' | 'admin' = 'user'): Promise<void> {
  const invitation = await admin('POST', '/invitations', { email, role });
  const token = String(invitation.body.link).split('#/invitation/')[1];
  const accepted = await guest('POST', '/invitations/accept', { token, password: 'un-bon-mot-de-passe' });
  if (accepted.status !== 201) throw new Error(`could not join: ${JSON.stringify(accepted.body)}`);
}

/** Adds every ready-made prompt the organisation does not have yet, as its administrator would one by one. */
export async function installTemplates(admin: ApiClient): Promise<void> {
  for (const template of (await admin('GET', '/prompts/ready-made')).body) {
    const created = await admin('POST', '/prompts', template);
    if (created.status !== 201) throw new Error(`could not add the template: ${JSON.stringify(created.body)}`);
  }
}

/** Keeps what the server sets, by name; a cookie set to nothing is forgotten. */
function remember(jar: Map<string, string>, setCookies: string[]): void {
  for (const set of setCookies) {
    const [name = '', value = ''] = (set.split(';')[0] ?? '').split('=');
    if (value) jar.set(name, value);
    else jar.delete(name);
  }
}

/** The answer as JSON, when it is some. */
function jsonOf(raw: Buffer): unknown {
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    return null;
  }
}

/** A browser-like API client: it keeps its cookies between calls. */
export function createClient(baseUrl: () => string): ApiClient {
  const jar = new Map<string, string>();
  return async (method, path, body, headers = { 'content-type': 'application/json' }) => {
    const res = await fetch(`${baseUrl()}/api${path}`, {
      method,
      headers: { ...(method === 'GET' ? {} : headers), cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') },
      body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body || {}),
    });
    remember(jar, res.headers.getSetCookie());
    const raw = Buffer.from(await res.arrayBuffer());
    return { status: res.status, body: jsonOf(raw), raw, headers: res.headers };
  };
}
