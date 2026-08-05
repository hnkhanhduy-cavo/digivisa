import type { Env } from './env';

export interface TicketPayload {
  orderId: string;
  type: string;
  serviceLabel: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceDate: string;
  flightNumber?: string;
  airport?: string;
  amountVnd: number;
  paymentStatus: string;
  status: string;
  trackingToken: string;
  createdAt: string;
  isCombo: boolean;
}

let cachedToken: string | null = null;
let cachedExpiryMs = 0;

export async function getTenantAccessToken(env: Env): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedExpiryMs - 60_000) {
    return cachedToken;
  }

  const appId = env.LARK_APP_ID;
  const appSecret = env.LARK_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('Missing LARK_APP_ID or LARK_APP_SECRET');
  }

  const domain = (env.LARK_DOMAIN || 'https://open.larksuite.com').replace(/\/$/, '');
  const res = await fetch(`${domain}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lark auth HTTP failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    code?: number;
    msg?: string;
    tenant_access_token?: string;
    expire?: number;
  };

  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Lark auth ${data.code ?? -1}: ${data.msg || 'Unknown auth error'}`);
  }

  cachedToken = data.tenant_access_token;
  const expiresInSec = typeof data.expire === 'number' ? data.expire : 7200;
  cachedExpiryMs = now + expiresInSec * 1000;
  return cachedToken;
}

export async function createLarkBaseRecord(
  payload: TicketPayload,
  env: Env
): Promise<string | undefined> {
  const token = await getTenantAccessToken(env);
  const domain = (env.LARK_DOMAIN || 'https://open.larksuite.com').replace(/\/$/, '');
  const appToken = env.LARK_BASE_APP_TOKEN;
  const tableId = env.LARK_BASE_TABLE_ID;

  if (!appToken || !tableId) {
    throw new Error('Missing LARK_BASE_APP_TOKEN or LARK_BASE_TABLE_ID');
  }

  const serviceLabelText = payload.isCombo
    ? `${payload.serviceLabel} (COMBO)`
    : payload.serviceLabel;

  const createdAtMs = new Date(payload.createdAt).getTime();

  const fields: Record<string, unknown> = {
    'Mã đơn': payload.orderId,
    'Loại dịch vụ': serviceLabelText,
    'Khách hàng': payload.customerName,
    'SĐT': payload.customerPhone,
    'Email': payload.customerEmail,
    'Ngày dịch vụ': payload.serviceDate,
    'Chuyến bay': payload.flightNumber ?? '',
    'Số tiền': payload.amountVnd,
    'Trạng thái TT': payload.paymentStatus,
    'Tạo lúc': Number.isNaN(createdAtMs) ? Date.now() : createdAtMs,
  };

  const res = await fetch(
    `${domain}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bitable HTTP failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    code?: number;
    msg?: string;
    data?: { record?: { record_id?: string; id?: string } };
  };

  if (data.code !== 0) {
    throw new Error(`Bitable ${data.code ?? -1}: ${data.msg || 'Failed to create record'}`);
  }

  return data.data?.record?.record_id || data.data?.record?.id;
}

export async function sendLarkChatMessage(payload: TicketPayload, env: Env): Promise<void> {
  const token = await getTenantAccessToken(env);
  const domain = (env.LARK_DOMAIN || 'https://open.larksuite.com').replace(/\/$/, '');
  const chatId = env.LARK_CHAT_ID;

  if (!chatId) {
    throw new Error('Missing LARK_CHAT_ID');
  }

  const formattedAmount = `${payload.amountVnd.toLocaleString('vi-VN')} ₫`;
  const titleText = `🆕 Đơn mới — ${payload.serviceLabel}${payload.isCombo ? ' (COMBO)' : ''}`;

  const elements: any[] = [
    {
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**Mã đơn:**\n${payload.orderId}` },
        },
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**Khách hàng:**\n${payload.customerName}` },
        },
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**SĐT:**\n${payload.customerPhone}` },
        },
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**Email:**\n${payload.customerEmail}` },
        },
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**Ngày dịch vụ:**\n${payload.serviceDate}` },
        },
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**Số tiền:**\n${formattedAmount}` },
        },
      ],
    },
  ];

  if (payload.flightNumber) {
    elements.push({
      tag: 'div',
      fields: [
        {
          is_short: true,
          text: { tag: 'lark_md', content: `**Chuyến bay:**\n${payload.flightNumber}` },
        },
        ...(payload.airport
          ? [
              {
                is_short: true,
                text: { tag: 'lark_md', content: `**Sân bay:**\n${payload.airport}` },
              },
            ]
          : []),
      ],
    });
  }

  const cardObject = {
    header: {
      template: 'blue',
      title: {
        tag: 'plain_text',
        content: titleText,
      },
    },
    elements,
  };

  const res = await fetch(`${domain}/open-apis/im/v1/messages?receive_id_type=chat_id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify(cardObject),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lark IM HTTP failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { code?: number; msg?: string };
  if (data.code !== 0) {
    throw new Error(`Lark IM ${data.code ?? -1}: ${data.msg || 'Failed to send message'}`);
  }
}
