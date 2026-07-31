import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Sparkles, UserPlus, LogIn, Clock, ArrowRight, UserCheck } from 'lucide-react';
import { Language } from '../utils/translations';
import { Order } from '../types';

interface PostBookingAuthModalProps {
  isOpen: boolean;
  order: Order | null;
  onCloseAsGuest: () => void;
  onOpenAuth: () => void;
  language: Language;
}

export default function PostBookingAuthModal({
  isOpen,
  order,
  onCloseAsGuest,
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
          {/* Top Badge */}
          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-full text-xs font-bold font-mono tracking-wider">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>{language === 'VI' ? 'Đã Nhận Thông Tin Đơn Hàng' : 'Booking Captured Successfully'}</span>
            </span>
          </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <h3 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight text-white">
              {language === 'VI' 
                ? '⚡ Chỉ tốn 20s thôi để lưu trữ & bảo mật đơn!' 
                : '⚡ Takes only 20s to secure your booking!'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
              {language === 'VI' ? (
                <>
                  Đơn hàng mã <span className="font-mono font-bold text-indigo-300">{order.id}</span> của bạn đã hoàn tất điền thông tin. 
                  <strong className="text-emerald-400 block mt-1">Tất cả dữ liệu bạn vừa điền sẽ được giữ nguyên 100%</strong> khi bạn tạo tài khoản hoặc đăng nhập!
                </>
              ) : (
                <>
                  Your order <span className="font-mono font-bold text-indigo-300">{order.id}</span> information is complete. 
                  <strong className="text-emerald-400 block mt-1">All filled information is 100% preserved</strong> when you create an account or sign in!
                </>
              )}
            </p>
          </div>

          {/* Value Props Bullet List */}
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

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={onOpenAuth}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer group"
            >
              <UserPlus className="h-4 w-4 text-indigo-200 group-hover:scale-110 transition-transform" />
              <span>
                {language === 'VI' 
                  ? 'Tạo Tài Khoản / Đăng Nhập Ngay (Chỉ tốn 20s thôi) ➜' 
                  : 'Create Account / Sign In Now (Takes 20s only) ➜'}
              </span>
            </button>

            <button
              onClick={onCloseAsGuest}
              className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 font-semibold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <span>{language === 'VI' ? 'Bỏ qua & Tiếp tục dưới dạng Khách vãng lai' : 'Skip & Continue as Guest'}</span>
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
