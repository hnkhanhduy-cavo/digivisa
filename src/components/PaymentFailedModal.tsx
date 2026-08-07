import React from 'react';
import { AlertTriangle, RefreshCw, X, ArrowRight } from 'lucide-react';
import { Order } from '../types';
import { Language } from '../utils/translations';

export interface PaymentFailedModalProps {
  isOpen: boolean;
  order: Order | null;
  orderId?: string;
  reason?: 'cancelled' | 'unconfirmed' | 'error';
  isRetrying?: boolean;
  onRetry: () => void;
  onDismiss: () => void;
  language?: Language;
}

export default function PaymentFailedModal({
  isOpen,
  order,
  orderId,
  reason = 'unconfirmed',
  isRetrying = false,
  onRetry,
  onDismiss,
  language = 'VI',
}: PaymentFailedModalProps) {
  const isEn = language === 'EN';

  if (!isOpen) return null;

  const displayOrderId = order?.id || orderId || 'N/A';

  const titleText =
    reason === 'cancelled'
      ? isEn
        ? 'Payment Cancelled'
        : 'Bạn đã huỷ thanh toán'
      : reason === 'unconfirmed'
      ? isEn
        ? 'Payment Not Confirmed'
        : 'Chưa xác nhận được thanh toán'
      : isEn
      ? 'Payment Incomplete'
      : 'Thanh toán chưa hoàn tất';

  return (
    <div className="fixed inset-0 z-[280] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7 text-slate-800 space-y-5 animate-scale-up">
        {/* Glow Banners */}
        <div className="absolute -top-12 -left-12 w-36 h-36 bg-rose-400/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Top Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-16 h-16 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center justify-center text-rose-600 shadow-md shadow-rose-500/20">
            <AlertTriangle className="h-9 w-9 text-rose-500" />
          </div>

          <span className="text-[10px] uppercase font-extrabold tracking-widest text-rose-800 bg-rose-100/90 px-3 py-1 rounded-full border border-rose-200">
            ⚠️ {titleText}
          </span>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight font-display text-slate-900 leading-snug">
            {titleText}
          </h2>

          <p className="text-xs text-slate-600 max-w-md leading-relaxed">
            {isEn
              ? 'Your order is safe and no money has been charged. You can pay again at any time from My Orders.'
              : 'Đơn hàng của bạn vẫn được giữ nguyên, chưa bị trừ tiền. Bạn có thể thanh toán lại bất cứ lúc nào trong mục Đơn hàng của tôi.'}
          </p>
        </div>

        {/* Order Reference Card */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-2 shadow-inner text-center">
          <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">
            {isEn ? 'Order Reference Code:' : 'Mã đơn hàng của bạn:'}
          </span>
          <strong className="font-mono font-black text-indigo-700 text-lg tracking-wide block">
            {displayOrderId}
          </strong>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>{isEn ? 'Redirecting to 9Pay…' : 'Đang chuyển sang 9Pay…'}</span>
              </>
            ) : (
              <>
                <span>{isEn ? 'Try payment again' : 'Thanh toán lại'}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onDismiss}
            disabled={isRetrying}
            className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <span>{isEn ? 'Maybe later' : 'Để sau'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
