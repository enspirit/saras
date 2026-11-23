// Pure: the second factor, a time-based one-time code (TOTP, RFC 6238) from an authenticator app.
import { createHmac } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS = 30;

/** Bytes as authenticator apps take a secret: base32, without padding. */
export function base32(bytes: Uint8Array): string {
  const bits = [...bytes].map((byte) => byte.toString(2).padStart(8, '0')).join('');
  const groups = bits.match(/.{1,5}/g) ?? [];
  return groups.map((group) => ALPHABET[parseInt(group.padEnd(5, '0'), 2)]).join('');
}

export function fromBase32(secret: string): Buffer {
  const bits = [...secret.toUpperCase().replace(/[^A-Z2-7]/g, '')].map((char) => ALPHABET.indexOf(char).toString(2).padStart(5, '0')).join('');
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
}

/** The 30-second step a moment falls in. */
export const stepAt = (epochMs: number): number => Math.floor(epochMs / 1000 / STEP_SECONDS);

/** The six-digit code of a secret at a step. */
export function codeAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', fromBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** What was typed, as a code: without spaces or dashes, in lower case. */
export const codeGiven = (value: unknown): string => String(value ?? '').replace(/[\s-]+/g, '').toLowerCase().slice(0, 40);

/**
 * The step a code is good for, or null. A clock may be half a minute off either way; a code
 * is good once: nothing at or before the last step accepted.
 */
export function stepMatching(secret: string, code: string, epochMs: number, lastStep: number): number | null {
  const now = stepAt(epochMs);
  return [now - 1, now, now + 1].find((step) => step > lastStep && codeAt(secret, step) === code) ?? null;
}

/** What a QR code carries for an authenticator app: who issues the code, for which account, with which secret. */
export const authenticatorUri = (issuer: string, account: string, secret: string): string =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;

/** The recovery codes left once this one is used, or null when it is not one of them. */
export function withoutRecoveryCode(hashes: string[], hashOfGiven: string): string[] | null {
  return hashes.includes(hashOfGiven) ? hashes.filter((hash) => hash !== hashOfGiven) : null;
}
