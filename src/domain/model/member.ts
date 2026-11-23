// A member of an organisation, and an invitation to become one.
import type { Role } from '../../../shared/member.ts';

export type { Role } from '../../../shared/member.ts';

export interface UserRow {
  id: number;
  org_id: number;
  email: string;
  password_hash: string;
  role: Role;
  /** Language of the interface as the user last used it: what the server writes for them follows it. */
  language: string;
  /** How the other members see this person; empty until given, the address then stands for it. */
  name: string;
  model: string | null;
  signature: string;
  openrouter_key_enc: string | null;
  /** Their second factor: the secret their authenticator shares with us, sealed; null until they have one. */
  totp_secret_enc: string | null;
  /** The last 30-second step a code was accepted for: a code is good once. */
  totp_last_step: number;
  /** Hashes of the recovery codes they have left, as JSON. */
  recovery_codes_json: string;
  created_at: Date;
}

export interface InvitationRow {
  id: number;
  org_id: number;
  email: string;
  role: Role;
  token_hash: string;
  created_by: number | null;
  expires_at: Date;
  created_at: Date;
}
