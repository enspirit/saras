import type { OrganizationRow, UserRow } from './types.ts';

/** The signed-in user and their session, attached to the request by the `auth` middleware. */
export interface SessionUser extends UserRow {
  sid: string;
  oauth_state: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user: SessionUser;
      /** The organisation of the signed-in user: nothing outside it is reachable. */
      org: OrganizationRow;
    }
  }
}
