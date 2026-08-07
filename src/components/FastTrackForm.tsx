import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, PlaneTakeoff, ShieldCheck, Clock, Users, 
  HelpCircle, Sparkles, Smile, MessageSquare, CreditCard, Globe, FileText,
  Upload, BadgeCheck, ShieldAlert, Lock
} from 'lucide-react';
import { FastTrackBooking, Currency, CURRENCY_SYMBOLS, EXCHANGE_RATES, Order } from '../types';
import { Language } from '../utils/translations';
import HistoricalAutofill from './HistoricalAutofill';
import { TimePicker } from './TimePicker';
import { HistoricalProfile } from '../data/historicalUsers';
import { safeStorage, safeOpen } from '../utils/storage';
import { isValidEmail, isValidInternationalPhone, isValidTaxCode, isValidFlightNumber, sanitizeFlightNumber, formatPhoneE164, getTodayOffsetStr } from '../utils/validation';
import { generateOrderId, generateTrackingToken } from '../utils/orderIds';
interface FastTrackFormProps {
  currency: Currency;
  onSuccess: (newOrder: Order) => Promise<boolean | void> | boolean | void;
  onCancel: () => void;
  language?: Language;
  orders?: Order[];
}

export default function FastTrackForm({ currency, onSuccess, onCancel, language = 'EN', orders }: FastTrackFormProps) {
  const isEn = language === 'EN';

  const initialDraft = React.useMemo(() => {
    try {
      const saved = safeStorage.getItem('digivisa_fasttrack_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.formData && typeof parsed.formData === 'object' && parsed.formData.packageType) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse initial fasttrack draft:', e);
    }
    safeStorage.removeItem('digivisa_fasttrack_draft');
    return null;
  }, []);

  const [formData, setFormData] = useState<Omit<FastTrackBooking, 'totalFee' | 'hasEsim' | 'addAirportPickup'>>(() => {
    const defaultData = {
      airport: 'Tan Son Nhat (SGN)',
      serviceDirection: undefined,
      airlineName: '',
      flightNumber: '',
      arrivalDate: '',
      arrivalTime: '',
      numberOfPassengers: 1,
      packageType: 'Fast Track Standard',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      specialRequests: '',
    };
    if (initialDraft && initialDraft.formData && typeof initialDraft.formData === 'object') {
      return { ...defaultData, ...initialDraft.formData };
    }
    return defaultData;
  });

  const isFastTrackFormValid = () => {
    return !!(
      (formData?.flightNumber || '')?.trim() &&
      formData?.arrivalDate &&
      (formData?.contactName || '')?.trim() &&
      (formData?.contactEmail || '')?.trim() &&
      isValidEmail(formData?.contactEmail || '') &&
      (formData?.contactPhone || '')?.trim()
    );
  };

  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // New requirements states
  const [hasEsim, setHasEsim] = useState<boolean>(() => (initialDraft && initialDraft.hasEsim) ?? false);
  const [addAirportPickup, setAddAirportPickup] = useState<boolean>(() => (initialDraft && initialDraft.addAirportPickup) ?? false);
  const [selectedPickupVehicle, setSelectedPickupVehicle] = useState<'4 seats' | '7 seats' | '16 seats'>(() => (initialDraft && initialDraft.selectedPickupVehicle) ?? '4 seats');
  const [pickupDestination, setPickupDestination] = useState<string>(() => (initialDraft && initialDraft.pickupDestination) ?? '');
  
  const [wantsInvoice, setWantsInvoice] = useState<boolean>(() => (initialDraft && initialDraft.wantsInvoice) ?? false);
  const [companyName, setCompanyName] = useState<string>(() => (initialDraft && initialDraft.companyName) ?? '');
  const [taxCode, setTaxCode] = useState<string>(() => (initialDraft && initialDraft.taxCode) ?? '');
  const [companyAddress, setCompanyAddress] = useState<string>(() => (initialDraft && initialDraft.companyAddress) ?? '');
  const [companyEmail, setCompanyEmail] = useState<string>(() => (initialDraft && initialDraft.companyEmail) ?? '');
  
  const [paymentMethod, setPaymentMethod] = useState<'9pay' | 'bank_transfer'>(() => (initialDraft && initialDraft.paymentMethod) ?? '9pay');

  const [isRedirecting, setIsRedirecting] = useState(false);
  const [contactPref, setContactPref] = useState<'WhatsApp' | 'Zalo' | 'SMS'>(() => (initialDraft && initialDraft.contactPref) ?? 'WhatsApp');

  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(() => {
    if (initialDraft && initialDraft.formData) {
      const f = initialDraft.formData;
      return !!(f.airlineName || f.flightNumber || f.contactName || f.contactEmail);
    }
    return false;
  });

  // Save draft on edit (auto-save)
  React.useEffect(() => {
    const draft = {
      formData,
      hasEsim,
      addAirportPickup,
      selectedPickupVehicle,
      pickupDestination,
      paymentMethod,
      contactPref,
      wantsInvoice,
      companyName,
      taxCode,
      companyAddress,
      companyEmail
    };
    safeStorage.setItem('digivisa_fasttrack_draft', JSON.stringify(draft));
  }, [formData, hasEsim, addAirportPickup, selectedPickupVehicle, pickupDestination, paymentMethod, contactPref, wantsInvoice, companyName, taxCode, companyAddress, companyEmail]);

  // Prevent airport pickup combo for Phu Quoc (PQC)
  React.useEffect(() => {
    if (formData.airport === 'Phu Quoc (PQC)' && addAirportPickup) {
      setAddAirportPickup(false);
    }
  }, [formData.airport, addAirportPickup]);

  const handleResetDraft = () => {
    safeStorage.removeItem('digivisa_fasttrack_draft');
    setFormData({
      airport: 'Tan Son Nhat (SGN)',
      serviceDirection: undefined,
      airlineName: '',
      flightNumber: '',
      arrivalDate: '',
      arrivalTime: '',
      numberOfPassengers: 1,
      packageType: 'Fast Track Standard',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      specialRequests: '',
    });
    setHasEsim(false);
    setAddAirportPickup(false);
    setSelectedPickupVehicle('4 seats');
    setPickupDestination('');
    setWantsInvoice(false);
    setCompanyName('');
    setTaxCode('');
    setCompanyAddress('');
    setCompanyEmail('');
    setPaymentMethod('9pay');
    setContactPref('WhatsApp');
    setHasRestoredDraft(false);
  };

  const PACKAGE_RATES: Record<FastTrackBooking['packageType'], number> = {
    'Fast Track Standard': 45,
    'Fast Track Business': 48,
    'Fast Track Vip': 55,
  };

  const getVehiclePrice = (airportName: string, vehicleType: '4 seats' | '7 seats' | '16 seats') => {
    const isHan = airportName?.includes('HAN');
    const isDad = airportName?.includes('DAD');
    
    if (isHan) {
      if (vehicleType === '4 seats') return { usd: 29, vnd: 765000 };
      if (vehicleType === '7 seats') return { usd: 40, vnd: 1065000 };
      return { usd: 59, vnd: 1565000 };
    } else if (isDad) {
      if (vehicleType === '4 seats') return { usd: 27, vnd: 700000 };
      if (vehicleType === '7 seats') return { usd: 38, vnd: 1000000 };
      return { usd: 57, vnd: 1500000 };
    } else {
      // SGN (default)
      if (vehicleType === '4 seats') return { usd: 29, vnd: 750000 };
      if (vehicleType === '7 seats') return { usd: 40, vnd: 1050000 };
      return { usd: 59, vnd: 1550000 };
    }
  };

  const getCalculatedFees = () => {
    const base = PACKAGE_RATES[formData.packageType] || 45;
    const baseExactVnd: Record<number, number> = {
      45: 1150000,
      48: 1250000,
      55: 1400000,
    };
    const baseVnd = baseExactVnd[base] ?? (base * 25000);
    
    // eSIM option
    const esimCost = hasEsim ? 15 : 0;
    const esimCostVnd = hasEsim ? 375000 : 0;

    // Airport pickup combo option
    const vPrice = getVehiclePrice(formData.airport || 'Tan Son Nhat (SGN)', selectedPickupVehicle);
    const pickupCost = addAirportPickup ? vPrice.usd : 0;
    const pickupCostVnd = addAirportPickup ? vPrice.vnd : 0;

    const subtotal = base + esimCost + pickupCost;
    const subtotalVnd = baseVnd + esimCostVnd + pickupCostVnd;

    let total = subtotal;
    let totalVnd = subtotalVnd;

    if (addAirportPickup) {
      total = Math.max(0, total - 9);
      totalVnd = Math.max(0, totalVnd - 200000);
    }

    return {
      basePerPax: base,
      basePerPaxVnd: baseVnd,
      esimCost,
      esimCostVnd,
      pickupCost,
      pickupCostVnd,
      subtotal,
      subtotalVnd,
      tax: 0,
      taxVnd: 0,
      total,
      totalVnd,
    };
  };

  const fees = getCalculatedFees();

  const formatCharge = (usdAmount: any, exactVndAmount?: number) => {
    const val = typeof usdAmount === 'number' ? usdAmount : (parseFloat(usdAmount) || 0);
    if (currency === 'VND') {
      if (exactVndAmount !== undefined) {
        return `${exactVndAmount.toLocaleString('en-US')} ₫`;
      }
      const EXACT_SUMS: Record<number, number> = {
        12: 300000,
        24: 600000,
        42: 1100000,
        39: 1000000,
        120: 3000000,
        195: 4875000,
        15: 375000,
        51: 1300000,
        63: 1600000,
        81: 2100000,
        132: 3300000,
        144: 3600000,
        162: 4100000,
        207: 5175000,
        219: 5475000,
        237: 5975000,
        54: 1375000,
        135: 3375000,
        210: 5250000,
        66: 1675000,
        78: 1975000,
        96: 2475000,
        147: 3675000,
        159: 3975000,
        177: 4475000,
        222: 5550000,
        234: 5850000,
        252: 6350000,
        45: 1150000,
        48: 1250000,
        55: 1400000,
        60: 1525000,
        64: 1625000,
        70: 1775000,
        57: 1450000,
        69: 1750000,
        87: 2250000,
        61: 1550000,
        73: 1850000,
        91: 2350000,
        67: 1700000,
        79: 2000000,
        97: 2500000,
        72: 1825000,
        84: 2125000,
        102: 2625000,
        76: 1925000,
        88: 2225000,
        106: 2725000,
        82: 2075000,
        94: 2375000,
        112: 2875000,
      };
      
      const matched = EXACT_SUMS[val];
      if (matched !== undefined) {
        return `${matched.toLocaleString('en-US')} ₫`;
      }
      
      let converted = val * EXCHANGE_RATES[currency];
      return `${converted.toLocaleString('en-US')} ₫`;
    }
    return `$ ${Math.round(val).toLocaleString('en-US')}`;
  };
 

  const validate = () => {
    const freshErrors: Record<string, string> = {};
    const fn = (formData?.flightNumber || '').trim();
    const cn = (formData?.contactName || '').trim();
    const ce = (formData?.contactEmail || '').trim();
    const cp = (formData?.contactPhone || '').trim();
    const pd = (pickupDestination || '').trim();
    const compName = (companyName || '').trim();
    const tc = (taxCode || '').trim();
    const ca = (companyAddress || '').trim();
    const compEmail = (companyEmail || '').trim();

    if (!formData?.serviceDirection) {
      freshErrors.serviceDirection = isEn 
        ? 'Please select a Service Direction (Arrival or Departure)' 
        : 'Vui lòng chọn Hướng dịch vụ (Đến hoặc Đi)';
    }
    if (!fn) {
      freshErrors.flightNumber = isEn ? 'Flight code number is required' : 'Vui lòng nhập số hiệu chuyến bay';
    } else if (!isValidFlightNumber(fn)) {
      freshErrors.flightNumber = isEn 
        ? 'Invalid IATA flight number format (2-character airline code followed by 1 to 4 digits, e.g., VN123, SQ318, U2456)' 
        : 'Số hiệu chuyến bay chuẩn IATA không hợp lệ (mã hãng 2 ký tự và từ 1 đến 4 chữ số, VD: VN123, SQ318, U2456)';
    }
    
    const isDeparture = formData?.serviceDirection === 'Departure';
    const dateLabel = isDeparture 
      ? (isEn ? 'Flight departure date' : 'ngày cất cánh dự kiến')
      : (isEn ? 'Flight arrival date' : 'ngày hạ cánh dự kiến');

    if (!formData?.arrivalDate) {
      freshErrors.arrivalDate = isEn ? `${dateLabel} is required` : `Vui lòng chọn ${dateLabel}`;
    } else {
      const todayStr = new Date().toISOString().split('T')[0];
      if (formData.arrivalDate < todayStr) {
        freshErrors.arrivalDate = isEn 
          ? `${dateLabel} cannot be in the past.` 
          : `Ngày chọn không thể ở quá khứ.`;
      } else {
        const arrivalDateTimeStr = formData.arrivalTime 
          ? `${formData.arrivalDate}T${formData.arrivalTime}` 
          : `${formData.arrivalDate}T23:59:59`;
        
        const arrivalDateObj = new Date(arrivalDateTimeStr);
        const now = new Date();
        const differenceMs = arrivalDateObj.getTime() - now.getTime();
        const twentyFourHoursMs = 24 * 60 * 60 * 1000;

        if (differenceMs < twentyFourHoursMs) {
          freshErrors.arrivalDate = isEn
            ? 'Fast Track service must be ordered at least 24 hours in advance.'
            : 'Dịch vụ Fast Track cần được đặt trước ít nhất 24 giờ.';
        }
      }
    }

    const timeLabel = isDeparture
      ? (isEn ? 'Departure time is required' : 'Vui lòng nhập giờ cất cánh dự kiến')
      : (isEn ? 'Arrival time is required' : 'Vui lòng nhập giờ hạ cánh dự kiến');

    if (!formData?.arrivalTime) freshErrors.arrivalTime = timeLabel;
    if (!cn) freshErrors.contactName = isEn ? 'Lead passenger name is required' : 'Vui lòng nhập tên hành khách';
    if (!ce || !isValidEmail(ce)) {
      freshErrors.contactEmail = isEn ? 'A valid suitable email address is required (e.g. user@example.com)' : 'Vui lòng nhập địa chỉ email hợp lệ (VD: user@example.com)';
    }
    if (!cp) {
      freshErrors.contactPhone = isEn ? 'Emergency phone contact is required' : 'Vui lòng nhập số điện thoại khẩn cấp';
    } else if (!isValidInternationalPhone(cp)) {
      freshErrors.contactPhone = isEn 
        ? 'Phone number must be in valid international format (e.g., +84912345678)' 
        : 'Số điện thoại phải theo định dạng quốc tế (VD: +84912345678)';
    }

    if (addAirportPickup) {
      if (!pd) {
        freshErrors.pickupDestination = isEn ? 'Drop-off address is required for airport pickup' : 'Vui lòng nhập địa chỉ khách sạn / điểm đến';
      }
    }

    if (wantsInvoice) {
      if (!compName) {
        freshErrors.companyName = isEn ? 'Company registered name is required' : 'Vui lòng nhập tên đăng ký công ty';
      }
      if (!tc) {
        freshErrors.taxCode = isEn ? 'Registered tax code (MST) is required' : 'Vui lòng nhập mã số thuế công ty (MST)';
      } else if (!isValidTaxCode(tc)) {
        freshErrors.taxCode = isEn 
          ? 'Invalid Tax Code format (must be 10 digits or 13 digits for branches, e.g., 0102030405)' 
          : 'Mã số thuế không hợp lệ (gồm 10 số hoặc 13 số nhánh, VD: 0102030405)';
      }
      if (!ca) {
        freshErrors.companyAddress = isEn ? 'Company tax billing address is required' : 'Vui lòng nhập địa chỉ đăng ký thuế';
      }
      if (compEmail && !isValidEmail(compEmail)) {
        freshErrors.companyEmail = isEn ? 'Valid company invoicing email is required' : 'Vui lòng nhập email công ty hợp lệ';
      }
    }

    setErrors(freshErrors);
    return Object.keys(freshErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      alert(isEn 
        ? '⚠️ Please complete all required fields highlighted in red (Flight No, Date, Name, Email, Phone) before proceeding to 9Pay Checkout!' 
        : '⚠️ Vui lòng điền đầy đủ các thông tin còn thiếu (được đánh dấu khung đỏ phía trên như Số hiệu chuyến bay, Ngày bay, Họ tên, Email, SĐT...) trước khi chuyển hướng 9Pay!');
      setTimeout(() => {
        const errField = document.querySelector('.border-red-400, .border-red-500');
        if (errField) {
          errField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }
    if (addAirportPickup && !(pickupDestination || '').trim()) {
      setErrors((prev) => ({ 
        ...prev, 
        pickupDestination: isEn ? 'Pickup destination is required' : 'Vui lòng nhập địa chỉ điểm đến đưa đón' 
      }));
      return;
    }

    setIsRedirecting(true);

    const orderId = generateOrderId();
    const trackingToken = generateTrackingToken();

    const finalBooking: FastTrackBooking = {
      ...formData,
      contactPhone: `${formData.contactPhone} (${contactPref})`,
      hasEsim,
      addAirportPickup,
      selectedPickupVehicle: addAirportPickup ? selectedPickupVehicle : undefined,
      pickupDestination: addAirportPickup ? pickupDestination : undefined,
      paymentMethod,
      totalFee: fees.total,
      wantsInvoice,
      companyName: wantsInvoice ? companyName : undefined,
      taxCode: wantsInvoice ? taxCode : undefined,
      companyAddress: wantsInvoice ? companyAddress : undefined,
      companyEmail: wantsInvoice ? companyEmail : undefined,
    };

    const newOrder: Order = {
      id: orderId,
      type: 'FastTrack',
      status: 'Pending Payment',
      createdAt: new Date().toISOString(),
      paymentStatus: 'Pending',
      trackingToken,
      details: finalBooking,
    };
    safeStorage.removeItem('digivisa_fasttrack_draft');
    const res = await onSuccess(newOrder);
    if (res === false) {
      setIsRedirecting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto" id="fasttrack-flow-container">
      {/* 9Pay Gateway Loading overlay */}
      <AnimatePresence>
        {isRedirecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[150] flex flex-col items-center justify-center p-4 text-white"
          >
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl">
              <div className="flex justify-center">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-t-teal-500 border-r-teal-500/20 border-b-teal-500/10 border-l-teal-500/30 animate-spin"></div>
                  <div className="absolute inset-2 bg-slate-950 rounded-full flex items-center justify-center">
                    <span className="font-display font-extrabold text-[10px] text-teal-400">9Pay</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-extrabold text-lg">
                  {isEn ? 'Connecting to 9Pay Gateway' : 'Đang kết nối cổng thanh toán 9Pay'}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  {isEn 
                    ? "Please wait while we route your VIP entry transaction to 9Pay's secured billing gateway." 
                    : 'Vui lòng chờ giây lát trong khi chúng tôi chuyển hướng bạn tới cổng thanh toán bảo mật 9Pay.'}
                </p>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span>{isEn ? 'Merchant ID:' : 'Mã đối tác:'}</span>
                  <span className="font-mono text-slate-400">DIGIVISA-FAST</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>{isEn ? 'USD Charge Amount:' : 'Số tiền thanh toán USD:'}</span>
                  <strong className="text-teal-400 font-mono font-bold">${fees.total.toFixed(2)} USD</strong>
                </div>
              </div>
              <div className="text-[10px] text-amber-500 font-medium">
                {isEn ? '⚠️ Secure payment page will open in an external tab.' : '⚠️ Trang thanh toán bảo mật sẽ mở ở tab ngoài.'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top action controls */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onCancel}
          id="fasttrack-cancel-back"
          className="flex items-center space-x-2 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{isEn ? 'Back to Landing' : 'Quay lại trang chủ'}</span>
        </button>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-amber-600 bg-amber-50 rounded-full border border-amber-200 px-3 py-1 font-mono tracking-tight flex items-center space-x-1">
            <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
            <span>{isEn ? 'MOST POPULAR CHOICE' : 'LỰA CHỌN PHỔ BIẾN NHẤT'}</span>
          </span>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        
        {/* Banner header code */}
        <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-[#101F42] px-6 py-6 sm:px-10 sm:py-8 text-white">
          <div className="flex items-center space-x-2 bg-teal-400/10 border border-teal-500/20 text-teal-400 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold w-fit uppercase mb-4 select-none">
            {isEn ? '⭐ TOP-RATED AIRPORT EXPERIENCE' : '⭐ TRẢI NGHIỆM SÂN BAY ĐƯỢC ĐÁNH GIÁ CAO NHẤT'}
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">
            {isEn ? 'Fast Track VIP Airport Assist' : 'Dịch Vụ Hỗ Trợ Nhập Cảnh Nhanh (Fast-Track)'}
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            {isEn 
              ? 'Skip security bottlenecks and customs congestion. Walk straight through dedicated diplomatique gates accompanied by private airport liaisons.' 
              : 'Bỏ qua các nút thắt an ninh và ùn tắc hải quan. Đi thẳng qua các cổng ngoại giao chuyên dụng cùng với nhân viên đón tiễn sân bay riêng.'}
          </p>

          {hasRestoredDraft && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-amber-550/15 border border-amber-500/20 rounded-2xl text-xs text-amber-300" id="fasttrack-draft-alert">
              <div className="flex items-center space-x-2 border-b border-amber-500/10 sm:border-0 pb-2 sm:pb-0">
                <span className="flex h-2 w-2 rounded-full bg-amber-400 relative animate-pulse shrink-0" />
                <span className="font-sans">
                  <strong>{isEn ? 'Restored Draft state:' : 'Khôi phục bản nháp:'}</strong> {isEn ? 'Loaded previous registration progress.' : 'Đã tải tiến trình đăng ký trước đó của bạn.'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetDraft}
                className="mt-1 sm:mt-0 text-amber-400 hover:text-amber-300 underline font-bold transition-all shrink-0 cursor-pointer text-[11px]"
              >
                {isEn ? 'Clear Form & Start Fresh' : 'Xóa bản nháp & Bắt đầu mới'}
              </button>
            </div>
          )}
        </div>

        <form noValidate onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-8">
          
          <HistoricalAutofill
            serviceType="FastTrack"
            language={language}
            orders={orders}
            onSelect={(profile: any) => {
              const nameCandidate = (profile.firstName || profile.lastName) 
                ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() 
                : (profile.contactName || profile.fullName || '');

              setFormData((prev) => ({
                ...prev,
                contactName: nameCandidate || prev.contactName || '',
                contactEmail: profile.email || prev.contactEmail || '',
                contactPhone: profile.phone ? formatPhoneE164(profile.phone) : (prev.contactPhone || ''),
                specialRequests: profile.specialRequests || '',
              }));
              if (profile.wantsInvoice !== undefined) {
                setWantsInvoice(!!profile.wantsInvoice);
                if (profile.wantsInvoice) {
                  setCompanyName(profile.companyName || '');
                  setTaxCode(profile.taxCode || '');
                  setCompanyAddress(profile.companyAddress || '');
                  setCompanyEmail(profile.companyEmail || '');
                }
              }
              if (profile.vehicleType) {
                setAddAirportPickup(true);
                setSelectedPickupVehicle(profile.vehicleType);
                setPickupDestination(profile.pickupDestination);
              }
            }}
          />

          {/* Section 1: Choose Assistant Tier Package */}
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-slate-900 text-lg">
                  {isEn ? '1. Choose Concierge Tier' : '1. Chọn Gói Dịch Vụ Hỗ Trợ'}
                </h3>
                <p className="text-slate-500 text-xs">
                  {isEn ? 'Pick the level of arrival support customized to your flight parameters.' : 'Chọn mức độ hỗ trợ nhập cảnh phù hợp với nhu cầu hành trình của bạn.'}
                </p>
              </div>
              <span className="inline-flex items-center px-2 py-1 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold font-mono self-start sm:self-auto shrink-0">
                👤 {isEn ? '1 Passenger Limit' : 'Giới hạn 1 Hành khách'}
              </span>
            </div>

            <div className="bg-teal-50/40 border border-teal-200/50 rounded-xl p-3 flex items-start space-x-2.5">
              <span className="text-teal-600 mt-0.5 text-xs">ℹ️</span>
              <div className="text-[11px] text-teal-800 leading-normal">
                <span className="font-bold text-teal-950">{isEn ? 'Fast Track booking limit:' : 'Giới hạn đặt Fast Track:'}</span>{' '}
                {isEn 
                  ? 'To maintain our absolute 1-on-1 dedicated host guarantee, each checkout is strictly limited to 1 passenger (1 pax). Please submit separate forms for each traveler in your group.' 
                  : 'Để đảm bảo dịch vụ hỗ trợ 1 kèm 1 tốt nhất, mỗi lượt thanh toán chỉ áp dụng cho tối đa 1 hành khách (1 khách). Vui lòng đăng ký riêng cho từng thành viên nếu bạn đi theo đoàn.'}
              </div>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
              {[
                {
                  id: 'Fast Track Standard',
                  title: isEn ? 'Fast Track Standard' : 'Fast Track Tiêu chuẩn',
                  price: 45,
                  desc: '',
                  perks: formData.serviceDirection === 'Departure'
                    ? (isEn 
                        ? [
                            'Meet the passenger at the departure terminal lobby',
                            'Departure via Fast Track service lane'
                          ]
                        : [
                            'Đón khách tại sảnh (nhà ga đi)',
                            'Xuất cảnh lối dịch vụ Fast Track'
                          ])
                    : (isEn 
                        ? [
                            'Meet the passenger at the gate',
                            'Immigration via Fast Track service lane'
                          ]
                        : [
                            'Đón khách tại cổng',
                            'Nhập cảnh lối dịch vụ Fast Track'
                          ])
                },
                {
                  id: 'Fast Track Business',
                  title: isEn ? 'Fast Track Business' : 'Fast Track Thương gia',
                  price: 48,
                  desc: '',
                  perks: formData.serviceDirection === 'Departure'
                    ? (isEn 
                        ? [
                            'Meet the passenger at the departure terminal lobby',
                            'Departure via Fast Track service lane',
                            'Priority customs and security screening',
                            'Guide the passenger to the waiting area or lounge (if available)',
                            'Escort the passenger to the boarding gate'
                          ]
                        : [
                            'Đón khách tại sảnh (nhà ga đi)',
                            'Xuất cảnh theo lối dịch vụ Fast Track',
                            'Hải quan và an ninh soi chiếu ưu tiên',
                            'Hướng dẫn tới khu chờ hoặc phòng chờ (nếu có)',
                            'Tiễn tới cửa ra máy bay'
                          ])
                    : (isEn 
                        ? [
                            'Meet the passenger at the gate',
                            'Immigration via Fast Track service lane',
                            'Assist the passenger to the baggage claim area and collect baggage',
                            'Escort the passenger to the customs inspection area',
                            'Escort the passenger to the pick-up area'
                          ]
                        : [
                            'Đón khách tại cổng',
                            'Nhập cảnh theo lối dịch vụ Fast Track',
                            'Hỗ trợ khách di chuyển xuống khu hành lý và nhận hành lý',
                            'Đưa khách đến khu vực kiểm tra hải quan',
                            'Tiễn khách ra khu vực xe đón'
                          ])
                },
                {
                  id: 'Fast Track Vip',
                  title: isEn ? 'Fast Track VIP' : 'Fast Track VIP',
                  price: 55,
                  desc: '',
                  perks: formData.serviceDirection === 'Departure'
                    ? (isEn 
                        ? [
                            'Meet the passenger at the departure terminal lobby',
                            'Handle departure procedures on behalf of the passenger',
                            'Departure via priority lane (Crew / Diplomat / APEC)',
                            'Priority customs and security screening',
                            'Guide the passenger to the waiting area or lounge (if available)',
                            'Escort the passenger to the boarding gate'
                          ]
                        : [
                            'Đón khách tại sảnh (nhà ga đi)',
                            'Thay mặt làm thủ tục xuất cảnh',
                            'Xuất cảnh theo lối ưu tiên (Crew / Diplomat / APEC)',
                            'Hải quan và an ninh soi chiếu ưu tiên',
                            'Hướng dẫn tới khu chờ hoặc phòng chờ (nếu có)',
                            'Tiễn tới cửa ra máy bay'
                          ])
                    : (isEn 
                        ? [
                            'Meet the passenger at the gate',
                            'Handle immigration procedures on behalf of the passenger',
                            'Immigration via priority lane (Crew / Diplomat / APEC)',
                            'Assist the passenger to the baggage claim area and collect baggage',
                            'Escort the passenger to the customs inspection area',
                            'Escort the passenger to the pick-up area'
                          ]
                        : [
                            'Đón khách tại cổng',
                            'Thay mặt làm thủ tục nhập cảnh',
                            'Nhập cảnh theo lối ưu tiên (Crew / Diplomat / APEC)',
                            'Hỗ trợ khách di chuyển xuống khu hành lý và nhận hành lý',
                            'Đưa khách đến khu vực kiểm tra hải quan',
                            'Tiễn khách ra khu vực xe đón'
                          ])
                },
              ].map((pkg) => {
                const isSelected = formData.packageType === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    onClick={() => setFormData((prev) => ({ ...prev, packageType: pkg.id as FastTrackBooking['packageType'] }))}
                    className={`rounded-2xl p-5 border cursor-pointer flex flex-col justify-between transition-all ${
                      isSelected 
                        ? 'border-teal-500 bg-teal-50/10 shadow-md shadow-teal-500/5 ring-1 ring-teal-500' 
                        : 'border-slate-150 hover:border-slate-300 bg-slate-50/40'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          isSelected ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {pkg.title}
                        </span>
                        <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-teal-500' : 'border-slate-300'}`}>
                          {isSelected && <div className="h-2 w-2 rounded-full bg-teal-500" />}
                        </div>
                      </div>

                      <div className="flex items-baseline">
                        <span className="font-display font-black text-2xl text-slate-900">
                          {formatCharge(pkg.price)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium ml-1">/{isEn ? ' Passenger' : ' Hành khách'}</span>
                      </div>

                      {/* Direction specific header */}
                      <span className="text-[9px] font-bold uppercase tracking-wide text-indigo-600 block mt-1">
                        {formData.serviceDirection === 'Departure' 
                          ? (isEn ? '⬆️ Outbound Service' : '⬆️ Chiều đi (Xuất cảnh)')
                          : (isEn ? '⬇️ Inbound Service' : '⬇️ Chiều đến (Nhập cảnh)')}
                      </span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200/50 space-y-1.5">
                      {pkg.perks.map((p, i) => (
                        <div key={i} className="flex items-start space-x-1.5 text-[9px] font-semibold text-slate-600">
                          <Smile className="h-3 w-3 text-teal-500 shrink-0 mt-0.5" />
                          <span className="leading-tight">{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Service Direction Selection */}
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="font-display font-bold text-slate-900 text-lg">
                {isEn ? '2. Service Direction' : '2. Hướng Dịch Vụ'}
              </h3>
              <p className="text-slate-500 text-xs">
                {isEn ? 'Select your airport path. This is required to proceed.' : 'Chọn luồng di chuyển tại sân bay. Đây là trường bắt buộc để tiếp tục.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Arrival Card */}
              <div
                onClick={() => setFormData((prev) => ({ ...prev, serviceDirection: 'Arrival' }))}
                className={`relative rounded-2xl p-5 border cursor-pointer flex flex-col justify-between transition-all ${
                  formData.serviceDirection === 'Arrival'
                    ? 'border-teal-500 bg-teal-50/10 shadow-md shadow-teal-500/5 ring-1 ring-teal-500'
                    : 'border-slate-150 hover:border-slate-300 bg-slate-50/40'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded flex items-center gap-1.5 ${
                      formData.serviceDirection === 'Arrival' ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      <span className="text-xs">⬇️</span> {isEn ? 'Arrival' : 'Đến (Arrival)'}
                    </span>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${formData.serviceDirection === 'Arrival' ? 'border-teal-500' : 'border-slate-300'}`}>
                      {formData.serviceDirection === 'Arrival' && <div className="h-2 w-2 rounded-full bg-teal-500" />}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    {isEn 
                      ? 'Arrival – For passengers arriving at the airport who need immigration Fast Track assistance, baggage claim support, customs guidance, and escort to the pick-up area.'
                      : 'Đến – Dành cho hành khách hạ cánh xuống sân bay cần hỗ trợ làm thủ tục nhập cảnh nhanh, hỗ trợ nhận hành lý, hướng dẫn hải quan và đưa ra khu vực đón xe.'}
                  </p>
                </div>
              </div>

              {/* Departure Card */}
              <div
                onClick={() => setFormData((prev) => ({ ...prev, serviceDirection: 'Departure' }))}
                className={`relative rounded-2xl p-5 border cursor-pointer flex flex-col justify-between transition-all ${
                  formData.serviceDirection === 'Departure'
                    ? 'border-teal-500 bg-teal-50/10 shadow-md shadow-teal-500/5 ring-1 ring-teal-500'
                    : 'border-slate-150 hover:border-slate-300 bg-slate-50/40'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded flex items-center gap-1.5 ${
                      formData.serviceDirection === 'Departure' ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      <span className="text-xs">⬆️</span> {isEn ? 'Departure' : 'Đi (Departure)'}
                    </span>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${formData.serviceDirection === 'Departure' ? 'border-teal-500' : 'border-slate-300'}`}>
                      {formData.serviceDirection === 'Departure' && <div className="h-2 w-2 rounded-full bg-teal-500" />}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    {isEn 
                      ? 'Departure – For passengers departing from the airport who need Fast Track assistance for check-in/immigration, security screening, and escort to the boarding gate.'
                      : 'Đi – Dành cho hành khách xuất cảnh từ sân bay cần hỗ trợ làm thủ tục check-in/xuất cảnh nhanh, kiểm tra an ninh và đưa ra tận cửa khởi hành.'}
                  </p>
                </div>
              </div>
            </div>
            {errors.serviceDirection && <span className="text-[11px] text-red-500 block mt-1 font-bold">{errors.serviceDirection}</span>}
          </div>

          {/* Section 3: Personal & Flight Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Flight info */}
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="font-display font-bold text-slate-900 text-base">
                  {isEn ? '3. Flight Specifics & Logistics' : '3. Chi Tiết Chuyến Bay & Hậu Cần'}
                </h3>
                <p className="text-slate-500 text-xs">
                  {isEn 
                    ? (formData.serviceDirection === 'Departure' ? 'Used to monitor exact departure schedules and coordinate assistance.' : 'Used to monitor exact landing coordinates on real-time radars.') 
                    : (formData.serviceDirection === 'Departure' ? 'Sử dụng để theo dõi thời gian cất cánh chính xác và phối hợp hỗ trợ.' : 'Sử dụng để theo dõi thời gian và tọa độ hạ cánh chính xác qua radar thời gian thực.')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label id="lbl-airport" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {isEn 
                      ? (formData.serviceDirection === 'Departure' ? 'Departure Airport' : 'Arrival Airport') 
                      : (formData.serviceDirection === 'Departure' ? 'Sân Bay Cất Cánh' : 'Sân Bay Hạ Cánh')}
                  </label>
                  <select
                    id="select-airport"
                    value={formData.airport || 'Tan Son Nhat (SGN)'}
                    onChange={(e) => setFormData((prev) => ({ ...prev, airport: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-705 text-sm font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="Tan Son Nhat (SGN)">{isEn ? 'Tan Son Nhat (SGN) - Ho Chi Minh City' : 'Sân bay Tân Sơn Nhất (SGN) - TP. HCM'}</option>
                    <option value="Noi Bai (HAN)">{isEn ? 'Noi Bai (HAN) - Hanoi' : 'Sân bay Nội Bài (HAN) - Hà Nội'}</option>
                    <option value="Phu Quoc (PQC)">{isEn ? 'Phu Quoc (PQC) - Phu Quoc Island' : 'Sân bay Phú Quốc (PQC) - Đảo Phú Quốc'}</option>
                    <option value="Da Nang (DAD)">{isEn ? 'Da Nang (DAD) - Da Nang' : 'Sân bay Đà Nẵng (DAD) - Đà Nẵng'}</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label id="lbl-flight-num" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {isEn ? 'Flight Number' : 'Số Hiệu Chuyến Bay'}
                  </label>
                  <input
                    type="text"
                    id="input-flight-num"
                    value={formData.flightNumber}
                    onChange={(e) => {
                      const sanitized = sanitizeFlightNumber(e.target.value);
                      setFormData((prev) => ({ ...prev, flightNumber: sanitized }));
                      if (sanitized && isValidFlightNumber(sanitized) && errors.flightNumber) {
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.flightNumber;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-700 text-sm font-medium focus:ring-2 focus:ring-slate-500/10 focus:border-teal-500 focus:outline-none transition-all uppercase font-mono ${
                      errors.flightNumber ? 'border-red-400 bg-red-50/10' : 'border-slate-200'
                    }`}
                    placeholder="e.g. SQ308, VN123"
                  />
                  {errors.flightNumber && <span className="text-[11px] text-red-500 block mt-1">{errors.flightNumber}</span>}
                </div>

                <div>
                  <label id="lbl-arr-date" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {isEn 
                      ? (formData.serviceDirection === 'Departure' ? 'Departure Date' : 'Arrival Date') 
                      : (formData.serviceDirection === 'Departure' ? 'Ngày Cất Cánh' : 'Ngày Hạ Cánh')}
                  </label>
                  <input
                    type="date"
                    id="input-arr-date"
                    value={formData.arrivalDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => {
                      const val = e.target.value;
                      const todayStr = new Date().toISOString().split('T')[0];
                      setFormData((prev) => ({ 
                        ...prev, 
                        arrivalDate: val,
                        arrivalTime: prev.arrivalTime || '12:00' 
                      }));
                      if (val && val < todayStr) {
                        setErrors((prev) => ({
                          ...prev,
                          arrivalDate: isEn ? 'Date cannot be in the past.' : 'Ngày chọn không thể ở quá khứ.'
                        }));
                      } else if (errors.arrivalDate) {
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.arrivalDate;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-700 text-sm font-medium focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all ${
                      errors.arrivalDate ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                  {errors.arrivalDate && <span className="text-[11px] text-red-500 block mt-1">{errors.arrivalDate}</span>}
                </div>

                <div>
                  <TimePicker
                    id="input-arr-time"
                    value={formData.arrivalTime}
                    onChange={(val) => {
                      setFormData((prev) => ({ ...prev, arrivalTime: val }));
                      if (val.trim() && errors.arrivalTime) {
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.arrivalTime;
                          return copy;
                        });
                      }
                    }}
                    label={isEn 
                      ? (formData.serviceDirection === 'Departure' ? 'Departure Time' : 'Landing Time') 
                      : (formData.serviceDirection === 'Departure' ? 'Giờ Cất Cánh Dự Kiến' : 'Giờ Hạ Cánh Dự Kiến')}
                    error={errors.arrivalTime}
                    isEn={isEn}
                  />
                </div>
              </div>
            </div>

            {/* Contact details */}
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="font-display font-bold text-slate-900 text-base">
                  {isEn ? '4. Customer Information' : '4. Thông tin khách hàng'}
                </h3>
                <p className="text-slate-500 text-xs">
                  {isEn 
                    ? (formData.serviceDirection === 'Departure' ? 'Information used to communicate handoff details at the departure hall.' : 'Information used to communicate handoff details at the jet bridge.') 
                    : (formData.serviceDirection === 'Departure' ? 'Thông tin được sử dụng để liên lạc đón tiễn và hỗ trợ làm thủ tục tại sảnh đi.' : 'Thông tin được sử dụng để liên lạc đón tiễn và hướng dẫn tại ống lồng máy bay.')}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label id="lbl-lead-name" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {isEn ? 'Lead Traveler Full Name' : 'Họ & Tên Hành Khách Chính'}
                  </label>
                  <input
                    type="text"
                    id="input-lead-name"
                    value={formData.contactName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, contactName: e.target.value }))}
                    className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-700 text-sm font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all ${
                      errors.contactName ? 'border-red-400' : 'border-slate-200'
                    }`}
                    placeholder="e.g. Eleanor Vance"
                  />
                  {errors.contactName && <span className="text-[11px] text-red-500 block mt-1">{errors.contactName}</span>}
                </div>

                <div>
                  <label id="lbl-lead-email" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {isEn ? 'Communication Email' : 'Email Liên Hệ'}
                  </label>
                  <input
                    type="email"
                    id="input-lead-email"
                    value={formData.contactEmail}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({ ...prev, contactEmail: val }));
                      if (errors.contactEmail) {
                        if (!val.trim() || isValidEmail(val)) {
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.contactEmail;
                            return copy;
                          });
                        }
                      }
                    }}
                    onBlur={() => {
                      if (formData.contactEmail.trim() && !isValidEmail(formData.contactEmail)) {
                        setErrors((prev) => ({
                          ...prev,
                          contactEmail: isEn 
                            ? 'A valid suitable email address is required (e.g. user@example.com)' 
                            : 'Vui lòng nhập địa chỉ email hợp lệ (VD: user@example.com)'
                        }));
                      }
                    }}
                    className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-700 text-sm font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all ${
                      errors.contactEmail ? 'border-red-400 bg-red-50/10' : 'border-slate-200'
                    }`}
                    placeholder="name@destination.com"
                  />
                  {errors.contactEmail && <span className="text-[11px] text-red-500 font-medium block mt-1">{errors.contactEmail}</span>}
                </div>

                <div>
                  <label id="lbl-lead-phone" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {isEn ? 'Contact Number (Zalo / WhatsApp Supported)' : 'Số Điện Thoại Liên Hệ (Hỗ trợ Zalo / WhatsApp)'}
                  </label>
                  <input
                    type="tel"
                    id="input-lead-phone"
                    value={formData.contactPhone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({ ...prev, contactPhone: val }));
                      if (val.trim() && isValidInternationalPhone(val)) {
                        if (errors.contactPhone) {
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.contactPhone;
                            return copy;
                          });
                        }
                      }
                    }}
                    className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-700 text-sm font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all ${
                      errors.contactPhone ? 'border-red-400' : 'border-slate-200'
                    }`}
                    placeholder="e.g. +84912345678"
                  />
                  {errors.contactPhone && <span className="text-[11px] text-red-500 block mt-1">{errors.contactPhone}</span>}

                  {/* Preferred contact channel selector */}
                  <div className="mt-3 bg-slate-50 border border-slate-150 p-2.5 rounded-xl">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      {isEn ? 'Direct Chat Preference Link' : 'Kênh Liên Lạc Trực Tiếp Ưu Tiên'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setContactPref('WhatsApp')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 cursor-pointer transition-all ${
                          contactPref === 'WhatsApp'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full inline-block bg-emerald-500 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>WhatsApp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactPref('Zalo')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 cursor-pointer transition-all ${
                          contactPref === 'Zalo'
                            ? 'bg-sky-50 text-sky-700 border-sky-300 shadow-sm'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full inline-block bg-sky-500 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-450 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                        </span>
                        <span>Zalo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactPref('SMS')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 cursor-pointer transition-all ${
                          contactPref === 'SMS'
                            ? 'bg-slate-100 text-slate-705 border-slate-350 shadow-sm'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-slate-400 inline-block pointer-events-none"></span>
                        <span>{isEn ? 'Standard Call / SMS' : 'Cuộc gọi / SMS thường'}</span>
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1.5 leading-tight">
                      {isEn 
                        ? (formData.serviceDirection === 'Departure' ? 'Our VIP host team will pre-contact you via the checked chat application prior to your scheduled flight.' : 'Our VIP host team will pre-contact you via the checked chat application prior to flight landing.') 
                        : (formData.serviceDirection === 'Departure' ? 'Đội ngũ hỗ trợ VIP của chúng tôi sẽ liên hệ trước với quý khách qua ứng dụng đã chọn trước khi bay.' : 'Đội ngũ hỗ trợ VIP của chúng tôi sẽ liên hệ trước với quý khách qua ứng dụng đã chọn trước khi hạ cánh.')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Special Requests & Medical */}
          <div className="space-y-3">
            <label id="lbl-special" className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              {isEn ? 'Special Escort Configurations (Optional)' : 'Yêu Cầu Hỗ Trợ Đặc Biệt (Tùy Chọn)'}
            </label>
            <div className="relative">
              <MessageSquare className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <textarea
                id="input-special"
                rows={3}
                value={formData.specialRequests}
                onChange={(e) => setFormData((p) => ({ ...p, specialRequests: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-700 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all"
                placeholder={isEn 
                  ? "Mention if you require wheelchair assistance, escort for senior citizens, or stroller handling..." 
                  : "Ghi rõ nếu quý khách cần hỗ trợ xe lăn, người cao tuổi, hoặc xe đẩy trẻ em..."}
              />
            </div>
          </div>

          {/* ADDON SECTION: E-Sim Option & Airport Pickup Combo Option */}
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-6">
            <h4 className="font-display font-extrabold text-[#0B132B] text-sm uppercase tracking-wider flex items-center">
              <Sparkles className="h-4 w-4 text-indigo-600 mr-2 shrink-0" />
              {isEn ? 'Upgrade Premium Addons & Combos' : 'Nâng Cấp Các Gói Đi Kèm & Xe Đưa Đón'}
            </h4>

            <div className="grid grid-cols-1 gap-6">
              {/* Private Shuttle combo option */}
              {formData.airport === 'Phu Quoc (PQC)' ? (
                <div className="p-5 rounded-2xl border border-dashed border-slate-200 bg-slate-100/55 flex flex-col justify-between opacity-80 cursor-not-allowed">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-extrabold text-slate-400 line-through">
                        {isEn ? '🚘 Private Airport Shuttle Combo' : '🚘 Combo Xe Riêng Đưa Đón Sân Bay'}
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-250 text-slate-500 font-sans">
                        {isEn ? 'Not Available' : 'Không hỗ trợ'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                      {isEn 
                        ? 'Private ground transport is currently unavailable at Phu Quoc (PQC). Select SGN, HAN, or DAD to unlock the Airport Shuttle combo.' 
                        : 'Dịch vụ xe đưa đón riêng hiện chưa hỗ trợ tại sân bay Phú Quốc (PQC). Vui lòng chọn SGN, HAN, hoặc DAD để sử dụng combo.'}
                    </p>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-slate-200/50 mt-2">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">{isEn ? 'Status' : 'Trạng thái'}</span>
                    <span className="font-display font-bold text-slate-400 text-xs">
                      {isEn ? 'SGN/HAN/DAD Only' : 'Chỉ áp dụng SGN/HAN/DAD'}
                    </span>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => setAddAirportPickup(!addAirportPickup)}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    addAirportPickup 
                      ? 'border-indigo-500 bg-indigo-50/10 ring-1 ring-indigo-500' 
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-extrabold text-slate-900">
                        {isEn ? '🚘 Private Airport Shuttle Combo' : '🚘 Combo Xe Riêng Đưa Đón Sân Bay'}
                      </span>
                      <input 
                        type="checkbox" 
                        checked={addAirportPickup}
                        onChange={() => {}}
                        className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500" 
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                      {isEn 
                        ? 'Add direct private logistics pickup straight from VIP border exits with professional greeting tablets and baggage handling.' 
                        : 'Thêm dịch vụ xe riêng đón từ cửa ra VIP, có biển chào tên chuyên nghiệp và hỗ trợ khuân vác hành lý.'}
                    </p>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-slate-100 mt-2">
                    <span className="text-[10px] text-slate-450 uppercase font-semibold">{isEn ? 'Logistics flat rate' : 'Giá xe trọn gói'}</span>
                    <span className="font-display font-black text-indigo-600 text-sm">
                      {isEn ? 'from ' : 'từ '}
                      {(() => {
                        const p4 = getVehiclePrice(formData.airport || 'Tan Son Nhat (SGN)', '4 seats');
                        return formatCharge(p4.usd, p4.vnd);
                      })()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* If shuttle combo option is chosen, let them customize vehicle & write address */}
            {addAirportPickup && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 bg-white rounded-2xl border border-slate-200 mt-4 space-y-4 shadow-sm"
                onClick={(e) => e.stopPropagation()} // exclude toggle trigger
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      {isEn ? 'Shuttle Vehicle Fleet' : 'Chọn Dòng Xe Đưa Đón'}
                    </label>
                    <select
                      value={selectedPickupVehicle}
                      onChange={(e) => setSelectedPickupVehicle(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {(() => {
                        const p4 = getVehiclePrice(formData.airport || 'Tan Son Nhat (SGN)', '4 seats');
                        const p7 = getVehiclePrice(formData.airport || 'Tan Son Nhat (SGN)', '7 seats');
                        const p16 = getVehiclePrice(formData.airport || 'Tan Son Nhat (SGN)', '16 seats');
                        return (
                          <>
                            <option value="4 seats">{isEn ? '4 Seats Eco Sedan' : 'Xe Sedan 4 Chỗ Tiết Kiệm'} ({formatCharge(p4.usd, p4.vnd)})</option>
                            <option value="7 seats">{isEn ? '7 Seats Comfort SUV' : 'Xe SUV 7 Chỗ Rộng Rãi'} ({formatCharge(p7.usd, p7.vnd)})</option>
                            <option value="16 seats">{isEn ? '16 Seats Executive Minibus' : 'Xe Minibus 16 Chỗ Cao Cấp'} ({formatCharge(p16.usd, p16.vnd)})</option>
                          </>
                        );
                      })()}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      {isEn ? 'Destination Drop-off Address' : 'Địa Chỉ Khách Sạn / Điểm Đến'}
                    </label>
                    <input
                      type="text"
                      value={pickupDestination}
                      onChange={(e) => setPickupDestination(e.target.value)}
                      placeholder="e.g. Hilton Executive Hotel, Room 302"
                      className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-xs text-slate-705 font-medium focus:ring-2 focus:ring-indigo-500/15 focus:outline-none transition-all ${
                        errors.pickupDestination ? 'border-red-400 bg-red-50/10' : 'border-slate-200'
                      }`}
                    />
                    {errors.pickupDestination && <span className="text-[10px] text-red-500 block mt-1">{errors.pickupDestination}</span>}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Pricing & Checkout Block */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100 flex-wrap">
            <div className="col-span-2 space-y-2 text-slate-500 text-xs leading-relaxed">
              <div className="flex items-center text-slate-800 font-semibold text-xs">
                <Clock className="h-4 w-4 text-emerald-500 mr-2 shrink-0" />
                <span>{isEn ? 'Flight Monitoring Guarantee' : 'Cam Kết Tự Động Theo Dõi Lịch Bay'}</span>
              </div>
              <p>
                {isEn 
                  ? 'Your allocated private assistant tracks active aircraft telemetry. If your flight arrives early or encounters standard delays, the liaison coordinates real-time reassignment Automatically. Guaranteeing worry-free handoff.' 
                  : 'Nhân viên đón tiễn sẽ chủ động theo dõi lịch trình bay thực tế của quý khách. Dù chuyến bay đáp sớm hay bị hoãn chuẩn, chúng tôi luôn tự động điều phối đón tiếp đúng giờ mà không phát sinh thêm chi phí.'}
              </p>
            </div>

            <div className="bg-[#0B132B] text-white p-6 rounded-2xl border border-slate-800 space-y-3">
              <div className="text-xs text-slate-400 uppercase tracking-widest font-mono font-bold">
                {isEn ? 'Billing Breakdown' : 'Chi Tiết Thanh Toán'}
              </div>
              <div className="space-y-2 text-xs">
                <div className={`flex justify-between ${(!hasEsim && !addAirportPickup) ? 'pb-2 border-b border-slate-800 text-slate-300' : 'text-slate-400'}`}>
                  <span>{isEn ? 'Base Rate' : 'Phí Gói Cơ Bản'}</span>
                  <span className="font-semibold text-slate-200">{formatCharge(fees.basePerPax, fees.basePerPaxVnd)}</span>
                </div>
                {hasEsim && (
                  <div className={`flex justify-between text-indigo-300 font-medium ${!addAirportPickup ? 'pb-2 border-b border-slate-800' : ''}`}>
                    <span>{isEn ? 'eSIM Setup' : 'Cài đặt eSIM'}</span>
                    <span>{formatCharge(fees.esimCost, fees.esimCostVnd)}</span>
                  </div>
                )}
                {addAirportPickup && (
                  <>
                    <div className="flex justify-between text-indigo-300 font-medium">
                      <span>{isEn ? 'Airport Shuttle' : 'Xe Đưa Đón'} ({selectedPickupVehicle})</span>
                      <span>{formatCharge(fees.pickupCost, fees.pickupCostVnd)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 font-medium pb-2 border-b border-slate-800">
                      <span>{isEn ? 'Combo Discount' : 'Giảm giá Combo'}</span>
                      <span>-{formatCharge(9, 200000)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center text-sm pt-1">
                  <span className="font-bold text-white">{isEn ? 'Grand Fee' : 'Tổng Chi Phí'}</span>
                  <strong className="text-teal-400 font-display font-black text-xl">
                    {formatCharge(fees.total, fees.totalVnd)}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* VAT invoice option */}
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-900 flex items-center">
                <FileText className="h-4 w-4 text-slate-600 mr-2 shrink-0" />
                {isEn ? '🏢 REQUEST RED VAT INVOICE' : '🏢 YÊU CẦU XUẤT HÓA ĐƠN VAT ĐỎ'}
              </span>
              <input 
                type="checkbox" 
                id="ft-wants-invoice"
                checked={wantsInvoice}
                onChange={() => setWantsInvoice(!wantsInvoice)}
                className="h-4 w-4 rounded text-teal-605 border-slate-300 focus:ring-teal-500 cursor-pointer" 
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
              {isEn 
                ? 'Need a valid corporate expense log? Toggle on this box to request official RED VAT billing registration sent straight to your finance department.' 
                : 'Cần ghi nhận chi phí hợp lệ cho doanh nghiệp của bạn? Đánh dấu ô này để yêu cầu xuất hóa đơn đỏ gửi trực tiếp cho bộ phận kế toán của bạn.'}
            </p>

            {wantsInvoice && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 bg-white border border-slate-200 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {isEn ? 'Company Registered Name' : 'Tên Công Ty Đăng Ký'}
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. DIGIVISA LTD"
                    className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all ${
                      errors.companyName ? 'border-red-400 bg-red-50/15' : 'border-slate-200'
                    }`}
                  />
                  {errors.companyName && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.companyName}</span>}
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {isEn ? 'Tax Code / MST ID' : 'Mã Số Thuế (MST)'}
                  </label>
                  <input
                    type="text"
                    value={taxCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTaxCode(val);
                      if (val.trim() && isValidTaxCode(val) && errors.taxCode) {
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.taxCode;
                          return copy;
                        });
                      }
                    }}
                    placeholder="e.g. 0102030405"
                    className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all ${
                      errors.taxCode ? 'border-red-400 bg-red-50/15' : 'border-slate-200'
                    }`}
                  />
                  {errors.taxCode && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.taxCode}</span>}
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {isEn ? 'Registered Tax Address' : 'Địa Chỉ Đăng Ký Thuế'}
                  </label>
                  <input
                    type="text"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="e.g. 15 Le Loi, Ben Nghe, District 1, HCMC"
                    className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all ${
                      errors.companyAddress ? 'border-red-400 bg-red-50/15' : 'border-slate-200'
                    }`}
                  />
                  {errors.companyAddress && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.companyAddress}</span>}
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {isEn ? 'VAT Invoice Recipient Email (Optional)' : 'Email Nhận Hóa Đơn VAT (Tùy Chọn)'}
                  </label>
                  <input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCompanyEmail(val);
                      if (errors.companyEmail) {
                        if (!val.trim() || isValidEmail(val)) {
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.companyEmail;
                            return copy;
                          });
                        }
                      }
                    }}
                    onBlur={() => {
                      if (companyEmail.trim() && !isValidEmail(companyEmail)) {
                        setErrors((prev) => ({
                          ...prev,
                          companyEmail: isEn 
                            ? 'Valid company invoicing email is required' 
                            : 'Vui lòng nhập email công ty hợp lệ'
                        }));
                      }
                    }}
                    placeholder="e.g. accounting@company.com"
                    className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:outline-none ${
                      errors.companyEmail ? 'border-red-400 bg-red-50/15' : 'border-slate-200'
                    }`}
                  />
                  {errors.companyEmail && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.companyEmail}</span>}
                </div>
              </motion.div>
            )}
          </div>

          {/* Secure Payment Gateway Select Option */}
          <div className="p-6 bg-white border border-slate-200 rounded-3xl space-y-4">
            <h4 className="font-display font-bold text-slate-900 text-sm">
              {isEn ? 'Select Secure Checkout Gateway' : 'Chọn Cổng Thanh Toán Bảo Mật'}
            </h4>
            <div className="grid grid-cols-1 gap-4">
              {/* 9Pay option */}
              <div 
                onClick={() => {
                  if (!validate()) {
                    alert(isEn 
                      ? '⚠️ Please complete all required form fields above (Flight No, Date, Name, Email, Phone) before generating the 9Pay QR code!' 
                      : '⚠️ Vui lòng điền đầy đủ các thông tin bắt buộc phía trên (Số hiệu chuyến bay, Ngày bay, Họ tên, Email, SĐT...) trước khi tạo Mã QR 9Pay!');
                    return;
                  }
                  setPaymentMethod('9pay');
                }}
                className="p-4.5 rounded-2xl border border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-500 shadow-sm cursor-pointer flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2.5 animate-pulse"></span>
                      {isEn ? '9Pay Secured Gateway (Cards / QR / ATM)' : 'Cổng Thanh Toán Bảo Mật 9Pay (Thẻ / QR / ATM)'}
                    </span>
                    <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100/80 border border-indigo-200 px-2 py-0.5 rounded-md uppercase">{isEn ? 'Default Gateway' : 'Cổng Mặc Định'}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {isEn 
                      ? 'After submit you will be redirected to the official 9Pay checkout. Payment is confirmed via signed IPN — not by URL alone.'
                      : 'Sau khi gửi đơn, bạn sẽ được chuyển tới trang thanh toán 9Pay chính thức. Đơn chỉ được xác nhận qua IPN đã ký.'}
                  </p>
                </div>
              </div>
            </div>
 

            {/* Display Domestic bank details if selected */}
            {paymentMethod === 'bank_transfer' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-5 bg-slate-950 text-white rounded-2xl border border-slate-800 space-y-4"
              >
                <div className="flex flex-col sm:flex-row gap-5 items-center">
                  <div className="p-2.5 bg-white rounded-xl shadow-lg shrink-0">
                    <img 
                      src={`https://img.vietqr.io/image/vcb-9999088888-compact2.png?amount=${Math.round(fees.totalVnd)}&addInfo=DVFT${formData.flightNumber || 'FLIGHT'}&accountName=DIGIVISA%20CO%20LTD`} 
                      alt="Napas QR transfer code"
                      className="w-32 h-32 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="space-y-2 flex-1 text-xs">
                    <span className="text-[10px] font-mono font-bold uppercase text-teal-400 tracking-wider">
                      {isEn ? 'NAPAS QUICK TRANSFER' : 'CHUYỂN KHOẢN NHANH NAPAS 24/7'}
                    </span>
                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px] border-t border-slate-800 pt-2 text-slate-300">
                      <div>{isEn ? 'Bank name:' : 'Ngân hàng:'}</div>
                      <div className="font-bold text-white">Vietcombank (VCB)</div>
                      <div>{isEn ? 'Account Number:' : 'Số tài khoản:'}</div>
                      <div className="font-mono font-bold text-white">9999088888</div>
                      <div>{isEn ? 'Beneficiary Name:' : 'Tên thụ hưởng:'}</div>
                      <div className="font-bold text-white">DIGIVISA CO., LTD</div>
                      <div>{isEn ? 'Transfer Amount:' : 'Số tiền chuyển:'}</div>
                      <div className="font-mono font-black text-amber-400">{fees.totalVnd.toLocaleString()} ₫</div>
                      <div>{isEn ? 'Description:' : 'Nội dung chuyển:'}</div>
                      <div className="font-mono font-bold text-teal-400">DVFT{formData.flightNumber || 'FLIGHT'}</div>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-850 pt-2">
                   {isEn 
                     ? 'Immediate automated verification is operational. Once payment completes, submit order to save records immediately.' 
                     : 'Hệ thống tự động xác nhận giao dịch ngay lập tức. Sau khi chuyển tiền thành công, vui lòng ấn nút Đăng ký để gửi hồ sơ.'}
                </div>
              </motion.div>
            )}
          </div>

          {/* Validation error notification banner */}
          {Object.keys(errors).length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start space-x-3">
              <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">
                  {isEn ? 'Please correct the error(s) before proceeding' : 'Vui lòng kiểm tra và sửa các lỗi bên dưới'}
                </span>
                <span className="text-[11px] text-red-600 block">
                  {isEn 
                    ? 'One or more required fields contain invalid format (such as email address).' 
                    : 'Một hoặc nhiều trường bắt buộc chứa thông tin chưa hợp lệ (như địa chỉ email).'}
                </span>
              </div>
            </div>
          )}

          {/* Buttons footer */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onCancel}
              id="fasttrack-back-btn"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 transition-all cursor-pointer"
            >
              {isEn ? 'Cancel' : 'Hủy Bỏ'}
            </button>
            <button
              type="submit"
              id="fasttrack-submit-btn"
              className="flex items-center space-x-2 px-6 py-3.5 bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-teal-500/20 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            >
              <CreditCard className="h-4 w-4" />
              <span>{isEn ? 'Checkout Fast Track Service' : 'Thanh Toán Dịch Vụ Fast Track'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
