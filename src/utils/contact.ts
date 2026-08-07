// TẠM THỜI: số demo, chưa phải số thật. Thay trước khi chạy chính thức.

/** Hotline WhatsApp dạng E.164, KHÔNG có dấu +. Ví dụ: '84901234567'. */
export const WHATSAPP_HOTLINE = '84999088888';
/** Link Zalo đầy đủ: số cá nhân 'https://zalo.me/84...' hoặc OA 'https://zalo.me/<oa_id>'. */
export const ZALO_CONTACT_URL = 'https://zalo.me/84999088888';
/** Chuỗi hiển thị cho người đọc. Để rỗng nếu chưa có. */
export const HOTLINE_DISPLAY = '+84999088888';

export const hasWhatsApp = (): boolean => WHATSAPP_HOTLINE.trim().length > 0;
export const hasZalo = (): boolean => ZALO_CONTACT_URL.trim().length > 0;

/** Trả null khi chưa cấu hình. Nơi gọi PHẢI xử lý null, không được ép kiểu. */
export function buildWhatsAppChatUrl(prefillText?: string): string | null {
  if (!hasWhatsApp()) return null;
  const base = `https://wa.me/${WHATSAPP_HOTLINE.trim()}`;
  return prefillText ? `${base}?text=${encodeURIComponent(prefillText)}` : base;
}

export function buildZaloChatUrl(): string | null {
  return hasZalo() ? ZALO_CONTACT_URL.trim() : null;
}
