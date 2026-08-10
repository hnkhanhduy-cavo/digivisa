import type { Env } from './env';
import { getOrderFromFirestore, setConfirmationEmailFlagInFirestore } from './firestore';
import { buildTicketPayload } from './notify';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'DigiVisa <onboarding@resend.dev>';

/** Rough sanity check — enough to avoid posting obvious rubbish to the mail API. */
function looksLikeEmail(value?: string): boolean {
  if (!value) return false;
  const v = value.trim();
  if (!v || v.toLowerCase() === 'n/a') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatVnd(amount?: number): string {
  if (typeof amount !== 'number' || !isFinite(amount)) return '';
  return `${amount.toLocaleString('vi-VN')} ₫`;
}

/**
 * The customer never told us which language they read, so the email carries both.
 * Vietnamese first, English underneath, in one message.
 */
function buildEmailBody(payload: {
  orderId: string;
  serviceLabel: string;
  customerName: string;
  serviceDate: string;
  flightNumber?: string;
  airport?: string;
  amountVnd?: number;
  isCombo?: boolean;
}, siteUrl: string): { subject: string; html: string; text: string } {
  const amount = formatVnd(payload.amountVnd);
  const name = payload.customerName || '';

  const rows: Array<[string, string]> = [
    ['Mã đơn hàng / Order code', payload.orderId],
    ['Dịch vụ / Service', payload.serviceLabel + (payload.isCombo ? ' (Combo)' : '')],
  ];
  if (name) rows.push(['Khách hàng / Passenger', name]);
  if (payload.serviceDate) rows.push(['Ngày sử dụng / Service date', payload.serviceDate]);
  if (payload.flightNumber) rows.push(['Chuyến bay / Flight', payload.flightNumber]);
  if (payload.airport) rows.push(['Sân bay / Airport', payload.airport]);
  if (amount) rows.push(['Đã thanh toán / Paid', amount]);

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;color:#64748b;font-size:13px;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:8px 12px;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join('');

  const rowsText = rows.map(([label, value]) => `${label}: ${value}`).join('\n');

  const subject = `DigiVisa — Đã xác nhận đơn ${payload.orderId} / Order confirmed`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="background:#4f46e5;padding:20px 24px;">
        <div style="color:#ffffff;font-size:18px;font-weight:800;">DigiVisa</div>
        <div style="color:#c7d2fe;font-size:13px;margin-top:2px;">Đã nhận thanh toán · Payment received</div>
      </div>

      <div style="padding:24px;">
        <p style="margin:0 0 4px;color:#0f172a;font-size:15px;">
          Cảm ơn ${escapeHtml(name) || 'quý khách'}, chúng tôi đã nhận được thanh toán và đang xử lý đơn của bạn.
        </p>
        <p style="margin:0 0 20px;color:#64748b;font-size:13px;">
          Thank you${name ? ' ' + escapeHtml(name) : ''}, we have received your payment and your order is being processed.
        </p>

        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
          ${rowsHtml}
        </table>

        <p style="margin:20px 0 4px;color:#0f172a;font-size:14px;font-weight:600;">
          Theo dõi đơn hàng
        </p>
        <p style="margin:0 0 16px;color:#64748b;font-size:13px;line-height:1.6;">
          Đăng nhập tại <a href="${escapeHtml(siteUrl)}" style="color:#4f46e5;">${escapeHtml(siteUrl)}</a>
          rồi mở mục <strong>Đơn hàng của tôi</strong> để xem tiến độ và thông tin nhân viên đón.<br />
          Sign in at the same address and open <strong>My Orders</strong> to follow progress.
        </p>

        <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
          Vui lòng giữ lại mã đơn <strong>${escapeHtml(payload.orderId)}</strong> khi liên hệ hỗ trợ.<br />
          Please quote order code <strong>${escapeHtml(payload.orderId)}</strong> when contacting support.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    `DigiVisa — Đã nhận thanh toán / Payment received`,
    ``,
    rowsText,
    ``,
    `Theo dõi đơn: đăng nhập tại ${siteUrl} rồi mở "Đơn hàng của tôi".`,
    `Track your order: sign in at ${siteUrl} and open "My Orders".`,
    ``,
    `Giữ lại mã đơn ${payload.orderId} khi liên hệ hỗ trợ.`,
  ].join('\n');

  return { subject, html, text };
}

/**
 * Sends the customer a confirmation once payment is confirmed.
 *
 * Deliberately independent of the Lark notification: that one returns early when
 * Lark is unconfigured, and writes its own flag only when a Lark task succeeds.
 * This has its own guard field so the customer gets exactly one email even though
 * two payment paths (inquire and return-url) can both reach this point.
 *
 * Never throws — a failed email must not affect the payment result.
 */
export async function sendOrderConfirmationEmail(
  orderId: string,
  env: Env
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  try {
    if (!env.RESEND_API_KEY) {
      return { ok: true, skipped: true, reason: 'no api key' };
    }

    const order = await getOrderFromFirestore(orderId, env);
    if (!order.ok || !order.raw) {
      console.error(`[Order Email] Could not read order ${orderId}`);
      return { ok: false, reason: 'order not found' };
    }

    if (order.fields.confirmationEmailSentAt) {
      return { ok: true, skipped: true, reason: 'already sent' };
    }

    const payload = buildTicketPayload(orderId, order.raw);

    if (!looksLikeEmail(payload.customerEmail)) {
      console.error(`[Order Email] Order ${orderId} has no usable email address`);
      return { ok: true, skipped: true, reason: 'no email address' };
    }

    const siteUrl = (env.APP_BASE_URL || 'https://digivisa-7w6.pages.dev').replace(/\/$/, '');
    const { subject, html, text } = buildEmailBody(payload, siteUrl);

    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: env.ORDER_EMAIL_FROM || DEFAULT_FROM,
        to: [payload.customerEmail.trim()],
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Order Email] Resend rejected order ${orderId}:`, res.status, body);
      return { ok: false, reason: `resend ${res.status}` };
    }

    await setConfirmationEmailFlagInFirestore(orderId, new Date().toISOString(), env);
    return { ok: true };
  } catch (err) {
    console.error('[Order Email] Unexpected error:', err);
    return { ok: false, reason: 'exception' };
  }
}
