/**
 * Cloudflare Pages Function: read-only 9Pay inquire (does NOT mark Paid).
 * Route: GET /api/9pay-inquire?invoice_no=...
 *
 * To update Firestore, use /api/9pay-verify instead.
 */

import type { Env } from '../_lib/env';
import { requireNinePayEnv, jsonResponse } from '../_lib/env';
import {
  inquirePayment,
  normalizeInquirePayload,
  isPaymentSuccessStatus,
  parseAmount,
} from './_ninepay';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const invoiceNo = (url.searchParams.get('invoice_no') || url.searchParams.get('orderId') || '').trim();

    if (!invoiceNo) {
      return jsonResponse({ success: false, error: 'invoice_no is required' }, 400);
    }
    if (invoiceNo.length > 30) {
      return jsonResponse({ success: false, error: 'invoice_no must be ≤ 30 characters' }, 400);
    }

    const { merchantKey, secretKey, endpoint } = requireNinePayEnv(context.env);
    const inquired = await inquirePayment(invoiceNo, merchantKey, secretKey, endpoint);

    // Valid JSON with `status` is a business answer even on HTTP 503 (e.g. status 6).
    if (!inquired.hasPayload) {
      return jsonResponse({
        success: false,
        error: '9Pay inquire failed',
        httpStatus: inquired.status,
        data: inquired.data,
      }, 502);
    }

    const payload = normalizeInquirePayload(inquired.data);
    const status = payload.status;
    const amount = parseAmount(payload.amount);
    const errorCode = payload.error_code != null ? String(payload.error_code) : null;
    const isNotFound = Number(status) === 6 || errorCode === '221';

    return jsonResponse({
      success: true,
      invoice_no: payload.invoice_no || invoiceNo,
      payment_no: payload.payment_no ?? null,
      amount: Number.isFinite(amount) ? amount : null,
      status,
      error_code: errorCode,
      isPaid: isPaymentSuccessStatus(status),
      method: payload.method ?? null,
      failure_reason: payload.failure_reason ?? null,
      httpStatus: inquired.status,
      message: isNotFound
        ? 'Transaction not found at 9Pay'
        : isPaymentSuccessStatus(status)
          ? undefined
          : 'Payment not successful yet; order remains unpaid',
      raw: inquired.data,
    });

  } catch (error: any) {
    console.error('[9Pay inquire]', error);
    return jsonResponse({
      success: false,
      error: error?.message || 'Server Error',
    }, 500);
  }
};
