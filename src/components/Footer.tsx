import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { safeOpen } from '../utils/storage';
import { Language, TRANSLATIONS } from '../utils/translations';
import { hasWhatsApp, hasZalo, buildWhatsAppChatUrl, buildZaloChatUrl, HOTLINE_DISPLAY } from '../utils/contact';

interface FooterProps {
  language: Language;
}

export default function Footer({ language }: FooterProps) {
  const t = TRANSLATIONS[language];
  const isEn = language === 'EN';

  const showWa = hasWhatsApp();
  const showZa = hasZalo();
  const waUrl = buildWhatsAppChatUrl();
  const zaUrl = buildZaloChatUrl();

  return (
    <footer className="bg-white border-t border-slate-100 py-10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6">
          
          {/* Brand & Security */}
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start space-x-2">
              <span className="font-display font-extrabold tracking-tight text-lg text-slate-900">DIGIVISA</span>
              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase">
                PORTAL
              </span>
            </div>
          </div>

          {/* Quick legal/Policies & Chat support */}
          <div className="flex flex-col items-center md:items-start gap-2.5">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-xs text-slate-400 font-medium">
              <a href="#privacy" className="hover:text-indigo-600 transition-colors">
                {isEn ? 'Privacy Policy' : 'Chính sách bảo mật'}
              </a>
              <span className="hidden sm:inline">•</span>
              <a href="#terms" className="hover:text-indigo-600 transition-colors">
                {isEn ? 'Terms of Service' : 'Điều khoản dịch vụ'}
              </a>
              <span className="hidden sm:inline">•</span>
              <span className="text-slate-500 font-semibold flex items-center">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                {isEn ? '24/7 Priority Support' : 'Hỗ trợ Ưu tiên 24/7'}
              </span>
            </div>
            {(showWa || showZa) && (
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-[11px] text-slate-500">
                <span className="font-sans font-medium">{isEn ? 'Chat/Contact Support:' : 'Trò chuyện / Liên hệ:'}</span>
                {showWa && waUrl && (
                  <span onClick={() => safeOpen(waUrl, '_blank')} className="flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition-all cursor-pointer select-none">
                    {HOTLINE_DISPLAY ? `WhatsApp: ${HOTLINE_DISPLAY}` : 'WhatsApp'}
                  </span>
                )}
                {showZa && zaUrl && (
                  <span onClick={() => safeOpen(zaUrl, '_blank')} className="flex items-center gap-1 font-bold text-sky-600 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-md hover:bg-sky-100 transition-all cursor-pointer select-none">
                    {HOTLINE_DISPLAY ? `Zalo: ${HOTLINE_DISPLAY}` : 'Zalo'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* User count pill indicator */}
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-full shadow-sm">
            <div className="flex -space-x-1.5">
              <div className="w-5 h-5 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[8px] font-bold text-slate-500">A</div>
              <div className="w-5 h-5 rounded-full bg-indigo-100 border border-white flex items-center justify-center text-[8px] font-bold text-indigo-600">B</div>
              <div className="w-5 h-5 rounded-full bg-indigo-600 border border-white flex items-center justify-center text-[8px] font-bold text-white">✓</div>
            </div>
            <span className="text-[10px] text-slate-500 font-medium font-sans">
              {isEn ? (
                <span>Joined by <strong className="text-slate-800">4,000+</strong> global travelers today</span>
              ) : (
                <span>Hơn <strong className="text-slate-800">4,000+</strong> khách hàng sử dụng hôm nay</span>
              )}
            </span>
          </div>

        </div>

        {/* Divider */}
        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 font-sans">
          <p>{isEn ? '© 2026 DigiVisa Global Partners. Independent clearing agency.' : '© 2026 DigiVisa Global Partners. Đại lý ủy thác độc lập.'}</p>
        </div>
      </div>
    </footer>
  );
}
