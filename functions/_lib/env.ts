export interface Env {
  NINEPAY_MERCHANT_KEY: string;
  NINEPAY_SECRET_KEY: string;
  NINEPAY_CHECKSUM_KEY: string;
  NINEPAY_ENDPOINT: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  SYNC_SECRET: string;
}

export function requireNinePayEnv(env: Env): {
  merchantKey: string;
  secretKey: string;
  checksumKey: string;
  endpoint: string;
} {
  const merchantKey = env.NINEPAY_MERCHANT_KEY;
  const secretKey = env.NINEPAY_SECRET_KEY;
  const checksumKey = env.NINEPAY_CHECKSUM_KEY;
  const endpoint = (env.NINEPAY_ENDPOINT || 'https://sand-payment.9pay.vn').replace(/\/$/, '');

  if (!merchantKey || !secretKey || !checksumKey) {
    throw new Error('Missing NINEPAY_MERCHANT_KEY, NINEPAY_SECRET_KEY, or NINEPAY_CHECKSUM_KEY');
  }

  return { merchantKey, secretKey, checksumKey, endpoint };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
