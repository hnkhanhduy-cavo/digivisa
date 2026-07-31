/**
 * Deprecated fake VietQR / "I Have Transferred" modal.
 * Checkout is browser-redirect to the signed 9Pay portal URL.
 * Kept as a thin stub so accidental imports do not reintroduce forged Paid writes.
 */
import React from 'react';
import { Order } from '../types';
import { Language } from '../utils/translations';

interface NinePayModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  amountVnd: number;
  onPaymentSuccess: (orderId: string, transactionId: string) => void;
  language?: Language;
}

export default function NinePayModal({ isOpen, onClose, language = 'VI' }: NinePayModalProps) {
  if (!isOpen) return null;

  const isEn = language === 'EN';

  return (
    <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 className="font-bold text-slate-900 text-sm">
          {isEn ? 'Use 9Pay hosted checkout' : 'Thanh toán qua cổng 9Pay'}
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          {isEn
            ? 'Manual VietQR confirmation has been removed. Complete payment on the official 9Pay page after submitting your order.'
            : 'Đã gỡ xác nhận chuyển khoản thủ công. Vui lòng hoàn tất thanh toán trên trang 9Pay sau khi gửi đơn.'}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
        >
          {isEn ? 'Close' : 'Đóng'}
        </button>
      </div>
    </div>
  );
}
