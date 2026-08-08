/**
 * Firestore REST helpers authenticated with a service account.
 * SA tokens bypass security rules — clients are locked out of payment fields.
 */

import type { Env } from './env';
import { getAccessToken } from './googleAuth';

const DEFAULT_PROJECT = 'digivisa';

function projectId(env: Env): string {
  return env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT;
}

function firestoreDocUrl(project: string, orderId: string, mask?: string[]): string {
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/orders/${encodeURIComponent(orderId)}`;
  if (!mask?.length) return base;
  const qs = mask.map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join('&');
  return `${base}?${qs}`;
}

export interface FirestoreOrderFields {
  paymentStatus?: string;
  status?: string;
  amountVnd?: number;
  ninepayPaymentNo?: string;
  type?: string;
  createdAt?: string;
  trackingToken?: string;
  whatsappGroupUrl?: string;
  zaloGroupUrl?: string;
  groupLinkUpdatedAt?: string;
  larkRecordId?: string;
  larkNotifiedAt?: string;
  paymentAttempt?: number;
  ninepayInvoiceNos?: string[];
}

/** Safe fields for guest Tracker — never include passport / scans / contact PII. Includes group links when set. */
export interface PublicOrderLookupFields {
  id: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  type: string;
  whatsappGroupUrl?: string;
  zaloGroupUrl?: string;
}

function readStringField(fields: any, key: string): string | undefined {
  return fields?.[key]?.stringValue;
}

function readNumberField(fields: any, key: string): number | undefined {
  const iv = fields?.[key]?.integerValue;
  if (iv !== undefined) return Number(iv);
  const dv = fields?.[key]?.doubleValue;
  if (dv !== undefined) return Number(dv);
  return undefined;
}

function readStringArrayField(fields: any, key: string): string[] | undefined {
  const values = fields?.[key]?.arrayValue?.values;
  if (!Array.isArray(values)) return undefined;
  const result: string[] = [];
  for (const v of values) {
    if (v && typeof v === 'object' && typeof v.stringValue === 'string') {
      result.push(v.stringValue);
    }
  }
  return result;
}

export async function getOrderFromFirestore(
  orderId: string,
  env: Env
): Promise<{
  ok: boolean;
  fields: FirestoreOrderFields;
  raw?: any;
  reason?: 'no-credentials' | 'auth-failed' | 'forbidden' | 'not-found' | 'error';
  httpStatus?: number;
}> {
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    console.error('[Firestore] Missing FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY — cannot read orders');
    return { ok: false, fields: {}, reason: 'no-credentials' };
  }

  let token: string;
  try {
    token = await getAccessToken(env);
  } catch (e) {
    console.error('[Firestore] SA Auth failed:', e);
    return { ok: false, fields: {}, reason: 'auth-failed' };
  }

  const res = await fetch(firestoreDocUrl(projectId(env), orderId), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[Firestore] Read order failed:', res.status, errorText);
    const reason =
      res.status === 403
        ? 'forbidden'
        : res.status === 404
        ? 'not-found'
        : 'error';
    return { ok: false, fields: {}, reason, httpStatus: res.status };
  }
  const data = await res.json() as any;
  const f = data?.fields || {};
  return {
    ok: true,
    raw: data,
    fields: {
      paymentStatus: readStringField(f, 'paymentStatus'),
      status: readStringField(f, 'status'),
      amountVnd: readNumberField(f, 'amountVnd'),
      ninepayPaymentNo: readStringField(f, 'ninepayPaymentNo'),
      type: readStringField(f, 'type'),
      createdAt: readStringField(f, 'createdAt'),
      trackingToken: readStringField(f, 'trackingToken'),
      whatsappGroupUrl: readStringField(f, 'whatsappGroupUrl'),
      zaloGroupUrl: readStringField(f, 'zaloGroupUrl'),
      groupLinkUpdatedAt: readStringField(f, 'groupLinkUpdatedAt'),
      larkRecordId: readStringField(f, 'larkRecordId'),
      larkNotifiedAt: readStringField(f, 'larkNotifiedAt'),
      paymentAttempt: readNumberField(f, 'paymentAttempt'),
      ninepayInvoiceNos: readStringArrayField(f, 'ninepayInvoiceNos'),
    },
  };
}

function docNameToOrderId(name: string | undefined): string {
  if (!name) return '';
  const parts = name.split('/');
  return decodeURIComponent(parts[parts.length - 1] || '');
}

export interface OrderByTrackingTokenResult {
  ok: boolean;
  /** Present when a matching document exists. */
  orderId?: string;
  /** Existing owner uid, if any (for claim conflict checks — not for public API). */
  userId?: string;
  userEmail?: string;
  public?: PublicOrderLookupFields;
}

/**
 * Look up an order by opaque trackingToken (SA bypasses rules).
 * `public` never includes passport / scans / DOB / phone.
 */
export async function findOrderByTrackingToken(
  trackingToken: string,
  env: Env
): Promise<OrderByTrackingTokenResult> {
  const token = await getAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId(env)}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'orders' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'trackingToken' },
            op: 'EQUAL',
            value: { stringValue: trackingToken },
          },
        },
        limit: 1,
      },
    }),
  });

  if (!res.ok) {
    console.error('[Firestore] trackingToken query failed:', res.status, await res.text());
    return { ok: false };
  }

  const rows = (await res.json()) as Array<{ document?: { name?: string; fields?: any } }>;
  const doc = rows?.find((r) => r.document)?.document;
  if (!doc?.fields) {
    return { ok: false };
  }

  const f = doc.fields;
  const id = docNameToOrderId(doc.name);
  const whatsappGroupUrl = readStringField(f, 'whatsappGroupUrl');
  const zaloGroupUrl = readStringField(f, 'zaloGroupUrl');

  return {
    ok: true,
    orderId: id,
    userId: readStringField(f, 'userId'),
    userEmail: readStringField(f, 'userEmail'),
    public: {
      id,
      status: readStringField(f, 'status') || 'Pending',
      paymentStatus: readStringField(f, 'paymentStatus') || 'Pending',
      createdAt: readStringField(f, 'createdAt') || '',
      type: readStringField(f, 'type') || '',
      ...(whatsappGroupUrl ? { whatsappGroupUrl } : {}),
      ...(zaloGroupUrl ? { zaloGroupUrl } : {}),
    },
  };
}

/** Attach Firebase uid (+ email) to an unclaimed guest order. SA bypasses rules. */
export async function claimOrderUserInFirestore(
  orderId: string,
  userId: string,
  userEmail: string | undefined,
  env: Env
): Promise<{ ok: boolean; status: number; body?: string }> {
  const token = await getAccessToken(env);
  const mask = ['userId', ...(userEmail ? ['userEmail'] as const : [])];
  const url = firestoreDocUrl(projectId(env), orderId, [...mask]);

  const fields: Record<string, unknown> = {
    userId: { stringValue: userId },
  };
  if (userEmail) {
    fields.userEmail = { stringValue: userEmail };
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fields }),
  });

  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

export async function markOrderPaidInFirestore(
  orderId: string,
  paymentNo: string,
  amountVnd: number,
  env: Env
): Promise<{ ok: boolean; status: number; body?: string }> {
  const token = await getAccessToken(env);
  const url = firestoreDocUrl(projectId(env), orderId, [
    'paymentStatus',
    'status',
    'ninepayPaymentNo',
    'amountVnd',
  ]);

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fields: {
        paymentStatus: { stringValue: 'Paid (9Pay)' },
        status: { stringValue: 'Confirmed' },
        ninepayPaymentNo: { stringValue: paymentNo },
        // Echo amountVnd so rules see an unchanged charge amount on partial PATCH.
        amountVnd: { integerValue: String(Math.round(amountVnd)) },
      },
    }),
  });

  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

export async function setGroupLinksInFirestore(
  orderId: string,
  links: { whatsappGroupUrl?: string; zaloGroupUrl?: string },
  env: Env
): Promise<{ ok: boolean; status: number; body?: string; groupLinkUpdatedAt?: string }> {
  const token = await getAccessToken(env);
  const groupLinkUpdatedAt = new Date().toISOString();

  const mask: string[] = ['groupLinkUpdatedAt'];
  const fields: Record<string, unknown> = {
    groupLinkUpdatedAt: { stringValue: groupLinkUpdatedAt },
  };

  if (links.whatsappGroupUrl !== undefined) {
    mask.push('whatsappGroupUrl');
    fields.whatsappGroupUrl = { stringValue: links.whatsappGroupUrl };
  }
  if (links.zaloGroupUrl !== undefined) {
    mask.push('zaloGroupUrl');
    fields.zaloGroupUrl = { stringValue: links.zaloGroupUrl };
  }

  const url = firestoreDocUrl(projectId(env), orderId, mask);

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fields }),
  });

  const body = await res.text();
  return { ok: res.ok, status: res.status, body, groupLinkUpdatedAt };
}

export async function setNotifyFlagInFirestore(
  orderId: string,
  data: { larkNotifiedAt: string; larkRecordId?: string },
  env: Env
): Promise<{ ok: boolean; status: number; body?: string }> {
  const token = await getAccessToken(env);
  const mask: string[] = ['larkNotifiedAt'];
  const fields: Record<string, unknown> = {
    larkNotifiedAt: { stringValue: data.larkNotifiedAt },
  };

  if (data.larkRecordId !== undefined) {
    mask.push('larkRecordId');
    fields.larkRecordId = { stringValue: data.larkRecordId };
  }

  const url = firestoreDocUrl(projectId(env), orderId, mask);

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fields }),
  });

  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

export async function setPaymentAttemptInFirestore(
  orderId: string,
  attempt: number,
  invoiceNos: string[],
  env: Env
): Promise<{ ok: boolean; status: number; body?: string }> {
  const token = await getAccessToken(env);
  const mask = ['paymentAttempt', 'ninepayInvoiceNos'];
  const url = firestoreDocUrl(projectId(env), orderId, mask);

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fields: {
        paymentAttempt: { integerValue: String(attempt) },
        ninepayInvoiceNos: {
          arrayValue: {
            values: invoiceNos.map((no) => ({ stringValue: no })),
          },
        },
      },
    }),
  });

  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

