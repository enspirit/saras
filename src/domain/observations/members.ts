// Observation: the members of an organisation and its pending invitations, for its administrators.
import type { Db } from '../../tooling/db.ts';

/** Each member, with how many personal mailboxes they connected. */
export const membersOf = (db: Db, organizationId: number): Promise<unknown[]> =>
  db.query(
    `SELECT u.id, u.email, u.name, u.role, u.created_at AS "createdAt", (SELECT count(*)::int FROM accounts a WHERE a.user_id = u.id AND NOT a.shared) AS accounts
     FROM users u WHERE u.org_id = $1 ORDER BY u.id`,
    [organizationId],
  );

/** Most recent first; an expired one says so until it is revoked. */
export const invitationsOf = (db: Db, organizationId: number): Promise<unknown[]> =>
  db.query(`SELECT id, email, role, expires_at AS "expiresAt", expires_at <= now() AS expired FROM invitations WHERE org_id = $1 ORDER BY id DESC`, [organizationId]);
