/** What a test sees of an API answer. Bodies are free-form JSON, checked by the assertions themselves. */
export interface ApiResponse {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

export type ApiClient = (method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<ApiResponse>;

/** A browser-like API client: it keeps the session cookie between calls. */
export function createClient(baseUrl: () => string): ApiClient {
  let cookie = '';
  return async (method, path, body, headers = { 'content-type': 'application/json' }) => {
    const res = await fetch(`${baseUrl()}/api${path}`, {
      method,
      headers: { ...(method === 'GET' ? {} : headers), cookie },
      body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body || {}),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0] ?? '';
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}
