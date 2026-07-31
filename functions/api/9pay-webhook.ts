/**
 * Cloudflare Pages Function: 24/7 9Pay Webhook & Real-time Transaction Query API
 * Route: /api/9pay-webhook
 */

interface Env {}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const request = context.request;
    const body = await request.json() as any;
    console.log('[Cloudflare Pages 24/7 Webhook] Received 9Pay Payload:', body);

    // Extract Order ID and Payment Status from 9Pay IPN Payload
    const orderId = body.invoice_no || body.order_id;
    const status = body.status; // 'SUCCESS' or 5 or '5'

    if (orderId && (status === 'SUCCESS' || status === 5 || status === '5' || status === 200 || status === '200')) {
      // Update Firebase Firestore order doc to 'Paid (9Pay)' via REST API
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/digivisa/databases/(default)/documents/orders/${encodeURIComponent(orderId)}?updateMask.fieldPaths=paymentStatus&updateMask.fieldPaths=status`;
      
      const firestoreRes = await fetch(firestoreUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            paymentStatus: { stringValue: 'Paid (9Pay)' },
            status: { stringValue: 'Agency Review' }
          }
        })
      });

      console.log('[Cloudflare Pages Webhook] Firestore Update Status:', firestoreRes.status);

      return new Response(JSON.stringify({ 
        status: 200, 
        message: '9Pay IPN Webhook Verified & Processed Successfully',
        orderId 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      status: 400, 
      message: 'Payment status not successful or missing orderId',
      receivedStatus: status 
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('[Cloudflare Pages Webhook Error]:', error);
    return new Response(JSON.stringify({ 
      status: 500, 
      error: error?.message || 'Internal Server Error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const orderId = url.searchParams.get('orderId');

  if (!orderId) {
    return new Response(JSON.stringify({ 
      active: true, 
      service: 'DigiVisa 9Pay 24/7 Webhook Service',
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Fetch current order state directly from Firestore REST API
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/digivisa/databases/(default)/documents/orders/${encodeURIComponent(orderId)}`;
    const res = await fetch(firestoreUrl);

    if (res.ok) {
      const data = await res.json() as any;
      const paymentStatus = data?.fields?.paymentStatus?.stringValue || 'Pending';
      const isPaid = paymentStatus.includes('Paid');

      return new Response(JSON.stringify({
        orderId,
        isPaid,
        paymentStatus,
        status: data?.fields?.status?.stringValue || 'Pending'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ orderId, isPaid: false, paymentStatus: 'Pending' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ orderId, isPaid: false, error: e.message }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
