import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, Car, Fuel, Users, Navigation, 
  MapPin, ShieldAlert, ArrowRight, CreditCard, Sparkles, Smile, MessageSquare, FileText, Lock
} from 'lucide-react';
import { AirportPickupBooking, Currency, CURRENCY_SYMBOLS, EXCHANGE_RATES, Order } from '../types';
import HistoricalAutofill from './HistoricalAutofill';
import { TimePicker } from './TimePicker';
import { HistoricalProfile } from '../data/historicalUsers';
import { safeStorage, safeOpen } from '../utils/storage';
import { isValidEmail, isValidInternationalPhone, isValidTaxCode, isValidFlightNumber, sanitizeFlightNumber, formatPhoneE164 } from '../utils/validation';
import { generateOrderId, generateTrackingToken } from '../utils/orderIds';
import { Language } from '../utils/translations';
// @ts-ignore
import ecoSedanImg from '../assets/images/eco_sedan_1781328905917.jpg';
// @ts-ignore
import comfortSuvImg from '../assets/images/comfort_suv_1781328920403.jpg';
// @ts-ignore
import executiveMinibusImg from '../assets/images/executive_minibus_1781328933091.jpg';

interface AirportPickupFormProps {
  currency: Currency;
  language: Language;
  onSuccess: (newOrder: Order) => void;
  onCancel: () => void;
}

