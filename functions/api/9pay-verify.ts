/**
 * Cloudflare Pages Function: THE ONLY path that may set Paid (9Pay).
 * Route: GET|POST /api/9pay-verify?orderId=...
 *
 * Source of truth = 9Pay Inquire API (3-part signature).
 * Return URL query params must NEVER mark an order Paid.
 * IPN (9pay-webhook) is dormant until Merchant View can register ipn_url.
 */

import type { Env } from '../_lib/env';
import { jsonResponse } from '../_lib/env';
import { processInquireAndMarkPaid } from '../_lib/processInquirePayment';

async function extractOrderId(request: Request): Promise<string> {
  const url = new URL(request.url);
  let orderId = url.searchParams.get('orderId') || url.searchParams.get('invoice_no') || '';

  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { orderId?: string; invoice_no?: string };
      orderId = body.orderId || body.invoice_no || orderId;
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const form = await request.formData();
      orderId = String(form.get('orderId') ?? form.get('invoice_no') ?? orderId);
    }
  }

  return orderId.trim();
}

async function handleVerify(context: { request: Request; env: Env }): Promise<Response> {
  try {
    const orderId = await extractOrderId(context.request);
    if (!orderId) {
      return jsonResponse({ success: false, isPaid: false, error: 'orderId is required' }, 400);
    }
    return await processInquireAndMarkPaid(context.env, orderId);
  } catch (error: any) {
    console.error('[9Pay verify/inquire]', error);
    return jsonResponse({
      success: false,
      isPaid: false,
      error: error?.message || 'Server Error',
    }, 500);
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => handleVerify(context);
export const onRequestPost: PagesFunction<Env> = async (context) => handleVerify(context);
