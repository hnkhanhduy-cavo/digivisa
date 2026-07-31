/**
 * Shared 9Pay helpers for Cloudflare Pages Functions.
 * File is underscored so it is NOT routed as an HTTP endpoint.
 */

export const NINEPAY_MIN_AMOUNT = 10_000;
export const NINEPAY_MAX_AMOUNT = 200_000_000;
/** Official success status in IPN / return / inquire payloads. */
export const NINEPAY_SUCCESS_STATUS = 5;

export interface NinePayCreateParams {
  merchantKey: string;
  time: number;
  invoice_no: string;
  amount: number;
  description: string;
  return_url: string;
  back_url: string;
}

export interface NinePayResultPayload {
  payment_no?: number | string;
  invoice_no?: string;
  amount?: number | string;
  amount_request?: number | string;
  currency?: string;
  description?: string;
  method?: string;
  status?: number | string;
  error_code?: number | string;
  failure_reason?: string | null;
  created_at?: unknown;
  card_brand?: string;
  card_info?: {
    card_name?: string;
    card_number?: string;
  };
}

/** Alphabetically sorted application/x-www-form-urlencoded query string. */
export function buildHttpQuery(data: Record<string, string | number>): string {
  const q = new URLSearchParams();
  const ordered = Object.keys(data)
    .sort()
    .reduce<Record<string, string | number>>((o, k) => {
      o[k] = data[k];
      return o;
    }, {});
  Object.keys(ordered).forEach((k) => q.append(k, String(ordered[k])));
  return q.toString();
}

/** HMAC-SHA256 → Base64 (crypto.subtle). */
export async function buildSignature(message: string, secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  const bytes = new Uint8Array(signatureBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function sha256HexUpper(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Decode Base64URL (may contain `_`, no padding) as UTF-8 JSON.
 * Do NOT call this before checksum verification — checksum is over the raw `result` string.
 * Do NOT use ascii decode (9Pay sample result.js bug) — breaks Vietnamese description.
 */
function decodeBase64UrlUtf8Json(result: string): NinePayResultPayload {
  const std = result.replace(/-/g, '+').replace(/_/g, '/');
  const pad = std + '='.repeat((4 - (std.length % 4)) % 4);
  const json = new TextDecoder('utf-8').decode(
    Uint8Array.from(atob(pad), (c) => c.charCodeAt(0))
  );
  return JSON.parse(json) as NinePayResultPayload;
}

/**
 * B1: verify checksum on RAW `result` (exactly as received — no normalize first).
 * B2: only then Base64URL → UTF-8 → JSON.
 */
export async function verifyAndDecode(
  result: string,
  checksum: string,
  checksumKey: string
): Promise<{ ok: boolean; data?: NinePayResultPayload; error?: string }> {
  if (!result || !checksum || !checksumKey) {
    return { ok: false, error: 'Missing result, checksum, or checksumKey' };
  }

  // B1 — checksum on raw result string
  const expected = await sha256HexUpper(result + checksumKey);
  if (expected !== checksum.toUpperCase()) {
    return { ok: false, error: 'invalid checksum' };
  }

  // B2 — decode only after verify
  try {
    const data = decodeBase64UrlUtf8Json(result);
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Failed to decode result payload' };
  }
}

/** status === 5 is the only success code we accept for marking Paid. */
export function isPaymentSuccessStatus(status: unknown): boolean {
  return Number(status) === NINEPAY_SUCCESS_STATUS;
}

export function parseAmount(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

/** Build browser-redirect portal URL (no outbound HTTP). Create-payment uses 4-part signature. */
export async function buildPaymentPortalUrl(
  params: NinePayCreateParams,
  secretKey: string,
  endpoint: string
): Promise<string> {
  const httpQuery = buildHttpQuery(params as unknown as Record<string, string | number>);
  // 4 parts: METHOD \n URI \n time \n canonicalQuery
  const message = `POST\n${endpoint}/payments/create\n${params.time}\n${httpQuery}`;
  const signature = await buildSignature(message, secretKey);
  const json = JSON.stringify(params);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const baseEncode = btoa(bin);
  return `${endpoint}/portal?${buildHttpQuery({ baseEncode, signature })}`;
}

/** Normalize common 9Pay inquire / IPN response envelopes to a flat payload. */
export function normalizeInquirePayload(raw: unknown): NinePayResultPayload {
  const r = raw as any;
  if (!r || typeof r !== 'object') return {};
  if (r.result && typeof r.result === 'object' && !Array.isArray(r.result)) {
    return r.result as NinePayResultPayload;
  }
  if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
    return r.data as NinePayResultPayload;
  }
  return r as NinePayResultPayload;
}

/** True when body is JSON with a `status` field (top-level or common envelopes). */
function inquireBodyHasStatus(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const r = data as Record<string, unknown>;
  if (r.status !== undefined && r.status !== null) return true;
  if (r.result && typeof r.result === 'object' && !Array.isArray(r.result)) {
    const status = (r.result as Record<string, unknown>).status;
    if (status !== undefined && status !== null) return true;
  }
  if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
    const status = (r.data as Record<string, unknown>).status;
    if (status !== undefined && status !== null) return true;
  }
  return false;
}

/**
 * Inquire transaction status.
 * Signature is ONLY 3 parts (no trailing canonical query):
 *   GET \n {END_POINT}/v2/payments/{invoiceNo}/inquire \n {time}
 *
 * Note: 9Pay may return HTTP 503 with a valid JSON body
 * `{ status: 6, error_code: "221", failure_reason: "Transaction not found" }`
 * when the invoice was never opened at checkout. Callers must use `hasPayload`
 * (not `ok`/HTTP status alone) to distinguish that from infrastructure failure.
 */
export async function inquirePayment(
  invoiceNo: string,
  merchantKey: string,
  secretKey: string,
  endpoint: string
): Promise<{ ok: boolean; status: number; data: unknown; hasPayload: boolean }> {
  const time = Math.round(Date.now() / 1000);
  // Same URL string is used for signing and for the GET request (official sample).
  const url = `${endpoint}/v2/payments/${invoiceNo}/inquire`;
  const message = `GET\n${url}\n${time}`;
  const signature = await buildSignature(message, secretKey);

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Date: String(time),
      Authorization: `Signature Algorithm=HS256,Credential=${merchantKey},SignedHeaders=,Signature=${signature}`,
    },
  });

  const text = await res.text();
  let data: unknown = text;
  let hasPayload = false;
  try {
    data = JSON.parse(text);
    hasPayload = inquireBodyHasStatus(data);
  } catch {
    /* keep raw text — infrastructure / non-JSON body */
  }
  return { ok: res.ok, status: res.status, data, hasPayload };
}
