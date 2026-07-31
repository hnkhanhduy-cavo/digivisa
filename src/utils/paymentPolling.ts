/**
 * Poll Cloudflare Pages IPN status endpoint for order payment confirmation.
 * Does not trust localStorage or simulated balance fluctuations.
 */

export interface PaymentStatusResponse {
  isPaid: boolean;
  transactionId?: string;
  amount?: number;
  paidAt?: string;
}

type PaymentCallback = (status: PaymentStatusResponse) => void;
const listeners = new Set<{ orderId: string; callback: PaymentCallback }>();

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export function subscribeToPaymentAutoCheck(
  orderId: string,
  callback: PaymentCallback
): () => void {
  const item = { orderId, callback };
  listeners.add(item);

  if (!pollingInterval) {
    pollingInterval = setInterval(() => {
      checkAllPendingPayments();
    }, 3000);
  }

  return () => {
    listeners.delete(item);
    if (listeners.size === 0 && pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  };
}

async function checkAllPendingPayments() {
  if (listeners.size === 0) return;

  for (const item of Array.from(listeners)) {
    const { orderId, callback } = item;
    try {
      const apiRes = await fetch(`/api/9pay-webhook?orderId=${encodeURIComponent(orderId)}`);
      if (!apiRes.ok) continue;
      const apiData = (await apiRes.json()) as {
        isPaid?: boolean;
        payment_no?: string | null;
      };
      if (apiData.isPaid) {
        callback({
          isPaid: true,
          transactionId: apiData.payment_no || undefined,
        });
      }
    } catch {
      // ignore transient poll errors
    }
  }
}
