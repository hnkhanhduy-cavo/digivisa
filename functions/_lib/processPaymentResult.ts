import type { Env } from './env';
import { requireNinePayEnv, jsonResponse } from './env';
import {
  verifyAndDecode,
  isPaymentSuccessStatus,
  parseAmount,
} from '../api/_ninepay';
import { getOrderFromFirestore, markOrderPaidInFirestore } from './firestore';
import { notifyNewOrder } from './notify';

export async function processVerifiedPaymentResult(
  env: Env,
  result: string,
  checksum: string
): Promise<Response> {
  let checksumKey: string;
  try {
    ({ checksumKey } = requireNinePayEnv(env));
  } catch (e: any) {
    return jsonResponse({ success: false, error: e?.message || 'Config error' }, 500);
  }

  // B1 verify raw result → B2 Base64URL UTF-8 decode (shared helper)
  const decoded = await verifyAndDecode(result, checksum, checksumKey);
  if (!decoded.ok || !decoded.data) {
    return jsonResponse({ success: false, error: decoded.error || 'Invalid result' }, 400);
  }

  const payload = decoded.data;
  const invoiceNo = payload.invoice_no;
  if (!invoiceNo) {
    return jsonResponse({ success: false, error: 'Missing invoice_no' }, 400);
  }

  // Only status === 5 means success — do not treat other codes as Paid
  if (!isPaymentSuccessStatus(payload.status)) {
    return jsonResponse({
      success: true,
      isPaid: false,
      invoice_no: invoiceNo,
      status: payload.status,
      failure_reason: payload.failure_reason ?? null,
    });
  }

  const paidAmount = parseAmount(payload.amount);
  if (!Number.isFinite(paidAmount)) {
    return jsonResponse({ success: false, error: 'Invalid amount in result' }, 400);
  }

  // Strip attempt suffix (e.g. DV-123-R2 -> DV-123) to look up original order document ID in Firestore
  const orderId = String(invoiceNo).replace(/-R\d+$/, '');

  const order = await getOrderFromFirestore(orderId, env);
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
      payment_no: order.fields.ninepayPaymentNo || String(payload.payment_no ?? ''),
      alreadyProcessed: true,
    });
  }

  const expectedAmount = order.fields.amountVnd;
  if (expectedAmount === undefined || expectedAmount === null) {
    return jsonResponse({
      success: false,
      error: 'Order missing amountVnd; cannot verify payment amount',
      invoice_no: invoiceNo,
    }, 409);
  }

  if (paidAmount !== Math.round(expectedAmount)) {
    return jsonResponse({
      success: false,
      error: 'Amount mismatch',
      invoice_no: invoiceNo,
      expected: expectedAmount,
      received: paidAmount,
    }, 400);
  }

  const paymentNo = String(payload.payment_no ?? '');
  const write = await markOrderPaidInFirestore(
    orderId,
    paymentNo,
    Math.round(expectedAmount),
    env
  );
  if (!write.ok) {
    console.error('[9Pay] Firestore mark paid failed:', write.status, write.body);
    return jsonResponse({
      success: false,
      error: 'Failed to update order in Firestore',
      invoice_no: invoiceNo,
      firestoreStatus: write.status,
    }, 502);
  }

  if (write.ok) {
    await notifyNewOrder(orderId, env).catch(() => {});
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
