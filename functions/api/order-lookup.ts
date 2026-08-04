/**
 * Guest order status lookup by opaque trackingToken.
 * Route: GET|POST /api/order-lookup
 *
 * Returns only non-sensitive fields (and group chat links if set). Never returns passport, DOB, scans, phone, email.
 */

import type { Env } from '../_lib/env';
import { jsonResponse } from '../_lib/env';
import { findOrderByTrackingToken } from '../_lib/firestore';

const MIN_TOKEN_LEN = 32;

async function handleLookup(context: { request: Request; env: Env }): Promise<Response> {
  try {
    let trackingToken = '';
    if (context.request.method === 'GET') {
      const url = new URL(context.request.url);
      trackingToken = (url.searchParams.get('trackingToken') || url.searchParams.get('token') || '').trim();
    } else {
      const body = (await context.request.json().catch(() => ({}))) as { trackingToken?: string; token?: string };
      trackingToken = String(body.trackingToken || body.token || '').trim();
    }

    if (trackingToken.length < MIN_TOKEN_LEN) {
      return jsonResponse({ success: false, error: 'Invalid tracking token' }, 400);
    }

    const found = await findOrderByTrackingToken(trackingToken, context.env);
    if (!found.ok || !found.public) {
      return jsonResponse({ success: false, error: 'Order not found' }, 404);
    }

    return jsonResponse({
      success: true,
      order: found.public,
    });
  } catch (error: any) {
    console.error('[order-lookup]', error);
    return jsonResponse({ success: false, error: error?.message || 'Server Error' }, 500);
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => handleLookup(context);
export const onRequestPost: PagesFunction<Env> = async (context) => handleLookup(context);
