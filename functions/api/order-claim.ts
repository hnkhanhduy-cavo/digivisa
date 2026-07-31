/**
 * Claim a guest order onto the signed-in Firebase user.
 * Route: POST /api/order-claim
 * Body: { trackingToken: string, idToken: string }
 *
 * Verifies idToken server-side; SA PATCHes userId (rules block client self-attach).
 */

import type { Env } from '../_lib/env';
import { jsonResponse } from '../_lib/env';
import { verifyFirebaseIdToken } from '../_lib/firebaseIdToken';
import { findOrderByTrackingToken, claimOrderUserInFirestore } from '../_lib/firestore';

const MIN_TOKEN_LEN = 32;
const DEFAULT_PROJECT = 'digivisa';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json().catch(() => ({}))) as {
      trackingToken?: string;
      idToken?: string;
    };
    const trackingToken = String(body.trackingToken || '').trim();
    const idToken = String(body.idToken || '').trim();

    if (trackingToken.length < MIN_TOKEN_LEN) {
      return jsonResponse({ success: false, error: 'Invalid tracking token' }, 400);
    }
    if (!idToken) {
      return jsonResponse({ success: false, error: 'idToken required' }, 400);
    }

    const projectId = context.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT;

    let uid: string;
    let email: string | undefined;
    try {
      const verified = await verifyFirebaseIdToken(idToken, projectId);
      uid = verified.uid;
      email = verified.email;
    } catch (e: any) {
      console.warn('[order-claim] idToken verify failed:', e?.message);
      return jsonResponse({ success: false, error: 'Invalid or expired idToken' }, 401);
    }

    const found = await findOrderByTrackingToken(trackingToken, context.env);
    if (!found.ok || !found.orderId) {
      return jsonResponse({ success: false, error: 'Order not found' }, 404);
    }

    const existingUid = found.userId?.trim();
    if (existingUid && existingUid !== uid) {
      return jsonResponse({
        success: false,
        error: 'Order already claimed by another account',
        orderId: found.orderId,
      }, 409);
    }

    if (existingUid && existingUid === uid) {
      return jsonResponse({
        success: true,
        orderId: found.orderId,
        alreadyClaimed: true,
      });
    }

    const write = await claimOrderUserInFirestore(found.orderId, uid, email, context.env);
    if (!write.ok) {
      console.error('[order-claim] Firestore patch failed:', write.status, write.body);
      return jsonResponse({
        success: false,
        error: 'Failed to claim order',
        firestoreStatus: write.status,
      }, 502);
    }

    return jsonResponse({
      success: true,
      orderId: found.orderId,
    });
  } catch (error: any) {
    console.error('[order-claim]', error);
    return jsonResponse({ success: false, error: error?.message || 'Server Error' }, 500);
  }
};
