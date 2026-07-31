/**
 * Cloudflare Pages Function: 9Pay IPN receiver + order status poll.
 * Route: /api/9pay-webhook
 *
 * Currently UNUSED — Merchant View cannot register ipn_url; Inquire is the source of truth
 * via /api/9pay-verify. Keep this handler correct so IPN works the day ipn_url is enabled.
 *
 * IPN: POST application/x-www-form-urlencoded with fields `result` + `checksum`.
 * Verify/decode via shared `verifyAndDecode` in ./_ninepay (raw checksum → Base64URL UTF-8).
 */

import type { Env } from '../_lib/env';
import { jsonResponse } from '../_lib/env';
import { processVerifiedPaymentResult } from '../_lib/processPaymentResult';
import { getOrderFromFirestore } from '../_lib/firestore';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const form = await context.request.formData();
    const result = String(form.get('result') ?? '');
    const checksum = String(form.get('checksum') ?? '');

    if (!result || !checksum) {
      return jsonResponse({ success: false, error: 'Missing result or checksum' }, 400);
    }

    return await processVerifiedPaymentResult(context.env, result, checksum);
  } catch (error: any) {
    console.error('[9Pay webhook]', error);
    return jsonResponse({
      success: false,
      error: error?.message || 'Internal Server Error',
    }, 500);
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const orderId = url.searchParams.get('orderId');

  if (!orderId) {
    return jsonResponse({
      active: true,
      service: 'DigiVisa 9Pay IPN',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const order = await getOrderFromFirestore(orderId, context.env);
    const paymentStatus = order.fields.paymentStatus || 'Pending';
    const isPaid = paymentStatus.includes('Paid');

    return jsonResponse({
      orderId,
      isPaid,
      paymentStatus,
      status: order.fields.status || 'Pending',
      payment_no: order.fields.ninepayPaymentNo || null,
    });
  } catch (e: any) {
    return jsonResponse({ orderId, isPaid: false, error: e.message }, 500);
  }
};
