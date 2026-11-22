import type { AddressInfo, Server } from 'node:net';

/** Listen on a free local port and return it. */
export const listen = (server: Server): Promise<number> =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)));

/** Stops a server, dropping the connections it still holds. */
export const closed = (server: { close(done: () => void): unknown }): Promise<void> => new Promise((resolve) => server.close(() => resolve()));
