/**
 * Cloudflare Pages Function: build a signed 9Pay portal redirect URL.
 * Route: POST /api/9pay-create-payment
 *
 * 9Pay redirect model: sign locally, then redirect the browser to /portal.
 * Do NOT POST server-to-server to /payments/create.
 */

import type { Env } from '../_lib/env';
import { requireNinePayEnv, jsonResponse } from '../_lib/env';
import {
  NINEPAY_MIN_AMOUNT,
  NINEPAY_MAX_AMOUNT,
  buildPaymentPortalUrl,
  type NinePayCreateParams,
} from './_ninepay';
import { getOrderFromFirestore } from '../_lib/firestore';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as {
      orderId?: string;
      amountVnd?: number;
    };

    const orderId = (body.orderId || '').trim();

    if (!orderId) {
      return jsonResponse({ success: false, error: 'orderId is required' }, 400);
    }
    if (orderId.length > 30) {
      return jsonResponse({
        success: false,
        error: `invoice_no must be ≤ 30 characters (got ${orderId.length})`,
      }, 400);
    }
    if (!/^[A-Za-z0-9._-]{1,30}$/.test(orderId)) {
      return jsonResponse({
        success: false,
        error: 'invoice_no contains invalid characters',
      }, 400);
    }

    const order = await getOrderFromFirestore(orderId, context.env);
    if (!order.ok) {
      if (order.reason === 'no-credentials') {
        return jsonResponse({
          success: false,
          error: 'Server misconfigured: missing Firebase service account credentials',
        }, 500);
      }
      if (order.reason === 'auth-failed') {
        return jsonResponse({
          success: false,
          error: 'Firebase service account auth failed',
        }, 500);
      }
      if (order.reason === 'forbidden') {
        return jsonResponse({
          success: false,
          error: 'Firestore permission denied — check firestore.rules deployment or service account IAM role',
        }, 500);
      }
      if (order.reason === 'not-found') {
        return jsonResponse({ success: false, error: 'Order not found' }, 404);
      }
      return jsonResponse({
        success: false,
        error: 'Firestore read failed',
        firestoreStatus: order.httpStatus,
      }, 502);
    }
    if (order.fields.amountVnd == null) {
      return jsonResponse({ success: false, error: 'Order missing amountVnd' }, 409);
    }
    if (order.fields.paymentStatus?.includes('Paid')) {
      return jsonResponse({ success: false, error: 'Order already paid' }, 409);
    }

    const amountVnd = Math.round(order.fields.amountVnd);

    if (body.amountVnd !== undefined && body.amountVnd !== null && Number(body.amountVnd) !== amountVnd) {
      console.warn('[9Pay create-payment] client amount mismatch', {
        orderId,
        client: body.amountVnd,
        firestore: amountVnd,
      });
    }

    if (!Number.isFinite(amountVnd) || amountVnd < NINEPAY_MIN_AMOUNT) {
      return jsonResponse({
        success: false,
        error: `amount must be ≥ ${NINEPAY_MIN_AMOUNT} VND (got ${amountVnd})`,
      }, 400);
    }
    if (amountVnd > NINEPAY_MAX_AMOUNT) {
      return jsonResponse({
        success: false,
        error: `amount must be ≤ ${NINEPAY_MAX_AMOUNT} VND (got ${amountVnd})`,
      }, 400);
    }

    const { merchantKey, secretKey, endpoint } = requireNinePayEnv(context.env);
    const origin = (context.env.APP_BASE_URL || new URL(context.request.url).origin).replace(/\/$/, '');
    const time = Math.round(Date.now() / 1000);

    const parameters: NinePayCreateParams = {
      merchantKey,
      time,
      invoice_no: orderId,
      amount: amountVnd,
      description: `Thanh toan don hang ${orderId}`,
      return_url: `${origin}/?payment=success&orderId=${encodeURIComponent(orderId)}`,
      back_url: `${origin}/?payment=cancel&orderId=${encodeURIComponent(orderId)}`,
    };

    const paymentUrl = await buildPaymentPortalUrl(parameters, secretKey, endpoint);

    return jsonResponse({
      success: true,
      paymentUrl,
      orderId,
    });
  } catch (error: any) {
    console.error('[9Pay create-payment]', error);
    return jsonResponse({
      success: false,
      error: error?.message || 'Server Error',
    }, 500);
  }
};
