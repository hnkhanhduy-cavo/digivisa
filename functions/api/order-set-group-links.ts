/**
 * Set custom WhatsApp and Zalo group links for an order (Staff only).
 * Route: POST /api/order-set-group-links
 * Header: Authorization: Bearer <Firebase_ID_Token>
 * Body: { orderId: string, whatsappGroupUrl?: string, zaloGroupUrl?: string }
 */

import type { Env } from '../_lib/env';
import { jsonResponse } from '../_lib/env';
import { verifyFirebaseIdToken } from '../_lib/firebaseIdToken';
import { validateGroupUrl } from '../_lib/groupLinks';
import { setGroupLinksInFirestore, getOrderFromFirestore } from '../_lib/firestore';

const DEFAULT_PROJECT = 'digivisa';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const authHeader = context.request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ success: false, error: 'Authorization header missing or malformed' }, 401);
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      return jsonResponse({ success: false, error: 'Bearer token empty' }, 401);
    }

    const projectId = context.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT;
    let verified;
    try {
      verified = await verifyFirebaseIdToken(token, projectId);
    } catch (err: any) {
      return jsonResponse({ success: false, error: `Authentication failed: ${err.message || err}` }, 401);
    }

    if (verified.payload.staff !== true) {
      return jsonResponse({ success: false, error: 'Forbidden: Staff claim required' }, 403);
    }

    const body = (await context.request.json().catch(() => ({}))) as {
      orderId?: string;
      whatsappGroupUrl?: string;
      zaloGroupUrl?: string;
    };

    const orderId = String(body.orderId || '').trim();
    if (!orderId) {
      return jsonResponse({ success: false, error: 'orderId is required' }, 400);
    }

    const existing = await getOrderFromFirestore(orderId, context.env);
    if (!existing.ok) {
      return jsonResponse({ success: false, error: 'Order not found', orderId }, 404);
    }

    const hasWa = Object.prototype.hasOwnProperty.call(body, 'whatsappGroupUrl');
    const hasZa = Object.prototype.hasOwnProperty.call(body, 'zaloGroupUrl');
    if (!hasWa && !hasZa) {
      return jsonResponse({ success: false, error: 'Nothing to update' }, 400);
    }
    const links: { whatsappGroupUrl?: string; zaloGroupUrl?: string } = {};
    if (hasWa) {
      const v = validateGroupUrl(body.whatsappGroupUrl, 'whatsapp');
      if (!v.ok) return jsonResponse({ success: false, error: v.error }, 400);
      links.whatsappGroupUrl = v.url;
    }
    if (hasZa) {
      const v = validateGroupUrl(body.zaloGroupUrl, 'zalo');
      if (!v.ok) return jsonResponse({ success: false, error: v.error }, 400);
      links.zaloGroupUrl = v.url;
    }

    const saveRes = await setGroupLinksInFirestore(
      orderId,
      links,
      context.env
    );

    if (!saveRes.ok) {
      console.error('[order-set-group-links] Firestore error:', saveRes.status, saveRes.body);
      return jsonResponse(
        { success: false, error: 'Failed to update group links in Firestore', details: saveRes.body },
        502
      );
    }

    return jsonResponse({
      success: true,
      orderId,
      ...links,
      groupLinkUpdatedAt: saveRes.groupLinkUpdatedAt,
    });
  } catch (error: any) {
    console.error('[order-set-group-links] Server error:', error);
    return jsonResponse({ success: false, error: error?.message || 'Server Error' }, 500);
  }
};
