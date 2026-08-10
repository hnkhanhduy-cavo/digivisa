/**
 * Creates a Firebase Auth user if needed and grants it a custom claim.
 *
 * Custom claims cannot be set from the Firebase console or from the browser —
 * only from a service account — which is why this exists. Reads the same
 * credentials the Pages Functions use, from .dev.vars.
 *
 *   node scripts/set-user-claim.mjs <email> <password> <claim>
 *
 * Example:
 *   node scripts/set-user-claim.mjs agency@digivisa.com 123abc agency
 *   node scripts/set-user-claim.mjs ops@digivisa.com secret123 staff
 *
 * Existing users keep their password; only the claim is applied. The user must
 * sign out and back in for a new claim to appear in their token.
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const [, , email, password, claim] = process.argv;

if (!email || !password || !claim) {
  console.error('Usage: node scripts/set-user-claim.mjs <email> <password> <claim>');
  process.exit(1);
}

function readEnv() {
  const raw = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = readEnv();
const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .dev.vars');
  process.exit(1);
}

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(privateKey, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${payload}.${signature}`,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Token request failed: ${JSON.stringify(body)}`);
  return body.access_token;
}

const base = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}`;

async function call(path, token, payload) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${path} failed: ${JSON.stringify(body)}`);
  return body;
}

const token = await getAccessToken();

const found = await call('/accounts:lookup', token, { email: [email] });
let localId = found.users?.[0]?.localId;

if (localId) {
  console.log(`User already exists: ${email} (${localId}) — password left as it is.`);
} else {
  const created = await call('/accounts', token, { email, password, emailVerified: true });
  localId = created.localId;
  console.log(`Created user: ${email} (${localId})`);
}

const existing = found.users?.[0]?.customAttributes;
const claims = existing ? JSON.parse(existing) : {};
claims[claim] = true;

await call('/accounts:update', token, {
  localId,
  customAttributes: JSON.stringify(claims),
});

console.log(`Claim applied: ${JSON.stringify(claims)}`);
console.log('The user must sign out and back in before the claim appears in their token.');