export default function AirportPickupForm({ currency, language, onSuccess, onCancel }: AirportPickupFormProps) {
  const isEn = language === 'EN';

  const initialDraft = React.useMemo(() => {
    try {
      const saved = safeStorage.getItem('digivisa_airport_pickup_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.formData && typeof parsed.formData === 'object' && parsed.formData.vehicleType) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse initial airport pickup draft:', e);
    }
    safeStorage.removeItem('digivisa_airport_pickup_draft');
    return null;
  }, []);

  const [formData, setFormData] = useState<Omit<AirportPickupBooking, 'totalFee' | 'direction' | 'pickupAddress' | 'addFastTrack'>>(() => {
    const defaultData = {
      airport: 'Tan Son Nhat (SGN)',
      pickupDate: '',
      pickupTime: '',
      flightNumber: '',
      destinationAddress: '',
      vehicleType: '4 seats' as const,
      passengerName: '',
      passengerPhone: '',
      passengerEmail: '',
      terminalNumber: 'International Arrivals (Main)',
    };
    if (initialDraft && initialDraft.formData && typeof initialDraft.formData === 'object') {
      return { ...defaultData, ...initialDraft.formData };
    }
    return defaultData;
  });

  const isAirportPickupFormValid = () => {
    return !!(
      (formData?.flightNumber || '')?.trim() &&
      formData?.pickupDate &&
      (formData?.passengerName || '')?.trim() &&
      (formData?.passengerEmail || '')?.trim() &&
      isValidEmail(formData?.passengerEmail || '') &&
      (formData?.passengerPhone || '')?.trim()
    );
  };

  const [orderIdPreview] = useState(() => (initialDraft && initialDraft.orderId) || generateOrderId());
  const [errors, setErrors] = useState<Record<string, string>>({});

  // New requirements states
  const [direction, setDirection] = useState<'Arrival' | 'Departure'>(() => (initialDraft && initialDraft.direction) ?? 'Arrival');
  const [pickupAddress, setPickupAddress] = useState<string>(() => (initialDraft && initialDraft.pickupAddress) ?? '');
  const [destinationAddress, setDestinationAddress] = useState<string>(() => (initialDraft && initialDraft.destinationAddress) ?? '');
  const [optionalNote, setOptionalNote] = useState<string>(() => (initialDraft && initialDraft.optionalNote) ?? '');
  const [contactPref, setContactPref] = useState<'WhatsApp' | 'Zalo' | 'SMS'>(() => (initialDraft && initialDraft.contactPref) ?? 'WhatsApp');
  
  const [addFastTrack, setAddFastTrack] = useState<boolean>(() => (initialDraft && initialDraft.addFastTrack) ?? false);
  const [fastTrackType, setFastTrackType] = useState<AirportPickupBooking['fastTrackType']>(() => (initialDraft && initialDraft.fastTrackType) ?? 'VIP Meet & Assist');

  const [wantsInvoice, setWantsInvoice] = useState<boolean>(() => (initialDraft && initialDraft.wantsInvoice) ?? false);
  const [companyName, setCompanyName] = useState<string>(() => (initialDraft && initialDraft.companyName) ?? '');
  const [taxCode, setTaxCode] = useState<string>(() => (initialDraft && initialDraft.taxCode) ?? '');
  const [companyAddress, setCompanyAddress] = useState<string>(() => (initialDraft && initialDraft.companyAddress) ?? '');
  const [companyEmail, setCompanyEmail] = useState<string>(() => (initialDraft && initialDraft.companyEmail) ?? '');

  const [paymentMethod, setPaymentMethod] = useState<'9pay' | 'bank_transfer'>(() => (initialDraft && initialDraft.paymentMethod) ?? '9pay');
  const [isRedirecting, setIsRedirecting] = useState(false);

  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(() => {
    if (initialDraft && initialDraft.formData) {
      const f = initialDraft.formData;
      return !!(f.flightNumber || f.passengerName || f.passengerEmail);
    }
    return false;
  });

  // Save/Update draft on state changes (auto-save)
  React.useEffect(() => {
    const draft = {
      formData,
      direction,
      pickupAddress,
      destinationAddress,
      optionalNote,
      contactPref,
      addFastTrack,
      fastTrackType,
      paymentMethod,
      wantsInvoice,
      companyName,
      taxCode,
      companyAddress,
      companyEmail
    };
    safeStorage.setItem('digivisa_airport_pickup_draft', JSON.stringify(draft));
  }, [formData, direction, pickupAddress, destinationAddress, optionalNote, contactPref, addFastTrack, fastTrackType, paymentMethod, wantsInvoice, companyName, taxCode, companyAddress, companyEmail]);

  const handleResetDraft = () => {
    safeStorage.removeItem('digivisa_airport_pickup_draft');
    setFormData({
      airport: 'Tan Son Nhat (SGN)',
      pickupDate: '',
      pickupTime: '',
      flightNumber: '',
      destinationAddress: '',
      vehicleType: '4 seats',
      passengerName: '',
      passengerPhone: '',
      passengerEmail: '',
      terminalNumber: 'International Arrivals (Main)',
    });
    setDirection('Arrival');
    setPickupAddress('');
    setDestinationAddress('');
    setOptionalNote('');
    setContactPref('WhatsApp');
    setAddFastTrack(false);
    setFastTrackType('VIP Meet & Assist');
    setWantsInvoice(false);
    setCompanyName('');
    setTaxCode('');
    setCompanyAddress('');
    setCompanyEmail('');
    setPaymentMethod('9pay');
    setHasRestoredDraft(false);
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

  const FLEET_SPECS: Record<AirportPickupBooking['vehicleType'], { maxPax: number; maxLuggage: number; sampleModels: string; label: string }> = {
    '4 seats': { maxPax: 3, maxLuggage: 2, sampleModels: isEn ? 'Standard Eco Sedan' : 'Dòng xe Sedan Tiêu chuẩn', label: '4 Seats (Eco Sedan)' },
    '7 seats': { maxPax: 6, maxLuggage: 5, sampleModels: isEn ? 'Comfort Family SUV' : 'Dòng xe SUV Gia đình Rộng rãi', label: '7 Seats (Comfort SUV)' },
    '16 seats': { maxPax: 15, maxLuggage: 12, sampleModels: isEn ? 'Executive Minibus Van' : 'Dòng xe Minibus Cao cấp', label: '16 Seats (Executive Minibus)' },
  };

  const FAST_TRACK_RATES = {
    'VIP Meet & Assist': 45,
    'Premium Fast Track': 48,
    'Elite Lounges Gate-to-Gate': 55,
  };

  const getCalculatedFees = () => {
    const vPrice = getVehiclePrice(formData?.airport || 'Tan Son Nhat (SGN)', formData?.vehicleType || '4 seats');
    const base = vPrice.usd;
    const baseVnd = vPrice.vnd;
    
    // Add Fast Track Combo fee which is flat-rate
    const fastTrackCost = addFastTrack ? FAST_TRACK_RATES[fastTrackType || 'VIP Meet & Assist'] : 0;
    
    // Map fast track cost to VND
    const fastTrackExactVnd: Record<number, number> = {
      0: 0,
      45: 1150000,
      48: 1250000,
      55: 1400000,
    };
    const fastTrackCostVnd = fastTrackExactVnd[fastTrackCost] ?? (fastTrackCost * 25000);
    
    let total = base + fastTrackCost;
    let totalVnd = baseVnd + fastTrackCostVnd;

    if (addFastTrack) {
      total = Math.max(0, total - 9);
      totalVnd = Math.max(0, totalVnd - 200000);
    }

    return {
      base,
      baseVnd,
      fastTrackCost,
      fastTrackCostVnd,
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
    return `$ ${val.toFixed(2)}`;
  };

  const validate = () => {
    const freshErrors: Record<string, string> = {};
    const fn = (formData?.flightNumber || '').trim();
    const pn = (formData?.passengerName || '').trim();
    const pe = (formData?.passengerEmail || '').trim();
    const pp = (formData?.passengerPhone || '').trim();
    const da = (destinationAddress || '').trim();
    const pa = (pickupAddress || '').trim();
    const cn = (companyName || '').trim();
    const tc = (taxCode || '').trim();
    const ca = (companyAddress || '').trim();
    const ce = (companyEmail || '').trim();

    if (!formData?.pickupDate) {
      freshErrors.pickupDate = isEn ? 'Pickup date is required' : 'Vui lòng chọn ngày đón';
    } else {
      const todayStr = new Date().toISOString().split('T')[0];
      if (formData.pickupDate < todayStr) {
        freshErrors.pickupDate = isEn ? 'Pickup date cannot be in the past' : 'Ngày đón không thể ở quá khứ';
      }
    }
    if (!formData?.pickupTime) {
      freshErrors.pickupTime = isEn ? 'Pickup time is required' : 'Vui lòng chọn giờ đón';
    }
    if (direction === 'Arrival') {
      if (!fn) {
        freshErrors.flightNumber = isEn ? 'Flight number is required for monitoring' : 'Vui lòng nhập số hiệu chuyến bay để theo dõi';
      } else if (!isValidFlightNumber(fn)) {
        freshErrors.flightNumber = isEn 
          ? 'Invalid IATA flight number format (2-character airline code followed by 1 to 4 digits, e.g., VN123, SQ318, U2456)' 
          : 'Số hiệu chuyến bay chuẩn IATA không hợp lệ (mã hãng 2 ký tự và từ 1 đến 4 chữ số, VD: VN123, SQ318, U2456)';
      }
    }
    
    // Direction handling address checks
    if (direction === 'Arrival') {
      if (!da) {
        freshErrors.destinationAddress = isEn ? 'Destination drop-off is required' : 'Vui lòng nhập địa chỉ điểm đến';
      }
    } else {
      if (!pa) {
        freshErrors.pickupAddress = isEn ? 'City pickup location is required' : 'Vui lòng nhập địa chỉ điểm đón trong thành phố';
      }
    }

    if (!pn) {
      freshErrors.passengerName = isEn ? 'Passenger name is required' : 'Vui lòng nhập tên hành khách';
    }
    if (!pe || !isValidEmail(pe)) {
      freshErrors.passengerEmail = isEn ? 'A valid suitable email address is required (e.g. user@example.com)' : 'Vui lòng nhập địa chỉ email hợp lệ (VD: user@example.com)';
    }
    if (!pp) {
      freshErrors.passengerPhone = isEn ? 'Passenger mobile number is required' : 'Vui lòng nhập số điện thoại hành khách';
    } else if (!isValidInternationalPhone(pp)) {
      freshErrors.passengerPhone = isEn 
        ? 'Phone number must be in valid international format (e.g., +84912345678)' 
        : 'Số điện thoại phải theo định dạng quốc tế (VD: +84912345678)';
    }

    if (wantsInvoice) {
      if (!cn) {
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
      if (ce && !isValidEmail(ce)) {
        freshErrors.companyEmail = isEn ? 'Valid company invoicing email is required' : 'Vui lòng nhập email công ty hợp lệ';
      }
    }

    setErrors(freshErrors);
    return Object.keys(freshErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      alert(isEn 
        ? '⚠️ Please complete all required fields highlighted in red (Flight No, Pickup Date, Time, Address, Name, Email, Phone) before proceeding to 9Pay Checkout!' 
        : '⚠️ Vui lòng điền đầy đủ các thông tin còn thiếu (được đánh dấu khung đỏ phía trên như Số hiệu chuyến bay, Ngày/Giờ đón, Địa chỉ, Họ tên, Email, SĐT...) trước khi chuyển hướng 9Pay!');
      setTimeout(() => {
        const errField = document.querySelector('.border-red-400, .border-red-500');
        if (errField) {
          errField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    const orderId = orderIdPreview;
    const trackingToken = generateTrackingToken();

    const finalBooking: AirportPickupBooking = {
      ...formData,
      flightNumber: direction === 'Arrival' ? formData.flightNumber : '',
      passengerPhone: `${formData.passengerPhone} (${contactPref})`,
      pickupAddress: direction === 'Arrival' ? 'Airport (Inbound Terminal)' : pickupAddress,
      destinationAddress: direction === 'Arrival' ? destinationAddress : 'Airport (Departures Terminal)',
      direction,
      serviceDirection: direction,
      optionalNote,
      addFastTrack,
      fastTrackType: addFastTrack ? fastTrackType : undefined,
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
      type: 'AirportPickup',
      status: 'Pending Payment',
      createdAt: new Date().toISOString(),
      paymentStatus: 'Pending',
      trackingToken,
      details: finalBooking,
    };
    onSuccess(newOrder);
  };

  const isSedanOverloaded = false;
  const currentSpec = FLEET_SPECS[formData.vehicleType];

  return (
    <div className="max-w-4xl mx-auto" id="pickup-flow-container">
      {/* 9Pay Loading Redirect overlay */}
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
                  <div className="absolute inset-0 rounded-full border-4 border-t-indigo-505 border-r-indigo-500/20 border-b-indigo-500/10 border-l-indigo-500/30 animate-spin"></div>
                  <div className="absolute inset-2 bg-slate-950 rounded-full flex items-center justify-center">
                    <span className="font-display font-extrabold text-[10px] text-indigo-400">9Pay</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-extrabold text-lg">
                  {isEn ? 'Connecting to 9Pay Gate' : 'Đang kết nối tới cổng thanh toán 9Pay'}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  {isEn 
                    ? "Please wait while we transfer your shuttle transfer transaction to 9Pay's secured checkout." 
                    : 'Vui lòng chờ trong giây lát khi chúng tôi chuyển giao dịch đặt xe của bạn tới cổng thanh toán bảo mật 9Pay.'}
                </p>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span>{isEn ? 'Merchant ID:' : 'Mã đối tác:'}</span>
                  <span className="font-mono text-slate-400">DIGIVISA-SHUTTLE</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>{isEn ? 'USD Charge Amount:' : 'Số tiền thanh toán USD:'}</span>
                  <strong className="text-teal-400 font-mono font-bold">${fees.total.toFixed(2)} USD</strong>
                </div>
              </div>
              <div className="text-[10px] text-amber-500 font-medium">
                {isEn 
                  ? '⚠️ Secure payment page will load in an external browser tab.' 
                  : '⚠️ Trang thanh toán an toàn sẽ được tải ở một tab trình duyệt mới.'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top navbar controls */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onCancel}
          id="pickup-cancel-back"
          className="flex items-center space-x-2 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{isEn ? 'Back to Landing' : 'Quay Lại Trang Chủ'}</span>
        </button>
        <span className="text-xs font-mono font-bold bg-slate-50 text-slate-600 border border-slate-200 rounded-full px-3 py-1">
          {isEn ? 'GPS MONITORING ENABLED DRIVERS' : 'TÀI XẾ ĐƯỢC GIÁM SÁT ĐỊNH VỊ GPS'}
        </span>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        
        {/* Main top welcome banner */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-[#121B35] px-6 py-6 sm:px-10 sm:py-8 text-white">
          <div className="flex items-center space-x-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 px-3 py-1 rounded-full text-[10px] font-mono font-bold w-fit uppercase mb-4 select-none">
            {isEn ? '🚖 PROFESSIONAL MEET & GREET' : '🚖 ĐÓN TIỄN SÂN BAY CHUYÊN NGHIỆP'}
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">
            {isEn ? 'Private Airport Shuttle Transfer' : 'Xe Đưa Đón Sân Bay Riêng'}
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            {isEn 
              ? 'Pre-book a vetted private transfer pilot. Private drivers greet you in the arrivals lobby holding a custom digital tablet displaying your name, managing bags seamlessly.' 
              : 'Đặt trước xe riêng với tài xế chuyên nghiệp đã được xác minh. Tài xế đón bạn tại sảnh chờ ga đến với bảng tên điện tử, hỗ trợ mang hành lý chu đáo.'}
          </p>

          {hasRestoredDraft && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-amber-550/15 border border-amber-500/20 rounded-2xl text-xs text-amber-300" id="airportpickup-draft-alert">
              <div className="flex items-center space-x-2 border-b border-amber-500/10 sm:border-0 pb-2 sm:pb-0">
                <span className="flex h-2 w-2 rounded-full bg-amber-400 relative animate-pulse shrink-0" />
                <span className="font-sans">
                  <strong>{isEn ? 'Restored Draft state:' : 'Trạng thái Bản Nháp đã phục hồi:'}</strong> {isEn ? 'Loaded previous shuttle route progress.' : 'Đã phục hồi tiến trình đặt xe sân bay trước đó của bạn.'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetDraft}
                className="mt-1 sm:mt-0 text-amber-400 hover:text-amber-300 underline font-bold transition-all shrink-0 cursor-pointer text-[11px]"
              >
                {isEn ? 'Clear Form & Start Fresh' : 'Xóa Form & Làm Mới'}
              </button>
            </div>
          )}
        </div>

        <form noValidate onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-8">
          
          <HistoricalAutofill
            serviceType="AirportPickup"
            onSelect={(profile: any) => {
              const nameCandidate = (profile.firstName || profile.lastName) 
                ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() 
                : (profile.passengerName || profile.fullName || '');
              
              const validVehicles = ['4 seats', '7 seats', '16 seats', 'Test Sandbox'];
              const safeVehicle = validVehicles.includes(profile.vehicleType)
                ? profile.vehicleType
                : '4 seats';

              setFormData((prev) => ({
                ...prev,
                passengerName: nameCandidate || prev.passengerName,
                passengerPhone: profile.phone ? formatPhoneE164(profile.phone) : prev.passengerPhone,
                passengerEmail: profile.email || prev.passengerEmail,
                vehicleType: safeVehicle as any,
                flightNumber: profile.flightNumber || prev.flightNumber || '',
              }));
              if (profile.destinationAddress) setDestinationAddress(profile.destinationAddress);
              if (profile.pickupAddress) setPickupAddress(profile.pickupAddress);
              if (profile.specialRequests) setOptionalNote(profile.specialRequests || '');
              
              if (profile.wantsInvoice !== undefined) {
                setWantsInvoice(!!profile.wantsInvoice);
                if (profile.wantsInvoice) {
                  setCompanyName(profile.companyName || '');
                  setTaxCode(profile.taxCode || '');
                  setCompanyAddress(profile.companyAddress || '');
                  setCompanyEmail(profile.companyEmail || '');
                }
              }
            }}
          />

          {/* STEP 1: Fleet Selection */}
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="font-display font-bold text-slate-900 text-lg">
                {isEn ? '1. Select Private Vehicle Fleet' : '1. Chọn Loại Xe Đưa Đón Riêng'}
              </h3>
              <p className="text-slate-500 text-xs">
                {isEn 
                  ? 'All private vehicles are fully air-conditioned, feature complimentary chilled bottled water, and high speed passenger WiFi.' 
                  : 'Tất cả các dòng xe đều được trang bị điều hòa hai chiều, phục vụ nước lạnh miễn phí và kết nối WiFi tốc độ cao.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { id: '4 seats', title: isEn ? '4 Seats Eco Sedan' : 'Xe 4 Chỗ (Eco Sedan)' },
                { id: '7 seats', title: isEn ? '7 Seats Comfort SUV' : 'Xe 7 Chỗ (Comfort SUV)' },
                { id: '16 seats', title: isEn ? '16 Seats Executive Minibus' : 'Xe 16 Chỗ (Executive Minibus)' },
                { id: 'Test Sandbox', title: isEn ? '⚡ Sandbox Test Package (10,000 VND)' : '⚡ Gói Test Sandbox (10.000 VNĐ)' },
                ].map((car) => {
                const vPrice = car.id === 'Test Sandbox' ? { usd: 0.4, vnd: 10000 } : getVehiclePrice(formData.airport || 'Tan Son Nhat (SGN)', car.id as any);
                const spec = car.id === 'Test Sandbox' 
                  ? { maxPax: 1, maxLuggage: 0, sampleModels: 'Gói nạp thử 10.000 VNĐ Cổng 9Pay', label: '10,000 VND Test Charge' }
                  : FLEET_SPECS[car.id as AirportPickupBooking['vehicleType']] || FLEET_SPECS['4 seats'];
                const isSelected = formData.vehicleType === car.id;
                return (
                  <div
                    key={car.id}
                    onClick={() => setFormData((p) => ({ ...p, vehicleType: car.id as AirportPickupBooking['vehicleType'] }))}
                    className={`rounded-2xl p-4 border cursor-pointer flex flex-col justify-between transition-all ${
                      isSelected 
                        ? 'border-indigo-500 bg-indigo-50/10 ring-1 ring-indigo-500 shadow-sm shadow-indigo-500/10' 
                        : 'border-slate-150 hover:border-slate-300 bg-slate-50/40'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="relative h-28 sm:h-32 w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner">
                        <img 
                          src={car.id === '4 seats' ? ecoSedanImg : car.id === '7 seats' ? comfortSuvImg : executiveMinibusImg} 
                          alt={car.title}
                          className="w-full h-full object-cover transition-all duration-300 hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex items-center justify-between animate-fade-in">
                        <span className="font-display font-bold text-slate-800 text-[13px]">{car.title}</span>
                        <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-indigo-500' : 'border-slate-300'}`}>
                          {isSelected && <div className="h-2 w-2 rounded-full bg-indigo-500" />}
                        </div>
                      </div>

                      <div className="flex items-baseline space-x-1">
                        <span className="font-display font-black text-2xl text-slate-900">{formatCharge(vPrice.usd, vPrice.vnd)}</span>
                        <span className="text-[10px] text-slate-400 font-medium font-sans">{isEn ? 'flat-rate' : 'giá trọn gói'}</span>
                      </div>

                      <p className="text-[10px] text-indigo-600 font-mono font-medium truncate">{spec.sampleModels}</p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-150 flex items-center space-x-3 text-[10px] text-slate-500 font-semibold select-none">
                      <div className="flex items-center space-x-1">
                        <Users className="h-3 w-3 text-slate-400" />
                        <span>{isEn ? `Max ${spec.maxPax} passengers` : `Tối đa ${spec.maxPax} hành khách`}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>



          {/* STEP 2: Logistics & Direction selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 pt-6">
            
            {/* Logistics details */}
            <div className="space-y-4">
              <h3 className="font-display font-bold text-slate-900 text-base border-b border-slate-100 pb-1.5 flex items-center">
                <Navigation className="h-4 w-4 mr-2 text-indigo-500" />
                {isEn ? '2. Transport Direction & Logistics' : '2. Chi Tiết Lộ Trình & Hướng Di Chuyển'}
              </h3>
              
              {/* Direction selector buttons */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {isEn ? 'Select Service Direction' : 'Chọn Hướng Đưa Đón'}
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setDirection('Arrival');
                      setPickupAddress('');
                    }}
                    className={`py-2 px-3 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                      direction === 'Arrival' 
                        ? 'bg-white text-indigo-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {isEn ? '🛬 Arrival (To City)' : '🛬 Chiều Đến (Về Thành Phố)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirection('Departure');
                      setDestinationAddress('');
                    }}
                    className={`py-2 px-3 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                      direction === 'Departure' 
                        ? 'bg-white text-indigo-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {isEn ? '🛫 Departure (To Airport)' : '🛫 Chiều Đi (Ra Sân Bay)'}
                  </button>
                </div>
              </div>

              {/* Airport Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  {isEn ? 'Serviced Airport' : 'Sân Bay Phục Vụ'}
                </label>
                <select
                  value={formData.airport || 'Tan Son Nhat (SGN)'}
                  onChange={(e) => setFormData((prev) => ({ ...prev, airport: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-705 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="Tan Son Nhat (SGN)">{isEn ? 'Tan Son Nhat (SGN) - Ho Chi Minh City' : 'Sân bay Tân Sơn Nhất (SGN) - TP. HCM'}</option>
                  <option value="Noi Bai (HAN)">{isEn ? 'Noi Bai (HAN) - Hanoi' : 'Sân bay Nội Bài (HAN) - Hà Nội'}</option>
                  <option value="Da Nang (DAD)">{isEn ? 'Da Nang (DAD) - Da Nang' : 'Sân bay Đà Nẵng (DAD) - Đà Nẵng'}</option>
                </select>
              </div>

              {/* Conditional address rendering based on direction choice */}
              <div className="space-y-4">
                {direction === 'Arrival' ? (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      {isEn ? 'Destination Drop-off Address' : 'Địa Chỉ Điểm Đến / Trả Khách'}
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={destinationAddress}
                        onChange={(e) => setDestinationAddress(e.target.value)}
                        className={`w-full bg-slate-50 border rounded-xl pl-10 pr-4 py-3 text-slate-705 text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none transition-all ${
                          errors.destinationAddress ? 'border-red-400 animate-pulse bg-red-50/10' : 'border-slate-200'
                        }`}
                        placeholder={isEn ? 'e.g. Hilton Executive Hotel, Room 104' : 'VD: Khách sạn Hilton, Phòng 104'}
                      />
                    </div>
                    {errors.destinationAddress && <span className="text-[11px] text-red-500 block mt-1">{errors.destinationAddress}</span>}
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      {isEn ? 'Pickup Address (From city / hotel / residence)' : 'Địa Chỉ Điểm Đón (Từ Thành Phố / Khách Sạn / Nhà Riêng)'}
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={pickupAddress}
                        onChange={(e) => setPickupAddress(e.target.value)}
                        className={`w-full bg-slate-50 border rounded-xl pl-10 pr-4 py-3 text-slate-705 text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none transition-all ${
                          errors.pickupAddress ? 'border-red-400 animate-pulse bg-red-50/10' : 'border-slate-200'
                        }`}
                        placeholder={isEn ? 'e.g. 15 Le Loi Street, Dist 1, HCMC' : 'VD: Số 15 Lê Lợi, Quận 1, TP. HCM'}
                      />
                    </div>
                    {errors.pickupAddress && <span className="text-[11px] text-red-500 block mt-1">{errors.pickupAddress}</span>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label id="lbl-pickup-date" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      {isEn ? 'Pickup Date' : 'Ngày Đón'}
                    </label>
                    <input
                      type="date"
                      value={formData.pickupDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => {
                        const val = e.target.value;
                        const todayStr = new Date().toISOString().split('T')[0];
                        setFormData((prev) => ({ 
                          ...prev, 
                          pickupDate: val,
                          pickupTime: prev.pickupTime || '12:00' 
                        }));
                        if (val && val < todayStr) {
                          setErrors((prev) => ({
                            ...prev,
                            pickupDate: isEn ? 'Pickup date cannot be in the past' : 'Ngày đón không thể ở quá khứ'
                          }));
                        } else if (errors.pickupDate) {
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.pickupDate;
                            return copy;
                          });
                        }
                      }}
                      className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-700 text-sm font-medium focus:ring-2 focus:outline-none transition-all ${
                        errors.pickupDate ? 'border-red-400 bg-red-50/15' : 'border-slate-200'
                      }`}
                    />
                    {errors.pickupDate && <span className="text-[11px] text-red-500 block mt-1">{errors.pickupDate}</span>}
                  </div>

                  <div>
                    <TimePicker
                      id="input-pickup-time"
                      value={formData.pickupTime}
                      onChange={(val) => {
                        setFormData((prev) => ({ ...prev, pickupTime: val }));
                        if (val.trim() && errors.pickupTime) {
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.pickupTime;
                            return copy;
                          });
                        }
                      }}
                      label={isEn ? 'Pickup Time' : 'Giờ Đón'}
                      error={errors.pickupTime}
                      isEn={isEn}
                    />
                  </div>
                </div>

                {direction === 'Arrival' && (
                  <div>
                    <label id="lbl-p-flight" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      {isEn ? 'Flight Code / Number' : 'Số Hiệu Chuyến Bay'}
                    </label>
                    <input
                      type="text"
                      value={formData.flightNumber}
                      onChange={(e) => {
                        const sanitized = sanitizeFlightNumber(e.target.value);
                        setFormData((current) => ({ ...current, flightNumber: sanitized }));
                        if (sanitized && isValidFlightNumber(sanitized) && errors.flightNumber) {
                          setErrors((prevErr) => {
                            const copy = { ...prevErr };
                            delete copy.flightNumber;
                            return copy;
                          });
                        }
                      }}
                      className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-700 text-sm font-medium focus:ring-2 focus:outline-none transition-all uppercase font-mono ${
                        errors.flightNumber ? 'border-red-400 bg-red-50/10' : 'border-slate-200'
                      }`}
                      placeholder={isEn ? 'e.g. EK349, VN257' : 'VD: EK349, VN257'}
                    />
                    {errors.flightNumber && <span className="text-[11px] text-red-500 block mt-1">{errors.flightNumber}</span>}
                  </div>
                )}


              </div>
            </div>

            {/* Travel contact details */}
            <div className="space-y-4">
              <h3 className="font-display font-bold text-slate-900 text-base border-b border-slate-100 pb-1.5 flex items-center">
                <Smile className="h-4 w-4 text-indigo-500 mr-2 shrink-0" />
                {isEn ? '3. Main Passenger Credentials' : '3. Thông Tin Hành Khách Chính'}
              </h3>
              
              <div className="space-y-4 font-sans">
                <div>
                  <label id="lbl-passenger-name" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {isEn ? 'Passenger Board Title (Name on Driver Tablet)' : 'Họ Tên Hiển Thị Trên Bảng Chào Đón (Của tài xế)'}
                  </label>
                  <input
                    type="text"
                    value={formData.passengerName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, passengerName: e.target.value }))}
                    className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-700 text-sm font-medium focus:ring-2 focus:outline-none transition-all ${
                      errors.passengerName ? 'border-red-400' : 'border-slate-200'
                    }`}
                    placeholder={isEn ? 'e.g. Dr. Eleanor Vance' : 'VD: NGUYEN VAN A'}
                  />
                  {errors.passengerName && <span className="text-[11px] text-red-500 block mt-1">{errors.passengerName}</span>}
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {isEn ? 'Written exactly onto chauffeur greeting board.' : 'Được hiển thị chính xác trên bảng đón điện tử của tài xế.'}
                  </span>
                </div>

                <div>
                  <label id="lbl-passenger-phone" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {isEn ? 'Primary Contact Number (Zalo / WhatsApp Supported)' : 'Số Điện Thoại Liên Hệ Chính (Hỗ trợ Zalo / WhatsApp)'}
                  </label>
                  <input
                    type="tel"
                    value={formData.passengerPhone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({ ...prev, passengerPhone: val }));
                      if (val.trim() && isValidInternationalPhone(val)) {
                        if (errors.passengerPhone) {
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.passengerPhone;
                            return copy;
                          });
                        }
                      }
                    }}
                    className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-705 text-sm font-medium focus:ring-2 focus:outline-none transition-all ${
                      errors.passengerPhone ? 'border-red-400' : 'border-slate-200'
                    }`}
                    placeholder="e.g. +84912345678"
                  />
                  {errors.passengerPhone && <span className="text-[11px] text-red-500 block mt-1">{errors.passengerPhone}</span>}

                  {/* Preferred contact platform selector */}
                  <div className="mt-3 bg-slate-50 border border-slate-150 p-2.5 rounded-xl">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      {isEn ? 'Direct Chat Preference Link' : 'Kênh Liên Lạc Nhận Tin Ưu Tiên'}
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
                        <span>WhatsApp Link</span>
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
                        <span>Zalo Link</span>
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
                        <span>{isEn ? 'Standard Call / SMS' : 'Điện thoại / SMS Thường'}</span>
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1.5 leading-tight">
                      {isEn 
                        ? 'Digivisa drivers and liaisons will pre-coordinate your meet & greet via the selected app.' 
                        : 'Tài xế và điều phối viên Digivisa sẽ liên hệ trước để sắp xếp điểm đón qua ứng dụng đã chọn.'}
                    </span>
                  </div>
                </div>

                <div>
                  <label id="lbl-passenger-email" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {isEn ? 'Receipt Email Address' : 'Địa Chỉ Email Nhận Hóa Đơn / Vé Xe'}
                  </label>
                  <input
                    type="email"
                    value={formData.passengerEmail}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({ ...prev, passengerEmail: val }));
                      if (errors.passengerEmail) {
                        if (!val.trim() || isValidEmail(val)) {
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.passengerEmail;
                            return copy;
                          });
                        }
                      }
                    }}
                    onBlur={() => {
                      if (formData.passengerEmail.trim() && !isValidEmail(formData.passengerEmail)) {
                        setErrors((prev) => ({
                          ...prev,
                          passengerEmail: isEn 
                            ? 'A valid suitable email address is required (e.g. user@example.com)' 
                            : 'Vui lòng nhập địa chỉ email hợp lệ (VD: user@example.com)'
                        }));
                      }
                    }}
                    className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-800 text-sm font-medium focus:ring-2 focus:outline-none transition-all ${
                      errors.passengerEmail ? 'border-red-400 bg-red-50/10' : 'border-slate-200'
                    }`}
                    placeholder="email@airport-transfer.com"
                  />
                  {errors.passengerEmail && <span className="text-[11px] text-red-500 font-medium block mt-1">{errors.passengerEmail}</span>}
                </div>

                {/* Optional note field */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center">
                    <MessageSquare className="h-3.5 w-3.5 text-slate-400 mr-2.5 shrink-0" />
                    {isEn ? 'Special Chauffeur Operations Notes (Optional)' : 'Yêu Cầu Đặc Biệt Cho Tài Xế (Không bắt buộc)'}
                  </label>
                  <textarea
                    rows={2}
                    value={optionalNote}
                    onChange={(e) => setOptionalNote(e.target.value)}
                    placeholder={isEn 
                      ? 'Add instruction such as kid seating pads, passenger age alerts, physical aids, delayed connection warnings, etc.' 
                      : 'Nhập thêm các hướng dẫn đặc biệt như ghế ngồi cho trẻ em, độ tuổi hành khách, hỗ trợ di chuyển, cảnh báo chuyến bay nối chuyến trễ, v.v.'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* COMBO UPGRADE SECTION */}
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-900 flex items-center">
                <Sparkles className="h-4 w-4 text-indigo-600 mr-2 shrink-0 animate-bounce" />
                {isEn ? '🌟 ADD FAST TRACK AIRPORT IMMIGRATION (COMBO SPECIAL)' : '🌟 ĐĂNG KÝ THÊM THỦ TỤC NHẬP CẢNH NHANH (ƯU ĐÃI COMBO)'}
              </span>
              <input 
                type="checkbox" 
                checked={addFastTrack}
                onChange={() => setAddFastTrack(!addFastTrack)}
                className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-505 cursor-pointer" 
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
              {isEn 
                ? "Don't stand in massive lines. Bundle key premium airport fast tracking with your ground transport for quick terminal assistance and speed lanes VIP passage." 
                : 'Không cần xếp hàng mỏi mệt. Đăng ký trọn gói dịch vụ hỗ trợ nhập cảnh nhanh cùng xe đưa đón để được đón tiếp riêng, làm thủ tục hải quan làn nhanh VIP siêu tốc.'}
            </p>

            {addFastTrack && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 bg-white border border-slate-150 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-3"
              >
                {[
                  { id: 'VIP Meet & Assist', title: isEn ? 'Standard Fast Track' : 'Fast Track Tiêu chuẩn', price: 45, desc: isEn ? 'Personal meeting and priority pathway lines' : 'Đón tiếp riêng tại ống lồng và làm thủ tục làn VIP ưu tiên' },
                  { id: 'Premium Fast Track', title: isEn ? 'Business Fast Track' : 'Fast Track Thương gia', price: 48, desc: isEn ? 'Baggage support, fast lines and visa helper' : 'Hỗ trợ hành lý từ sảnh ra, làm hải quan làn siêu tốc & visa' },
                  { id: 'Elite Lounges Gate-to-Gate', title: isEn ? 'VIP Fast Track' : 'Fast Track VIP', price: 55, desc: isEn ? 'VIP buggy, fast pathway and custom lounge access' : 'Xe điện VIP Buggy tại cửa máy bay, thủ tục làn siêu tốc & vào phòng chờ thương gia' }
                ].map((tier) => {
                  const isSelected = fastTrackType === tier.id;
                  return (
                    <div 
                      key={tier.id}
                      onClick={() => setFastTrackType(tier.id as any)}
                      className={`p-3 border rounded-xl cursor-pointer flex flex-col justify-between transition-all ${
                        isSelected 
                          ? 'border-indigo-500 bg-indigo-50/10 ring-1 ring-indigo-500 shadow-sm' 
                          : 'border-slate-150 hover:border-slate-250 bg-slate-50/40'
                      }`}
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between items-center text-slate-800">
                          <span className="font-extrabold text-[10px]">{tier.title}</span>
                          <span className="text-[10px] text-indigo-600 font-bold">+{formatCharge(tier.price)}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-tight">{tier.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </div>

          {/* Pricing Box bottom & checkout action */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5 flex-1 max-w-lg text-xs text-slate-500 leading-relaxed">
              <div className="flex items-center text-slate-900 font-bold mb-1">
                <Fuel className="h-4 w-4 text-indigo-500 mr-2 shrink-0 animate-pulse" />
                <span>{isEn ? 'Zero Flight Delay Risk Policy' : 'Chính Sách Không Lo Trễ Chuyến'}</span>
              </div>
              <p>
                {isEn 
                  ? 'We guarantee 60 minutes of complimentary wait-time counting from the exact minute your flight wheels-down landing registration is stamped at the terminal radar. Driver contact number dispatched 2 hrs before landing.' 
                  : 'Chúng tôi cam kết miễn phí chờ 60 phút tính từ thời điểm chính xác chuyến bay của bạn hạ cánh trên radar sân bay. Số liên hệ của tài xế sẽ được gửi 2 giờ trước khi hạ cánh.'}
              </p>
            </div>

            <div className="bg-[#0B132B] text-white p-5 rounded-xl text-xs space-y-2.5 min-w-[260px] border border-slate-800">
              <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold">
                {isEn ? 'Transfer Invoicing' : 'Chi Tiết Đơn Đặt Xe'}
              </span>
              <div className={`flex justify-between ${!addFastTrack ? 'pb-2 border-b border-slate-800 text-slate-300' : 'text-slate-400'}`}>
                <span>
                  {isEn ? `Chauffeur (${formData.vehicleType})` : `Tài xế riêng (${formData.vehicleType === '4 seats' ? 'Xe 4 chỗ' : formData.vehicleType === '7 seats' ? 'Xe 7 chỗ' : 'Xe 16 chỗ'})`}
                </span>
                <span className="font-semibold text-slate-200">{formatCharge(fees.base, fees.baseVnd)}</span>
              </div>
              {addFastTrack && (
                <>
                  <div className="flex justify-between text-indigo-300 font-medium font-sans">
                    <span>
                      {isEn ? `Fast Track (${fastTrackType})` : `Thủ tục nhanh (${fastTrackType === 'VIP Meet & Assist' ? 'VIP Đón' : fastTrackType === 'Premium Fast Track' ? 'Làn nhanh' : 'Hạng thương gia'})`}
                    </span>
                    <span>{formatCharge(fees.fastTrackCost, fees.fastTrackCostVnd)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-medium font-sans pb-2 border-b border-slate-800">
                    <span>
                      {isEn ? 'Combo Discount' : 'Giảm giá Combo'}
                    </span>
                    <span>-{formatCharge(9, 200000)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center text-sm pt-1">
                <span className="font-bold text-white">{isEn ? 'Consolidated Total' : 'Tổng Chi Phí Trọn Gói'}</span>
                <strong className="text-teal-400 font-display font-black text-lg">
                  {formatCharge(fees.total, fees.totalVnd)}
                </strong>
              </div>
            </div>
          </div>

          {/* VAT invoice option */}
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-900 flex items-center">
                <FileText className="h-4 w-4 text-slate-600 mr-2 shrink-0" />
                {isEn ? '🏢 REQUEST RED VAT INVOICE' : '🏢 YÊU CẦU XUẤT HÓA ĐƠN ĐỎ VAT'}
              </span>
              <input 
                type="checkbox" 
                id="ap-wants-invoice"
                checked={wantsInvoice}
                onChange={() => setWantsInvoice(!wantsInvoice)}
                className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-505 cursor-pointer" 
              />
            </div>
            <p className="text-[11px] text-slate-505 leading-relaxed font-sans">
              {isEn 
                ? 'Need a valid corporate expense log? Toggle on this box to request official RED VAT billing registration sent straight to your finance department.' 
                : 'Cần ghi nhận chi phí hợp lệ cho doanh nghiệp? Đánh dấu vào ô này để yêu cầu xuất hóa đơn đỏ VAT gửi thẳng đến bộ phận kế toán của bạn.'}
            </p>

            {wantsInvoice && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 bg-white border border-slate-200 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {isEn ? 'Company Registered Name' : 'Tên Đăng Ký Công Ty'}
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. DIGIVISA LTD"
                    className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all ${
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
                    className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all ${
                      errors.taxCode ? 'border-red-400 bg-red-50/15' : 'border-slate-200'
                    }`}
                  />
                  {errors.taxCode && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.taxCode}</span>}
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {isEn ? 'Registered Tax Address' : 'Địa Chỉ Đăng Ký Doanh Nghiệp'}
                  </label>
                  <input
                    type="text"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder={isEn ? 'e.g. 15 Le Loi, Ben Nghe, District 1, HCMC' : 'VD: 15 Lê Lợi, Bến Nghé, Quận 1, TP. HCM'}
                    className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all ${
                      errors.companyAddress ? 'border-red-400 bg-red-50/15' : 'border-slate-200'
                    }`}
                  />
                  {errors.companyAddress && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.companyAddress}</span>}
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {isEn ? 'VAT Invoice Recipient Email (Optional)' : 'Email Nhận Hóa Đơn Điện Tử (Không bắt buộc)'}
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
                    className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none ${
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
                      ? '⚠️ Please complete all required form fields above (Flight No, Pickup Date, Time, Address, Name, Email, Phone) before generating the 9Pay QR code!' 
                      : '⚠️ Vui lòng điền đầy đủ các thông tin bắt buộc phía trên (Số hiệu chuyến bay, Ngày/Giờ đón, Địa chỉ, Họ tên, Email, SĐT...) trước khi tạo Mã QR 9Pay!');
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
                    <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100/80 border border-indigo-200 px-2 py-0.5 rounded-md uppercase">
                      {isEn ? 'Default Gateway' : 'Cổng Mặc Định'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {isEn 
                      ? 'After submit you will be redirected to the official 9Pay checkout. Payment is confirmed via signed IPN — not by URL alone.'
                      : 'Sau khi gửi đơn, bạn sẽ được chuyển tới trang thanh toán 9Pay chính thức. Đơn chỉ được xác nhận qua IPN đã ký.'}
                  </p>
                </div>
              </div>
            </div>
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

          {/* Footer cancel/submit control row */}
          <div className="pt-6 border-t border-slate-150 flex items-center justify-between">
            <button
              type="button"
              onClick={onCancel}
              id="pickup-back-btn"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 transition-all cursor-pointer"
            >
              {isEn ? 'Cancel' : 'Hủy bỏ'}
            </button>
            <button
              type="submit"
              id="airport-submit-btn"
              className="flex items-center space-x-2 px-6 py-3.5 bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-teal-500/20 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            >
              <CreditCard className="h-4 w-4" />
              <span>{isEn ? 'Checkout Ground Transfer' : 'Thanh Toán Đặt Xe'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
