// Observation: the members of an organisation and its pending invitations, for its administrators.
import type { Invitation, Member } from '../../../shared/member.ts';
import type { Db } from '../../tooling/db.ts';

type Kept<T, K extends keyof T> = Omit<T, K> & Record<K, Date>;

/** Each member, with how many personal mailboxes they connected. */
export async function membersOf(db: Db, organizationId: number): Promise<Member[]> {
  const members = await db.query<Kept<Member, 'createdAt'>>(
    `SELECT u.id, u.email, u.name, u.role, u.created_at AS "createdAt", (SELECT count(*)::int FROM accounts a WHERE a.user_id = u.id AND NOT a.shared) AS mailboxes,
            u.totp_secret_enc IS NOT NULL AS "secondFactor"
     FROM users u WHERE u.org_id = $1 ORDER BY u.id`,
    [organizationId],
  );
  return members.map((member) => ({ ...member, createdAt: member.createdAt.toISOString() }));
}

/** Most recent first; an expired one says so until it is revoked. */
export async function invitationsOf(db: Db, organizationId: number): Promise<Invitation[]> {
  const invitations = await db.query<Kept<Invitation, 'expiresAt'>>(
    `SELECT id, email, role, expires_at AS "expiresAt", expires_at <= now() AS expired FROM invitations WHERE org_id = $1 ORDER BY id DESC`,
    [organizationId],
  );
  return invitations.map((invitation) => ({ ...invitation, expiresAt: invitation.expiresAt.toISOString() }));
}
