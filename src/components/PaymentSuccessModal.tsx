import React from 'react';
import { 
  CheckCircle, ShieldCheck, Download, Printer, ArrowRight, FileText, Check, Award, Building2, Sparkles, X 
} from 'lucide-react';
import { Order } from '../types';
import { Language } from '../utils/translations';

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  transactionId?: string;
  onTrackOrder: (orderId: string) => void;
  language?: Language;
}

export default function PaymentSuccessModal({
  isOpen,
  onClose,
  order,
  transactionId = '9PAY-88491023',
  onTrackOrder,
  language = 'VI'
}: PaymentSuccessModalProps) {
  const isEn = language === 'EN';

  if (!isOpen || !order) return null;

  const d = order.details as any;
  const custName = (d.passengerName || d.fullName || `${d.firstName || ''} ${d.lastName || ''}`).trim().toUpperCase();
  const passport = d.passportNumber || 'N/A';
  const amountStr = order.details.totalFee ? `$${order.details.totalFee}` : 'Thanh Toán Thành Công';

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-x-hidden max-h-[90dvh] overflow-y-auto p-6 sm:p-7 text-slate-800 space-y-5 animate-scale-up">
        {/* Confetti Banner */}
        <div className="absolute -top-12 -left-12 w-36 h-36 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Top Success Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-center justify-center text-emerald-600 shadow-md shadow-emerald-500/20 animate-bounce">
            <CheckCircle className="h-9 w-9 text-emerald-500" />
          </div>

          <span className="text-[10px] uppercase font-extrabold tracking-widest text-emerald-800 bg-emerald-100/90 px-3 py-1 rounded-full border border-emerald-200">
            ⚡ {isEn ? 'Payment Confirmed by 9Pay Gateway' : 'Xác Nhận Thanh Toán Thành Công Qua 9Pay'}
          </span>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight font-display text-slate-900 leading-snug">
            {isEn ? '🏆 Order Authorized & Active!' : '🏆 Đơn Hàng Đã Được Kích Hoạt!'}
          </h2>

          <p className="text-xs text-slate-500 max-w-md leading-relaxed">
            {isEn 
              ? 'Thank you! Your payment has been authorized. The clearance ticket is now active and routed to the Immigration Operations Board.' 
              : 'Cảm ơn quý khách! Đơn hàng đã được thanh toán thành công và chuyển thẳng sang Đội Vận Hành Cục Xuất Nhập Cảnh để xử lý.'}
          </p>
        </div>

        {/* Electronic Receipt Card */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-inner">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {isEn ? 'ELECTRONIC RECEIPT' : 'BIÊN LAI ĐIỆN TỬ BẢO MẬT'}
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
              PAID (9PAY)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block">{isEn ? 'Order ID:' : 'Mã đơn hàng:'}</span>
              <strong className="font-mono font-bold text-indigo-700 text-sm">{order.id}</strong>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-semibold block">{isEn ? 'Transaction Ref:' : 'Mã giao dịch 9Pay:'}</span>
              <strong className="font-mono text-slate-800 text-xs truncate block">{transactionId}</strong>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-semibold block">{isEn ? 'Passenger Name:' : 'Họ tên hành khách:'}</span>
              <strong className="text-slate-900 font-bold text-xs truncate block">{custName}</strong>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-semibold block">{isEn ? 'Passport Number:' : 'Số Hộ chiếu:'}</span>
              <strong className="font-mono text-slate-800 text-xs block">{passport}</strong>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-mono">
            <span className="text-xs text-slate-500 font-sans font-medium">{isEn ? 'Payment Gate:' : 'Cổng thanh toán:'}</span>
            <span className="text-xs font-bold text-indigo-700">9Pay Merchant (HcHvo4)</span>
          </div>
        </div>

        {/* Next Step Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              onTrackOrder(order.id);
            }}
            className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>{isEn ? '📋 Track Application Status Live' : '📋 Tra Cứu Tiến Độ Đơn Hàng Ngay'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              <span>{isEn ? 'Print Receipt' : 'In Biên Lai'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <span>{isEn ? 'Close Window' : 'Đóng Cửa Sổ'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
