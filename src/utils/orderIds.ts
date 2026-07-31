/**
 * Cryptographically strong order IDs and guest tracking tokens.
 * Do NOT use Math.random for either.
 */

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

function randomBase36(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += BASE36[bytes[i] % 36];
  }
  return out;
}

/** `DV-` + 10 base36 chars (≤30 for 9Pay invoice_no). Old DV-* IDs remain valid doc keys. */
export function generateOrderId(): string {
  return `DV-${randomBase36(10)}`;
}

/** ≥32-char opaque token for guest Tracker lookup (not guessable from order id). */
export function generateTrackingToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
