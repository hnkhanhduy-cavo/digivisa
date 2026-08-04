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

export async function processInquireAndMarkPaid(
  env: Env,
  orderId: string
): Promise<Response> {
  const invoiceNo = orderId.trim();
  if (!invoiceNo) {
    return jsonResponse({ success: false, isPaid: false, error: 'orderId is required' }, 400);
  }
  if (invoiceNo.length > 30) {
    return jsonResponse({
      success: false,
      isPaid: false,
      error: 'invoice_no must be ≤ 30 characters',
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

  const order = await getOrderFromFirestore(invoiceNo, env);
  if (!order.ok) {
    if (order.reason === 'no-credentials') {
      return jsonResponse({
        success: false,
        isPaid: false,
        invoice_no: invoiceNo,
        error: 'Server misconfigured: missing Firebase service account credentials',
      }, 500);
    }
    if (order.reason === 'auth-failed') {
      return jsonResponse({
        success: false,
        isPaid: false,
        invoice_no: invoiceNo,
        error: 'Firebase service account auth failed',
      }, 500);
    }
    if (order.reason === 'forbidden') {
      return jsonResponse({
        success: false,
        isPaid: false,
        invoice_no: invoiceNo,
        error: 'Firestore permission denied — check firestore.rules deployment or service account IAM role',
      }, 500);
    }
    if (order.reason === 'not-found') {
      return jsonResponse({
        success: false,
        isPaid: false,
        invoice_no: invoiceNo,
        error: 'Order not found',
      }, 404);
    }
    return jsonResponse({
      success: false,
      isPaid: false,
      invoice_no: invoiceNo,
      error: 'Firestore read failed',
      firestoreStatus: order.httpStatus,
    }, 502);
  }

  if (order.fields.paymentStatus?.includes('Paid')) {
    return jsonResponse({
      success: true,
      isPaid: true,
      invoice_no: invoiceNo,
      payment_no: order.fields.ninepayPaymentNo || null,
      alreadyProcessed: true,
    });
  }

  const expectedAmount = order.fields.amountVnd;
  if (expectedAmount === undefined || expectedAmount === null) {
    return jsonResponse({
      success: false,
      isPaid: false,
      invoice_no: invoiceNo,
      error: 'Order missing amountVnd; cannot verify payment amount',
    }, 409);
  }

  const inquired = await inquirePayment(invoiceNo, merchantKey, secretKey, endpoint);
  // hasPayload = parseable JSON with `status`. HTTP 503 + status 6 is a business
  // answer ("transaction not found"), not infrastructure failure.
  if (!inquired.hasPayload) {
    return jsonResponse({
      success: false,
      isPaid: false,
      invoice_no: invoiceNo,
      error: '9Pay inquire failed',
      httpStatus: inquired.status,
      data: inquired.data,
    }, 502);
  }

  const payload = normalizeInquirePayload(inquired.data);

  // Note: description is intentionally not verified here because 9Pay reconciliation relies strictly on invoice_no.
  const returnedInvoice = String(payload.invoice_no ?? '').trim();
  if (returnedInvoice && returnedInvoice !== invoiceNo) {
    console.error('[9Pay inquire] invoice_no mismatch', { requested: invoiceNo, returned: returnedInvoice });
    return jsonResponse({
      success: false,
      isPaid: false,
      invoice_no: invoiceNo,
      error: 'invoice_no mismatch',
      expected: invoiceNo,
      received: returnedInvoice,
    }, 409);
  }

  const status = payload.status;
  const paidAmount = parseAmount(payload.amount);
  const errorCode = payload.error_code != null ? String(payload.error_code) : null;
  const isNotFound =
    Number(status) === 6 || errorCode === '221';

  // Only status === 5 AND amount match → Paid. Everything else stays Unpaid.
  if (!isPaymentSuccessStatus(status)) {
    return jsonResponse({
      success: true,
      isPaid: false,
      invoice_no: invoiceNo,
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

  if (!Number.isFinite(paidAmount)) {
    return jsonResponse({
      success: false,
      isPaid: false,
      invoice_no: invoiceNo,
      error: 'Invalid amount in inquire response',
    }, 400);
  }

  if (paidAmount !== Math.round(expectedAmount)) {
    return jsonResponse({
      success: false,
      isPaid: false,
      invoice_no: invoiceNo,
      error: 'Amount mismatch',
      expected: expectedAmount,
      received: paidAmount,
    }, 400);
  }

  const paymentNo = String(payload.payment_no ?? '');
  const write = await markOrderPaidInFirestore(
    invoiceNo,
    paymentNo,
    Math.round(expectedAmount),
    env
  );
  if (!write.ok) {
    console.error('[9Pay inquire] Firestore mark paid failed:', write.status, write.body);
    return jsonResponse({
      success: false,
      isPaid: false,
      invoice_no: invoiceNo,
      error: 'Failed to update order in Firestore',
      firestoreStatus: write.status,
    }, 502);
  }

  return jsonResponse({
    success: true,
    isPaid: true,
    invoice_no: invoiceNo,
    payment_no: paymentNo,
    amount: paidAmount,
    status: 5,
  });
}
