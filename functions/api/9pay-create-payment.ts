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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as {
      orderId?: string;
      amountVnd?: number;
    };

    const orderId = (body.orderId || '').trim();
    const amountVnd = Math.round(Number(body.amountVnd));

    if (!orderId) {
      return jsonResponse({ success: false, error: 'orderId is required' }, 400);
    }
    if (orderId.length > 30) {
      return jsonResponse({
        success: false,
        error: `invoice_no must be ≤ 30 characters (got ${orderId.length})`,
      }, 400);
    }
    if (!Number.isFinite(amountVnd) || amountVnd < NINEPAY_MIN_AMOUNT) {
      return jsonResponse({
        success: false,
        error: `amount must be ≥ ${NINEPAY_MIN_AMOUNT} VND (got ${body.amountVnd})`,
      }, 400);
    }
    if (amountVnd > NINEPAY_MAX_AMOUNT) {
      return jsonResponse({
        success: false,
        error: `amount must be ≤ ${NINEPAY_MAX_AMOUNT} VND (got ${amountVnd})`,
      }, 400);
    }

    const { merchantKey, secretKey, endpoint } = requireNinePayEnv(context.env);
    const origin = new URL(context.request.url).origin;
    const time = Math.round(Date.now() / 1000);

    const parameters: NinePayCreateParams = {
      merchantKey,
      time,
      invoice_no: orderId,
      amount: amountVnd,
      description: `Thanh toan don hang ${orderId}`,
      return_url: `${origin}/?payment=success&orderId=${orderId}`,
      back_url: `${origin}/?payment=cancel&orderId=${orderId}`,
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
