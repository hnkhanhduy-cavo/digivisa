/**
 * Sole server path that may mark an order Paid (9Pay): inquire API.
 * IPN webhook uses processVerifiedPaymentResult separately (dormant until ipn_url is registered).
 */

import type { Env } from './env';
import { requireNinePayEnv, jsonResponse } from './env';
import {
  inquirePayment,
  normalizeInquirePayload,
  isPaymentSuccessStatus,
  parseAmount,
} from '../api/_ninepay';
import { getOrderFromFirestore, markOrderPaidInFirestore } from './firestore';
import { notifyNewOrder } from './notify';

export async function processInquireAndMarkPaid(
  env: Env,
  orderId: string
): Promise<Response> {
  const cleanOrderId = orderId.trim();
  if (!cleanOrderId) {
    return jsonResponse({ success: false, isPaid: false, error: 'orderId is required' }, 400);
  }
  if (cleanOrderId.length > 30) {
    return jsonResponse({
      success: false,
      isPaid: false,
      error: 'orderId must be ≤ 30 characters',
    }, 400);
  }

  let merchantKey: string;
  let secretKey: string;
  let endpoint: string;
  try {
    ({ merchantKey, secretKey, endpoint } = requireNinePayEnv(env));
  } catch (e: any) {
    return jsonResponse({ success: false, isPaid: false, error: e?.message || 'Config error' }, 500);
  }

  const order = await getOrderFromFirestore(cleanOrderId, env);
  if (!order.ok) {
    if (order.reason === 'no-credentials') {
      return jsonResponse({
        success: false,
        isPaid: false,
        invoice_no: cleanOrderId,
        error: 'Server misconfigured: missing Firebase service account credentials',
      }, 500);
    }
    if (order.reason === 'auth-failed') {
      return jsonResponse({
        success: false,
        isPaid: false,
        invoice_no: cleanOrderId,
        error: 'Firebase service account auth failed',
      }, 500);
    }
    if (order.reason === 'forbidden') {
      return jsonResponse({
        success: false,
        isPaid: false,
        invoice_no: cleanOrderId,
        error: 'Firestore permission denied — check firestore.rules deployment or service account IAM role',
      }, 500);
    }
    if (order.reason === 'not-found') {
      return jsonResponse({
        success: false,
        isPaid: false,
        invoice_no: cleanOrderId,
        error: 'Order not found',
      }, 404);
    }
    return jsonResponse({
      success: false,
      isPaid: false,
      invoice_no: cleanOrderId,
      error: 'Firestore read failed',
      firestoreStatus: order.httpStatus,
    }, 502);
  }

  if (order.fields.paymentStatus?.includes('Paid')) {
    return jsonResponse({
      success: true,
      isPaid: true,
      invoice_no: cleanOrderId,
      payment_no: order.fields.ninepayPaymentNo || null,
      alreadyProcessed: true,
    });
  }

  const expectedAmount = order.fields.amountVnd;
  if (expectedAmount === undefined || expectedAmount === null) {
    return jsonResponse({
      success: false,
      isPaid: false,
      invoice_no: cleanOrderId,
      error: 'Order missing amountVnd; cannot verify payment amount',
    }, 409);
  }

  // Build list of payment attempt invoice_nos to inquire (latest first)
  const candidates = order.fields.ninepayInvoiceNos?.length
    ? [...order.fields.ninepayInvoiceNos].reverse()
    : [cleanOrderId];

  let successfulPayload: any = null;
  let successfulCandidate: string | null = null;
  let latestInquired: any = null;

  for (const candidate of candidates) {
    if (!candidate || candidate.length > 30) continue;

    const inquired = await inquirePayment(candidate, merchantKey, secretKey, endpoint);
    if (candidate === candidates[0]) {
      latestInquired = inquired;
    }

    if (!inquired.hasPayload) {
      continue;
    }

    const payload = normalizeInquirePayload(inquired.data);
    const returnedInvoice = String(payload.invoice_no ?? '').trim();

    // Verify returned invoice_no matches the candidate currently being inquired
    if (returnedInvoice && returnedInvoice !== candidate) {
      console.error('[9Pay inquire] invoice_no mismatch', { requested: candidate, returned: returnedInvoice });
      continue;
    }

    const status = payload.status;
    if (isPaymentSuccessStatus(status)) {
      successfulPayload = payload;
      successfulCandidate = candidate;
      break; // Found successful payment! Stop checking other candidates.
    }
  }

  // If no successful paid candidate was found, return unpaid response using latest candidate result
  if (!successfulPayload) {
    const latestCandidate = candidates[0];
    let inquired = latestInquired;
    if (!inquired) {
      inquired = await inquirePayment(latestCandidate, merchantKey, secretKey, endpoint);
    }

    if (!inquired?.hasPayload) {
      return jsonResponse({
        success: false,
        isPaid: false,
        invoice_no: cleanOrderId,
        error: '9Pay inquire failed',
        httpStatus: inquired?.status,
        data: inquired?.data,
      }, 502);
    }

    const payload = normalizeInquirePayload(inquired.data);
    const status = payload.status;
    const paidAmount = parseAmount(payload.amount);
    const errorCode = payload.error_code != null ? String(payload.error_code) : null;
    const isNotFound = Number(status) === 6 || errorCode === '221';

    return jsonResponse({
      success: true,
      isPaid: false,
      invoice_no: cleanOrderId,
      status: status ?? null,
      error_code: errorCode,
      amount: Number.isFinite(paidAmount) ? paidAmount : null,
      failure_reason: payload.failure_reason ?? null,
      httpStatus: inquired.status,
      message: isNotFound
        ? 'Transaction not found at 9Pay'
        : 'Payment not successful yet; order remains unpaid',
    });
  }

  // A successful payment was found! Validate amount and mark order Paid in Firestore using orderId
  const payload = successfulPayload;
  const matchedInvoiceNo = successfulCandidate!;
  const paidAmount = parseAmount(payload.amount);

  if (!Number.isFinite(paidAmount)) {
    return jsonResponse({
      success: false,
      isPaid: false,
      invoice_no: matchedInvoiceNo,
      error: 'Invalid amount in inquire response',
    }, 400);
  }

  if (paidAmount !== Math.round(expectedAmount)) {
    return jsonResponse({
      success: false,
      isPaid: false,
      invoice_no: matchedInvoiceNo,
      error: 'Amount mismatch',
      expected: expectedAmount,
      received: paidAmount,
    }, 400);
  }

  const paymentNo = String(payload.payment_no ?? '');
  const write = await markOrderPaidInFirestore(
    cleanOrderId, // Document ID in Firestore is ALWAYS cleanOrderId
    paymentNo,
    Math.round(expectedAmount),
    env
  );
  if (!write.ok) {
    console.error('[9Pay inquire] Firestore mark paid failed:', write.status, write.body);
    return jsonResponse({
      success: false,
      isPaid: false,
      invoice_no: matchedInvoiceNo,
      error: 'Failed to update order in Firestore',
      firestoreStatus: write.status,
    }, 502);
  }

  if (write.ok) {
    await notifyNewOrder(cleanOrderId, env).catch(() => {});
  }

  return jsonResponse({
    success: true,
    isPaid: true,
    invoice_no: cleanOrderId,
    matched_invoice_no: matchedInvoiceNo,
    payment_no: paymentNo,
    amount: paidAmount,
    status: 5,
  });
}
