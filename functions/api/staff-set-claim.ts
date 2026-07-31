/**
 * Bootstrap staff custom claim (ops only).
 * Route: POST /api/staff-set-claim
 * Header: X-Sync-Secret: <SYNC_SECRET>
 * Body: { "uid": "..." } or { "email": "..." }
 *
 * Sets Firebase Auth custom claim { staff: true }. User must re-login / refresh token.
 */

import type { Env } from '../_lib/env';
import { jsonResponse } from '../_lib/env';
import { getAccessToken } from '../_lib/googleAuth';

const DEFAULT_PROJECT = 'digivisa';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const provided = context.request.headers.get('X-Sync-Secret') || '';
    if (!context.env.SYNC_SECRET || provided !== context.env.SYNC_SECRET) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = (await context.request.json()) as { uid?: string; email?: string };
    const project = context.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT;
    const accessToken = await getAccessToken(context.env);

    let uid = String(body.uid || '').trim();
    const email = String(body.email || '').trim();

    if (!uid && email) {
      const lookupRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ email: [email] }),
        }
      );
      const lookup = (await lookupRes.json()) as { users?: Array<{ localId?: string }> };
      if (!lookupRes.ok || !lookup.users?.[0]?.localId) {
        return jsonResponse({ success: false, error: 'User not found for email' }, 404);
      }
      uid = lookup.users[0].localId;
    }

    if (!uid) {
      return jsonResponse({ success: false, error: 'uid or email required' }, 400);
    }

    const updateRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:update`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          localId: uid,
          customAttributes: JSON.stringify({ staff: true }),
        }),
      }
    );

    const updateText = await updateRes.text();
    if (!updateRes.ok) {
      console.error('[staff-set-claim]', updateRes.status, updateText);
      return jsonResponse({
        success: false,
        error: 'Failed to set custom claim',
        details: updateText,
      }, 502);
    }

    return jsonResponse({
      success: true,
      uid,
      claim: { staff: true },
      message: 'Staff claim set. User must refresh ID token (re-login) before OMS access.',
    });
  } catch (error: any) {
    console.error('[staff-set-claim]', error);
    return jsonResponse({ success: false, error: error?.message || 'Server Error' }, 500);
  }
};
