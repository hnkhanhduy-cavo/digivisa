/**
 * Claim guest orders (trackingToken in localStorage) onto the signed-in Firebase user.
 */

import { auth } from './firebase';
import { safeStorage } from './storage';

const TRACK_PREFIX = 'digivisa_track_';

export function listLocalTrackingTokens(): Array<{ orderId: string; trackingToken: string }> {
  const out: Array<{ orderId: string; trackingToken: string }> = [];
  try {
    if (typeof window === 'undefined' || !window.localStorage) return out;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(TRACK_PREFIX)) continue;
      const orderId = key.slice(TRACK_PREFIX.length);
      const trackingToken = window.localStorage.getItem(key);
      if (orderId && trackingToken && trackingToken.length >= 32) {
        out.push({ orderId, trackingToken });
      }
    }
  } catch {
    /* storage blocked */
  }
  return out;
}

export async function claimOrderByTrackingToken(
  trackingToken: string
): Promise<{ ok: boolean; orderId?: string; status: number; error?: string; alreadyClaimed?: boolean }> {
  const user = auth.currentUser;
  if (!user) {
    return { ok: false, status: 401, error: 'Not signed in' };
  }
  const idToken = await user.getIdToken();
  const res = await fetch('/api/order-claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackingToken, idToken }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    orderId?: string;
    error?: string;
    alreadyClaimed?: boolean;
  };
  return {
    ok: !!data.success && res.ok,
    orderId: data.orderId,
    status: res.status,
    error: data.error,
    alreadyClaimed: data.alreadyClaimed,
  };
}

/**
 * Claim every digivisa_track_* token in localStorage for the current user.
 * 409 (owned by someone else) is skipped; token kept so the rightful owner can still use it elsewhere.
 */
export async function claimPendingOrdersFromLocalStorage(
  preferOrderIds?: string[]
): Promise<{ claimed: string[]; conflicts: string[]; errors: string[] }> {
  const claimed: string[] = [];
  const conflicts: string[] = [];
  const errors: string[] = [];

  if (!auth.currentUser) {
    return { claimed, conflicts, errors };
  }

  let entries = listLocalTrackingTokens();
  if (preferOrderIds?.length) {
    const prefer = new Set(preferOrderIds);
    entries = [
      ...entries.filter((e) => prefer.has(e.orderId)),
      ...entries.filter((e) => !prefer.has(e.orderId)),
    ];
  }

  // Dedupe by trackingToken
  const seen = new Set<string>();
  for (const { orderId, trackingToken } of entries) {
    if (seen.has(trackingToken)) continue;
    seen.add(trackingToken);
    try {
      const result = await claimOrderByTrackingToken(trackingToken);
      if (result.ok && result.orderId) {
        claimed.push(result.orderId);
      } else if (result.status === 409) {
        conflicts.push(orderId);
      } else if (!result.ok) {
        errors.push(result.error || `claim failed for ${orderId}`);
      }
    } catch (e: any) {
      errors.push(e?.message || `claim failed for ${orderId}`);
    }
  }

  return { claimed, conflicts, errors };
}

/** Convenience: read token for one order id from safeStorage. */
export function getLocalTrackingToken(orderId: string): string | null {
  return safeStorage.getItem(`${TRACK_PREFIX}${orderId}`);
}
