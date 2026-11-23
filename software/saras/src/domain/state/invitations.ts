// State: the pending rights to join an organisation.
import { tokenHash } from '../../tooling/crypto.ts';
import type { Db } from '../../tooling/db.ts';
import type { InvitationRow, Role } from '../model/member.ts';

/** The invitation this token opens, while it has not expired. Only the hash of a token is ever kept. */
export const pendingInvitation = (db: Db, token: unknown): Promise<InvitationRow | undefined> =>
  db.one<InvitationRow>(`SELECT * FROM invitations WHERE token_hash = $1 AND expires_at > now()`, [tokenHash(token || '')]);

/** Keeps an invitation; one already made to the same address in the organisation is replaced. Returns its number. */
export async function keepInvitation(db: Db, invitation: { organizationId: number; address: string; role: Role; token: string; invitedBy: number; days: number }): Promise<number> {
  const saved = await db.one<{ id: number }>(
    `INSERT INTO invitations (org_id, email, role, token_hash, created_by, expires_at) VALUES ($6, $1, $2, $3, $4, now() + make_interval(days => $5))
     ON CONFLICT (org_id, email) DO UPDATE SET role = excluded.role, token_hash = excluded.token_hash, created_by = excluded.created_by, expires_at = excluded.expires_at
     RETURNING id`,
    [invitation.address, invitation.role, tokenHash(invitation.token), invitation.invitedBy, invitation.days, invitation.organizationId],
  );
  return saved!.id;
}

export const forgetInvitation = (db: Db, id: number): Promise<number> => db.run('DELETE FROM invitations WHERE id = $1', [id]);

export const forgetInvitationOf = (db: Db, organizationId: number, id: unknown): Promise<number> =>
  db.run('DELETE FROM invitations WHERE id = $1 AND org_id = $2', [Number(id) || 0, organizationId]);
