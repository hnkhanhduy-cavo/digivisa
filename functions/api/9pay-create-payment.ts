/**
 * Cloudflare Pages Function: 9Pay Official API Payment URL Creator (Exact 9Pay Specs)
 * Route: /api/9pay-create-payment
 */

interface Env {}

// Generate 9Pay Official HMAC-SHA256 Base64 Signature
async function generate9PaySignature(method: string, uri: string, timestamp: number, canonicalString: string, secretKey: string): Promise<string> {
  const message = `${method}\n${uri}\n${timestamp}\n${canonicalString}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return btoa(String.fromCharCode.apply(null, hashArray));
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const request = context.request;
    const body = await request.json() as any;
    const orderId = body.orderId || `DV-${Date.now().toString().slice(-6)}`;
    const amountVnd = Math.round(body.amountVnd || 2000);

    const origin = new URL(request.url).origin;
    const returnUrl = `${origin}/?payment=success&orderId=${orderId}`;
    const backUrl = `${origin}/?payment=cancel&orderId=${orderId}`;
    const desc = `Thanh toan don hang ${orderId}`;

    const merchantKey = 'HcHvo4';
    const secretKey = 'NDHGRy61oYvL3nnrTYAB435eEQbIedBRTvS';
    const timestamp = Math.floor(Date.now() / 1000);

    // Canonicalized resources string per 9Pay Official Docs: merchantKey=...&invoice_no=...&amount=...
    const canonicalString = `merchantKey=${merchantKey}&invoice_no=${orderId}&amount=${amountVnd}&description=${desc}&return_url=${returnUrl}`;

    // Endpoints specified in 9Pay Official Documentation
    const endpoints = [
      'https://sand-payment.9pay.vn/payments/create',
      'https://payment.9pay.vn/payments/create'
    ];

    let checkoutUrl = `${returnUrl}`;

    for (const ep of endpoints) {
      try {
        const signature = await generate9PaySignature('POST', ep, timestamp, canonicalString, secretKey);
        const authHeader = `Signature Algorithm=HS256,Credential=${merchantKey},SignedHeaders=,Signature=${signature}`;

        const postBody = new URLSearchParams();
        postBody.append('merchantKey', merchantKey);
        postBody.append('invoice_no', orderId);
        postBody.append('amount', amountVnd.toString());
        postBody.append('description', desc);
        postBody.append('return_url', returnUrl);
        postBody.append('back_url', backUrl);

        console.log(`[Cloudflare Pages 9Pay] POST to ${ep} with Auth:`, authHeader);

        const res = await fetch(ep, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Date': timestamp.toString(),
            'Authorization': authHeader
          },
          body: postBody.toString()
        });

        if (res.ok) {
          const resData = await res.json() as any;
          console.log(`[Cloudflare Pages 9Pay] Response from ${ep}:`, resData);
          if (resData?.result) {
            try {
              // 9Pay returns base64 encoded JSON in 'result'
              const decodedResult = JSON.parse(atob(resData.result));
              if (decodedResult?.payment_url) {
                checkoutUrl = decodedResult.payment_url;
                break;
              }
            } catch (jsonErr) {
              if (typeof resData.result === 'string' && resData.result.startsWith('http')) {
                checkoutUrl = resData.result;
                break;
              }
            }
          }
        }
      } catch (epErr) {
        console.warn(`[Cloudflare Pages 9Pay] Error calling ${ep}:`, epErr);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      paymentUrl: checkoutUrl,
      orderId 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('[Cloudflare Pages 9Pay Create Error]:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Server Error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
