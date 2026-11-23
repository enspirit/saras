// Getting in: what the server answers when someone signs in, signs up or accepts an invitation.

/**
 * The second factor asked before a session is opened, where the installation requires one:
 * a code from the member's authenticator app. `enrol` when they have none yet: the secret to
 * put in the app, as text and as the address a QR code carries.
 */
export interface SecondFactorAsked {
  step: 'code' | 'enrol';
  secret?: string;
  uri?: string;
}

/** Signed in, or one step short of it. */
export interface Admitted {
  ok: true;
  secondFactor?: SecondFactorAsked;
  /** Given once, when the second factor was just set up: codes to get in without the app, each good once. */
  recoveryCodes?: string[];
}

/** A link to choose a new password, as an administrator is given it for a member. */
export interface PasswordResetLink {
  link: string;
  validMinutes: number;
}
