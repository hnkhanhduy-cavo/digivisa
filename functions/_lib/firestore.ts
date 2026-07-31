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
}

/** Safe fields for guest Tracker — never include passport / scans / contact PII. */
export interface PublicOrderLookupFields {
  id: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  type: string;
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

export async function getOrderFromFirestore(
  orderId: string,
  env: Env
): Promise<{ ok: boolean; fields: FirestoreOrderFields; raw?: any }> {
  const token = await getAccessToken(env);
  const res = await fetch(firestoreDocUrl(projectId(env), orderId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return { ok: false, fields: {} };
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
        status: { stringValue: 'Agency Review' },
        ninepayPaymentNo: { stringValue: paymentNo },
        // Echo amountVnd so rules see an unchanged charge amount on partial PATCH.
        amountVnd: { integerValue: String(Math.round(amountVnd)) },
      },
    }),
  });

  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}
