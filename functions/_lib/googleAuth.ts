/**
 * Google OAuth access token from a Firebase/GCP service account.
 * Runs on Cloudflare Workers (Web Crypto — no Node crypto / google-auth-library).
 */

import type { Env } from './env';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
/** Firestore REST + Identity Toolkit (custom claims). */
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/identitytoolkit',
].join(' ');

let cachedToken: string | null = null;
let cachedExpiryMs = 0;

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeJson(obj: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n');
  const body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function signJwtRs256(unsignedJwt: string, privateKeyPem: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedJwt)
  );
  return base64UrlEncode(new Uint8Array(sig));
}

/**
 * Returns a Bearer access token for Firestore REST.
 * Cached in module scope until ~60s before expiry.
 */
export async function getAccessToken(env: Env): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedExpiryMs - 60_000) {
    return cachedToken;
  }

  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY');
  }

  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;
  const header = base64UrlEncodeJson({ alg: 'RS256', typ: 'JWT' });
  const claim = base64UrlEncodeJson({
    iss: clientEmail,
    scope: OAUTH_SCOPES,
    aud: TOKEN_URL,
    exp,
    iat,
  });
  const unsigned = `${header}.${claim}`;
  const signature = await signJwtRs256(unsigned, privateKey);
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google OAuth token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error('Google OAuth response missing access_token');
  }

  cachedToken = data.access_token;
  const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  cachedExpiryMs = now + expiresInSec * 1000;
  return cachedToken;
}
