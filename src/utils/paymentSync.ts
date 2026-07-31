/**
 * Client backstop: re-check unpaid orders via /api/9pay-verify (Inquire).
 * Debounced so Tracker/OMS remounts do not spam 9Pay.
 */

import { Order } from '../types';

const DEBOUNCE_MS = 60_000; // per orderId
const TAB_COOLDOWN_MS = 30_000; // whole sync pass
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const lastVerifyAt = new Map<string, number>();
let lastTabSyncAt = 0;

export interface VerifyResult {
  orderId: string;
  isPaid: boolean;
  payment_no?: string;
  error?: string;
}

function isUnpaidRecent(order: Order, now: number): boolean {
  if (order.paymentStatus?.includes('Paid')) return false;
  const created = Date.parse(order.createdAt || '');
  if (!Number.isFinite(created)) return false;
  return now - created <= MAX_AGE_MS;
}

/** Call inquire-backed verify for one order (respects per-order debounce). */
export async function verifyOrderPayment(
  orderId: string,
  opts?: { force?: boolean }
): Promise<VerifyResult> {
  const now = Date.now();
  const prev = lastVerifyAt.get(orderId) || 0;
  if (!opts?.force && now - prev < DEBOUNCE_MS) {
    return { orderId, isPaid: false, error: 'debounced' };
  }
  lastVerifyAt.set(orderId, now);

  try {
    const res = await fetch(`/api/9pay-verify?orderId=${encodeURIComponent(orderId)}`);
    const data = (await res.json()) as {
      isPaid?: boolean;
      payment_no?: string;
      error?: string;
    };
    return {
      orderId,
      isPaid: !!data.isPaid,
      payment_no: data.payment_no,
      error: data.error,
    };
  } catch (e: any) {
    return { orderId, isPaid: false, error: e?.message || 'network error' };
  }
}

/**
 * Sync recent unpaid orders (Tracker / OMS backstop).
 * Returns only orders that became paid.
 */
export async function syncUnpaidOrdersViaInquire(
  orders: Order[],
  opts?: { force?: boolean }
): Promise<VerifyResult[]> {
  const now = Date.now();
  if (!opts?.force && now - lastTabSyncAt < TAB_COOLDOWN_MS) {
    return [];
  }
  lastTabSyncAt = now;

  const candidates = orders.filter((o) => isUnpaidRecent(o, now));
  const paid: VerifyResult[] = [];

  for (const order of candidates) {
    const result = await verifyOrderPayment(order.id, opts);
    if (result.isPaid) paid.push(result);
  }

  return paid;
}
