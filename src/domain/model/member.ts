// A member of an organisation, and an invitation to become one.
export type Role = 'admin' | 'user';

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
