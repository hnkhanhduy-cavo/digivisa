export const WHATSAPP_GROUP_HOST = 'chat.whatsapp.com';
export const ZALO_GROUP_HOSTS = ['zalo.me', 'zalo.com.vn'];

export function validateGroupUrl(
  raw: string | null | undefined,
  kind: 'whatsapp' | 'zalo'
): { ok: true; url: string; error?: undefined } | { ok: false; error: string; url?: undefined } {
  const str = (raw || '').trim();
  if (!str) {
    return { ok: true, url: '' };
  }

  let parsed: URL;
  try {
    parsed = new URL(str);
  } catch {
    return { ok: false, error: `Invalid URL format for ${kind} group link` };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: `URL protocol must be https: for ${kind} group link` };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (kind === 'whatsapp') {
    if (hostname !== WHATSAPP_GROUP_HOST) {
      return {
        ok: false,
        error: `WhatsApp group link host must be exactly '${WHATSAPP_GROUP_HOST}'`,
      };
    }
    if (!/^\/[A-Za-z0-9_-]{6,}$/.test(parsed.pathname)) {
      return {
        ok: false,
        error: 'WhatsApp link must contain an invite code, e.g. https://chat.whatsapp.com/AbCdEf123456',
      };
    }
  } else if (kind === 'zalo') {
    if (!ZALO_GROUP_HOSTS.includes(hostname)) {
      return {
        ok: false,
        error: `Zalo group link host must be one of: ${ZALO_GROUP_HOSTS.join(', ')}`,
      };
    }
    if (!parsed.pathname.startsWith('/g/')) {
      return {
        ok: false,
        error: `Zalo group link path must start with '/g/' (e.g. https://zalo.me/g/...)`,
      };
    }
    if (parsed.pathname.replace('/g/', '').trim().length < 3) {
      return {
        ok: false,
        error: 'Zalo group link must contain a group code, e.g. https://zalo.me/g/abcdef',
      };
    }
  } else {
    return { ok: false, error: `Unknown group link kind: ${kind}` };
  }

  return { ok: true, url: parsed.toString() };
}
