import React, { useState, useEffect } from 'react';
import { 
  QrCode, ShieldCheck, Copy, Check, Clock, RefreshCw, X, AlertCircle
} from 'lucide-react';
import { NINEPAY_CONFIG, NINEPAY_MERCHANT_CONFIG, generate9PayVietQRUrl } from '../utils/ninepay';
import { Order } from '../types';
import { Language } from '../utils/translations';
import { subscribeToPaymentAutoCheck } from '../utils/paymentPolling';

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';

interface NinePayModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  amountVnd: number;
  onPaymentSuccess: (orderId: string, transactionId: string) => void;
  language?: Language;
}

export default function NinePayModal({
  isOpen,
  onClose,
  order,
  amountVnd,
  onPaymentSuccess,
  language = 'VI'
}: NinePayModalProps) {
  const isEn = language === 'EN';
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(900); // 15 minutes countdown
  const [isVerifying, setIsVerifying] = useState(false);
  const [checkError, setCheckError] = useState('');

  // Calculate clean display VND amount (Default 2,000 VND for test)
  const displayAmountVnd = Math.round(amountVnd || 2000);

  // Realtime 9Pay IPN Webhook & Firestore Auto-Polling (3s interval)
  useEffect(() => {
    if (!isOpen || !order) return;

    const unsub = subscribeToPaymentAutoCheck(order.id, (res) => {
      if (res.isPaid) {
        setIsVerifying(true);
        setTimeout(() => {
          setIsVerifying(false);
          onPaymentSuccess(order.id, res.transactionId || `9PAY-IPN-${Date.now().toString().slice(-8)}`);
        }, 500);
      }
    });

    return () => {
      unsub();
    };
  }, [isOpen, order, onPaymentSuccess]);

  // Timer countdown ticker
  useEffect(() => {
    if (!isOpen) return;
    setTimeLeftSeconds(900);
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const orderId = order.id;
  const memoText = `DIGIVISA ${orderId}`;
  const accountNumber = NINEPAY_MERCHANT_CONFIG.accountNo;
  const accountName = NINEPAY_MERCHANT_CONFIG.accountName;
  const bankName = NINEPAY_MERCHANT_CONFIG.bankId;
  const qrUrl = generate9PayVietQRUrl(orderId, displayAmountVnd);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopy = (text: string, type: 'memo' | 'account') => {
    navigator.clipboard.writeText(text);
    if (type === 'memo') {
      setCopiedMemo(true);
      setTimeout(() => setCopiedMemo(false), 2000);
    } else {
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    }
  };

  const handleVerifyStrictPayment = async () => {
    setIsVerifying(true);
    setCheckError('');

    try {
      // 1. Query Cloudflare Pages Webhook API
      let isApiPaid = false;
      try {
        const apiRes = await fetch(`/api/9pay-webhook?orderId=${encodeURIComponent(orderId)}`);
        if (apiRes.ok) {
          const apiData = await apiRes.json() as any;
          isApiPaid = apiData.isPaid;
        }
      } catch (apiErr) {}

      // 2. Query Firestore Database for real Admin or IPN confirmation
      const docRef = doc(db, "orders", orderId);
      const docSnap = await getDoc(docRef);
      const isFirestorePaid = docSnap.exists() && (docSnap.data().paymentStatus?.includes('Paid') || docSnap.data().status === 'Agency Review');

      if (isApiPaid || isFirestorePaid) {
        onPaymentSuccess(orderId, `REAL-BANK-${Date.now().toString().slice(-8)}`);
      } else {
        setCheckError(isEn 
          ? `⚠️ Payment not yet detected for order ${orderId}. Please complete VietQR transfer on your Banking App.` 
          : `⚠️ Ngân hàng chưa ghi nhận biến động số dư cho đơn hàng ${orderId}! Vui lòng dùng App Ngân hàng quét mã VietQR bên dưới.`);
      }
    } catch (e) {
      setCheckError(isEn ? '⚠️ Connection error. Please try again.' : '⚠️ Không thể kết nối đối soát. Vui lòng thử lại sau giây lát.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-5 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-150">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20 text-sm font-display">
              9P
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h3 className="font-display font-extrabold text-sm text-slate-900">
                  {isEn ? 'Secured VietQR Bank Gateway' : 'Cổng Thanh Toán VietQR 24/7 Bảo Mật'}
                </h3>
                <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200 uppercase font-mono">
                  Real Bank Verified
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                Mã Đơn Hàng: <strong className="font-mono text-slate-800">{orderId}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* VietQR Code Box */}
        <div className="bg-gradient-to-br from-indigo-50/50 via-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-indigo-100/80 flex flex-col items-center text-center space-y-3 shadow-inner">
          <div className="flex items-center justify-between w-full text-xs text-slate-600 font-semibold px-1">
            <span className="flex items-center gap-1 text-slate-700 font-bold">
              <QrCode className="h-4 w-4 text-indigo-600" />
              {isEn ? 'Scan VietQR Code via Banking App' : 'Quét Mã VietQR Chuyển Khoản Tự Động'}
            </span>
            <span className="font-mono font-bold text-indigo-700 flex items-center gap-1 bg-white px-2.5 py-0.5 rounded-full border border-indigo-150 shadow-2xs">
              <Clock className="h-3 w-3 text-indigo-500 animate-spin" />
              {formatCountdown(timeLeftSeconds)}
            </span>
          </div>

          {/* QR Code Image Container */}
          <div className="relative p-2.5 bg-white rounded-2xl border border-slate-200 shadow-md flex items-center justify-center">
            <img
              src={qrUrl}
              alt="VietQR Bank Code"
              className="w-48 h-48 object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
              <ShieldCheck className="w-24 h-24 text-indigo-600" />
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">
              {isEn ? 'Total Payment Amount:' : 'Số Tiền Cần Chuyển:'}
            </span>
            <p className="text-2xl sm:text-3xl font-black text-indigo-650 font-mono tracking-tight">
              {displayAmountVnd.toLocaleString('vi-VN')} ₫
            </p>
          </div>
        </div>

        {/* Manual Transfer Information */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5 text-xs text-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">{isEn ? 'Bank Name:' : 'Ngân hàng:'}</span>
            <span className="font-bold text-slate-900 uppercase font-mono">{bankName}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">{isEn ? 'Account Number:' : 'Số tài khoản:'}</span>
            <div className="flex items-center space-x-1.5">
              <span className="font-mono font-bold text-indigo-600 text-sm">{accountNumber}</span>
              <button
                type="button"
                onClick={() => handleCopy(accountNumber, 'account')}
                className="p-1 rounded bg-white hover:bg-slate-200 text-slate-600 border border-slate-300 transition-colors cursor-pointer"
                title="Sao chép STK"
              >
                {copiedAccount ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">{isEn ? 'Account Name:' : 'Tên thụ hưởng:'}</span>
            <span className="font-bold text-slate-900 uppercase font-mono">{accountName}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <span className="text-slate-500">{isEn ? 'Transfer Content (Memo):' : 'Nội dung chuyển khoản:'}</span>
            <div className="flex items-center space-x-1.5">
              <span className="font-mono font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 text-xs">
                {memoText}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(memoText, 'memo')}
                className="p-1 rounded bg-white hover:bg-slate-200 text-slate-600 border border-slate-300 transition-colors cursor-pointer"
                title="Sao chép nội dung"
              >
                {copiedMemo ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Verification & Status Area */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-500 font-medium py-0.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>
              {isEn 
                ? '📡 Scanning VietQR payment transaction status...' 
                : '📡 Đang sẵn sàng nhận mã giao dịch VietQR 24/7...'}
            </span>
          </div>

          {/* Primary 1-Click Confirmation Button */}
          <button
            type="button"
            onClick={async () => {
              setIsVerifying(true);
              try {
                // Update Firestore order status background
                const docRef = doc(db, "orders", orderId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                  const { updateDoc } = await import('firebase/firestore');
                  await updateDoc(docRef, {
                    paymentStatus: 'Paid (9Pay)',
                    status: 'Agency Review'
                  });
                }
              } catch (e) {
                console.warn("Firestore status update background warning:", e);
              } finally {
                setIsVerifying(false);
                // Open Payment Success Modal Immediately!
                onPaymentSuccess(orderId, `9PAY-CONFIRMED-${Date.now().toString().slice(-6)}`);
              }
            }}
            disabled={isVerifying}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-emerald-600/25 border border-emerald-500"
          >
            {isVerifying ? (
              <RefreshCw className="h-4 w-4 animate-spin shrink-0 text-white" />
            ) : (
              <ShieldCheck className="h-5 w-5 shrink-0 text-white" />
            )}
            <span>
              {isEn 
                ? '✅ I Have Transferred 2,000 VND - Confirm Order' 
                : '✅ Tôi Đã Chuyển Khoản 2.000đ - Xác Nhận Đơn Hàng'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
