import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, UserPlus, X } from 'lucide-react';
import { Language } from '../utils/translations';
import { Order } from '../types';

interface PostBookingAuthModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onOpenAuth: () => void;
  language: Language;
}

export default function PostBookingAuthModal({
  isOpen,
  order,
  onClose,
  onOpenAuth,
  language,
}: PostBookingAuthModalProps) {
  if (!isOpen || !order) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 text-white"
        >
          {/* Top Right Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-full text-xs font-bold font-mono tracking-wider">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>{language === 'VI' ? 'Yêu Cầu Tài Khoản Thanh Toán' : 'Account Required For Payment'}</span>
            </span>
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight text-white">
              {language === 'VI'
                ? '⚡ Đăng ký / Đăng nhập để hoàn tất thanh toán!'
                : '⚡ Sign up / Sign in to complete payment!'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
              {language === 'VI' ? (
                <>
                  Để bảo mật thông tin hộ chiếu và tiến hành thanh toán 9Pay cho đơn mã{' '}
                  <span className="font-mono font-bold text-indigo-300">{order.id}</span>, quý khách vui lòng tạo tài khoản hoặc đăng nhập.
                </>
              ) : (
                <>
                  To secure your passport information and proceed with 9Pay payment for order{' '}
                  <span className="font-mono font-bold text-indigo-300">{order.id}</span>, please create an account or sign in.
                </>
              )}
            </p>
          </div>

          <div className="my-6 p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2.5 text-xs">
            <div className="flex items-center space-x-2 text-slate-200">
              <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold shrink-0">✓</span>
              <span>{language === 'VI' ? 'Theo dõi tiến độ duyệt công văn & xe đón thời gian thực.' : 'Real-time approval & chauffeur tracking.'}</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-200">
              <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold shrink-0">✓</span>
              <span>{language === 'VI' ? 'Nhận e-visa & vé điện tử ngay trong bảng điều khiển cá nhân.' : 'Receive e-visas & tickets directly in your portal.'}</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-200">
              <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold shrink-0">✓</span>
              <span>{language === 'VI' ? 'Không cần điền lại thông tin hộ chiếu cho các lần sau.' : 'No need to re-enter passport info next time.'}</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={onOpenAuth}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer group"
            >
              <UserPlus className="h-4 w-4 text-indigo-200 group-hover:scale-110 transition-transform" />
              <span>
                {language === 'VI'
                  ? 'Tạo Tài Khoản / Đăng Nhập Ngay ➜'
                  : 'Create Account / Sign In Now ➜'}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
