/**
 * Batch inquire+verify for unpaid order IDs (cron / ops backstop).
 * Route: POST /api/9pay-sync-unpaid  body: { orderIds: string[] }
 *
 * Cloudflare Pages has no native Cron Triggers — point an external cron
 * (or a separate Worker cron) at this endpoint every ~5 minutes.
 */

import type { Env } from '../_lib/env';
import { jsonResponse } from '../_lib/env';
import { processInquireAndMarkPaid } from '../_lib/processInquirePayment';

const MAX_BATCH = 20;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const provided = context.request.headers.get('X-Sync-Secret') || '';
    if (!context.env.SYNC_SECRET || provided !== context.env.SYNC_SECRET) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = (await context.request.json()) as { orderIds?: string[] };
    const orderIds = Array.from(
      new Set((body.orderIds || []).map((id) => String(id || '').trim()).filter(Boolean))
    ).slice(0, MAX_BATCH);

    if (orderIds.length === 0) {
      return jsonResponse({ success: false, error: 'orderIds required' }, 400);
    }

    const results: Array<{ orderId: string; isPaid: boolean; status?: number; error?: string }> = [];

    for (const orderId of orderIds) {
      const res = await processInquireAndMarkPaid(context.env, orderId);
      const data = (await res.json()) as {
        isPaid?: boolean;
        status?: number;
        error?: string;
      };
      results.push({
        orderId,
        isPaid: !!data.isPaid,
        status: data.status,
        error: data.error,
      });
    }

    return jsonResponse({
      success: true,
      checked: results.length,
      paidCount: results.filter((r) => r.isPaid).length,
      results,
    });
  } catch (error: any) {
    console.error('[9Pay sync-unpaid]', error);
    return jsonResponse({ success: false, error: error?.message || 'Server Error' }, 500);
  }
};
