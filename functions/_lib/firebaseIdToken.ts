/**
 * Verify Firebase Auth ID tokens on Cloudflare Workers (Web Crypto).
 * Public keys from Google's X.509 endpoint; Cache-Control max-age honored.
 */

const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: Record<string, string> | null = null;
let cachedCertsExpiryMs = 0;

function base64UrlToBytes(input: string): Uint8Array {
  const std = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = std + '='.repeat((4 - (std.length % 4)) % 4);
  const bin = atob(pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function readAsn1Length(buf: Uint8Array, pos: number): [number, number] {
  let len = buf[pos++];
  if (len < 0x80) return [len, pos];
  const n = len & 0x7f;
  len = 0;
  for (let i = 0; i < n; i++) len = (len << 8) | buf[pos++];
  return [len, pos];
}

/** Extract SubjectPublicKeyInfo DER from an X.509 certificate DER. */
function extractSpkiFromX509(der: Uint8Array): Uint8Array {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error('Invalid cert: expected SEQUENCE');
  [, offset] = readAsn1Length(der, offset);

  if (der[offset++] !== 0x30) throw new Error('Invalid cert: expected tbsCertificate');
  const [tbsLen, tbsStart] = readAsn1Length(der, offset);
  const tbsEnd = tbsStart + tbsLen;
  offset = tbsStart;

  if (der[offset] === 0xa0) {
    offset++;
    const [vLen, vStart] = readAsn1Length(der, offset);
    offset = vStart + vLen;
  }

  // serialNumber, signature, issuer, validity, subject — skip each
  for (let i = 0; i < 5; i++) {
    const tag = der[offset++];
    if (tag !== 0x02 && tag !== 0x30) throw new Error(`Invalid tbs field tag 0x${tag.toString(16)}`);
    const [len, start] = readAsn1Length(der, offset);
    offset = start + len;
  }

  if (offset >= tbsEnd || der[offset] !== 0x30) {
    throw new Error('Invalid cert: subjectPublicKeyInfo not found');
  }
  const spkiStart = offset;
  offset++;
  const [spkiLen, spkiContent] = readAsn1Length(der, offset);
  const spkiEnd = spkiContent + spkiLen;
  return der.slice(spkiStart, spkiEnd);
}

function pemCertToSpki(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return extractSpkiFromX509(der);
}

async function getCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedCerts && now < cachedCertsExpiryMs) {
    return cachedCerts;
  }

  const res = await fetch(CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase certs (${res.status})`);
  }

  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('Cache-Control') || '';
  const maxAgeMatch = /max-age\s*=\s*(\d+)/i.exec(cacheControl);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedCerts = certs;
  cachedCertsExpiryMs = now + Math.max(60, maxAgeSec) * 1000;
  return certs;
}

export interface VerifiedIdToken {
  uid: string;
  email?: string;
  payload: Record<string, unknown>;
}

/**
 * Verify Firebase ID token signature + standard claims.
 * Returns uid (= sub) on success; throws on failure.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string
): Promise<VerifiedIdToken> {
  if (!idToken || !projectId) {
    throw new Error('Missing idToken or projectId');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT');
  }

  const [headerB64, payloadB64, sigB64] = parts;
  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerB64)));
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));
  } catch {
    throw new Error('Invalid JWT encoding');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported JWT header');
  }

  const certs = await getCerts();
  const pem = certs[header.kid];
  if (!pem) {
    throw new Error('Unknown JWT kid');
  }

  const spki = pemCertToSpki(pem);
  const key = await crypto.subtle.importKey(
    'spki',
    spki,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToBytes(sigB64);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
  if (!valid) {
    throw new Error('Invalid JWT signature');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const aud = payload.aud;
  const iss = payload.iss;
  const exp = Number(payload.exp);
  const sub = typeof payload.sub === 'string' ? payload.sub : '';

  if (aud !== projectId) {
    throw new Error('Invalid aud');
  }
  if (iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Invalid iss');
  }
  if (!Number.isFinite(exp) || exp <= nowSec) {
    throw new Error('Token expired');
  }
  if (!sub) {
    throw new Error('Missing sub');
  }

  return {
    uid: sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    payload,
  };
}
