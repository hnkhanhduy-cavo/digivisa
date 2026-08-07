import React, { useState, useEffect } from 'react';
import { 
  Globe, FileUser, CreditCard, Upload, Calendar, FileText, Check, ShieldAlert, BadgeCheck, Clock, Sparkles, Zap, AlertTriangle, Timer, Lock,
  Trash2, RefreshCw, Eye, X, CheckCircle
} from 'lucide-react';
import { VisaApplication, Currency, NATIONALITIES } from '../types';
import { Language } from '../utils/translations';
import { getVietnamPricing } from '../utils/pricing';
import { sanitizePassportInput, isValidInternationalPhone, isValidTaxCode, isValidEmail } from '../utils/validation';
import HistoricalAutofill from './HistoricalAutofill';

interface VisaFormV2Props {
  language: Language;
  currency: Currency;
  formData: Omit<VisaApplication, 'totalFee'>;
  setFormData: React.Dispatch<React.SetStateAction<Omit<VisaApplication, 'totalFee'>>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  wantsInvoice: boolean;
  setWantsInvoice: (val: boolean) => void;
  companyName: string;
  setCompanyName: (val: string) => void;
  taxCode: string;
  setTaxCode: (val: string) => void;
  companyAddress: string;
  setCompanyAddress: (val: string) => void;
  companyEmail: string;
  setCompanyEmail: (val: string) => void;
  paymentMethod: '9pay' | 'bank_transfer';
  setPaymentMethod: (method: '9pay' | 'bank_transfer') => void;
  contactPref: 'WhatsApp' | 'Zalo' | 'SMS';
  setContactPref: (val: 'WhatsApp' | 'Zalo' | 'SMS') => void;
  passportDragActive: boolean;
  setPassportDragActive: (val: boolean) => void;
  photoDragActive: boolean;
  setPhotoDragActive: (val: boolean) => void;
  handleDrag: (e: React.DragEvent, type: 'passport' | 'photo') => void;
  handleDrop: (e: React.DragEvent, type: 'passport' | 'photo') => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>, type: 'passport' | 'photo') => void;
  triggerFileInput: (type: 'passport' | 'photo') => void;
  handleRemoveFile: (type: 'passport' | 'photo') => void;
  passportInputRef: React.RefObject<HTMLInputElement | null>;
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  fees: { base: number; speed: number; tax: number; total: number; baseVnd: number; speedVnd: number; taxVnd: number; totalVnd: number };
  formatCharge: (usdAmount: number, type?: 'base' | 'speed' | 'tax' | 'total') => string;
  handleSubmit: (e: React.FormEvent) => void;
  VISA_PRICES: Record<string, number>;
}

export default function VisaFormV2({
  language,
  currency,
  formData,
  setFormData,
  errors,
  setErrors,
  wantsInvoice,
  setWantsInvoice,
  companyName,
  setCompanyName,
  taxCode,
  setTaxCode,
  companyAddress,
  setCompanyAddress,
  companyEmail,
  setCompanyEmail,
  paymentMethod,
  setPaymentMethod,
  contactPref,
  setContactPref,
  passportDragActive,
  photoDragActive,
  handleDrag,
  handleDrop,
  handleFileChange,
  triggerFileInput,
  handleRemoveFile,
  passportInputRef,
  photoInputRef,
  fees,
  formatCharge,
  handleSubmit,
  VISA_PRICES,
}: VisaFormV2Props) {

  const isEn = language === 'EN';
  const [previewModalUrl, setPreviewModalUrl] = React.useState<string | null>(null);
  const [isSameDayCutoffModalOpen, setIsSameDayCutoffModalOpen] = React.useState(false);

  // Realtime clock ticker for dynamic form filling time tracking
  const [liveNow, setLiveNow] = React.useState<Date>(() => new Date());
  const [simulatedTimeMode, setSimulatedTimeMode] = React.useState<'live' | '09:30' | '14:15' | '17:30' | '21:30' | '22:00'>('live');

  React.useEffect(() => {
    const timer = setInterval(() => {
      setLiveNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute effective Date object based on live or simulated time
  const effectiveDate = React.useMemo(() => {
    if (simulatedTimeMode === 'live') return liveNow;
    const d = new Date(liveNow);
    if (simulatedTimeMode === '09:30') {
      d.setHours(9, 30, 0, 0);
    } else if (simulatedTimeMode === '14:15') {
      d.setHours(14, 15, 0, 0);
    } else if (simulatedTimeMode === '17:30') {
      d.setHours(17, 30, 0, 0);
    } else if (simulatedTimeMode === '21:30') {
      d.setHours(21, 30, 0, 0);
    } else if (simulatedTimeMode === '22:00') {
      d.setHours(22, 0, 0, 0);
    }
    return d;
  }, [liveNow, simulatedTimeMode]);

  // Compute Vietnam Time details (UTC+7)
  const vnTimeDetails = React.useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const dateParts = formatter.formatToParts(effectiveDate);
    let vnHour = 0;
    let vnMin = 0;
    for (const p of dateParts) {
      if (p.type === 'hour') {
        vnHour = parseInt(p.value, 10);
        if (vnHour === 24) vnHour = 0;
      }
      if (p.type === 'minute') {
        vnMin = parseInt(p.value, 10);
      }
    }
    const totalMins = vnHour * 60 + vnMin;

    const formatDateStr = (daysOffset: number) => {
      const d = new Date(effectiveDate);
      d.setDate(d.getDate() + daysOffset);
      return d.toLocaleDateString(isEn ? 'en-US' : 'vi-VN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    };

    const formatDuration = (mins: number) => {
      if (mins <= 0) return '0m';
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    };

    // Same-Day Cutoff: Strictly 12:00 PM Noon = 720 minutes
    const isSameDayAvailable = totalMins < 720;
    const minsBeforeSameDayCutoff = 720 - totalMins;

    // Sub-option 1 (Submit before 15:00, receive 17:00 next day):
    // - Before 15:00 (totalMins < 900): Available (Target +1)
    // - Between 15:00 and 21:00 (900 <= totalMins < 1260): LOCKED
    // - After 21:00 (totalMins >= 1260): AVAILABLE AGAIN (Target +2)
    const isSubOpt1Locked = totalMins >= 900 && totalMins < 1260;
    const subOpt1TargetDate = totalMins >= 1260 ? formatDateStr(2) : formatDateStr(1);

    // Sub-option 2 & 3 Target Date:
    // - Before 21:00: Target +1
    // - After 21:00: Target +2
    const subOpt2TargetDate = totalMins >= 1260 ? formatDateStr(2) : formatDateStr(1);
    const subOpt3TargetDate = totalMins >= 1260 ? formatDateStr(2) : formatDateStr(1);

    const minsBefore3pm = 900 - totalMins;
    const minsBefore9pm = 1260 - totalMins;

    return {
      vnHour,
      vnMin,
      totalMins,
      isSameDayAvailable,
      minsBeforeSameDayCutoff,
      isSubOpt1Locked,
      subOpt1TargetDate,
      subOpt2TargetDate,
      subOpt3TargetDate,
      isAfter9pm: totalMins >= 1260,
      formattedTime: effectiveDate.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      minsBefore3pm,
      minsBefore9pm,
      formatDuration,
      formatDateStr
    };
  }, [effectiveDate, isEn]);

  const isKoreaOrJapan = formData.nationality === 'Korea' || formData.nationality === 'Japan' || formData.nationality === 'South Korea';

  const formatVietnamPrice = (vType: string, rOpt: string, sTiming: string) => {
    const pricing = getVietnamPricing(vType, rOpt, sTiming);
    if (currency === 'VND') {
      return `${pricing.totalVnd.toLocaleString('vi-VN')} ₫`;
    }
    return `$${pricing.total}`;
  };
  const allowedVisaTypes = isKoreaOrJapan 
    ? ['Tourist (30 Days)', 'Tourist (90 Days)'] 
    : ['Tourist (30 Days)'];

  React.useEffect(() => {
    if (formData.destinationCountry === 'Vietnam') {
      const allowed = ['Single eVisa', 'Multiple eVisa'];
      if (!allowed.includes(formData.visaType)) {
        setFormData((prev) => ({ ...prev, visaType: 'Single eVisa' }));
      }
    } else {
      const isKoreaOrJapanLocal = formData.nationality === 'Korea' || formData.nationality === 'Japan' || formData.nationality === 'South Korea';
      const allowed = isKoreaOrJapanLocal ? ['Tourist (30 Days)', 'Tourist (90 Days)'] : ['Tourist (30 Days)'];
      if (!allowed.includes(formData.visaType)) {
        setFormData((prev) => ({ ...prev, visaType: 'Tourist (30 Days)' }));
      }
    }
  }, [formData.nationality, formData.visaType, formData.destinationCountry, setFormData]);

  // Auto-switch submission timing if current timing is locked due to passed cutoff time
  React.useEffect(() => {
    if (formData.destinationCountry === 'Vietnam' && formData.resultsOption === 'within_2_days') {
      if (!formData.submissionTiming) {
        setFormData(prev => ({ 
          ...prev, 
          submissionTiming: vnTimeDetails.isBefore3pmActive ? 'before_3pm' : (vnTimeDetails.isBefore9pmActive ? 'before_9pm_next_day_5pm' : 'before_3pm') 
        }));
        return;
      }

      if (formData.submissionTiming === 'before_3pm' && !vnTimeDetails.isBefore3pmActive && !vnTimeDetails.isAfter9pm) {
        if (vnTimeDetails.isBefore9pmActive) {
          setFormData(prev => ({ ...prev, submissionTiming: 'before_9pm_next_day_5pm' }));
        }
      }
    }
  }, [vnTimeDetails.isBefore3pmActive, vnTimeDetails.isBefore9pmActive, vnTimeDetails.isAfter9pm, formData.destinationCountry, formData.resultsOption, formData.submissionTiming, setFormData]);

  const translateVisaType = (type: string) => {
    if (type === 'Single eVisa') return isEn ? 'Single' : '1 Lần';
    if (type === 'Multiple eVisa') return isEn ? 'Multiple' : 'Nhiều Lần';
    if (isKoreaOrJapan) {
      if (type === 'Tourist (30 Days)') {
        return isEn ? 'Single' : 'Thị thực 1 lần';
      }
      if (type === 'Tourist (90 Days)') {
        return isEn ? 'Multiple' : 'Thị thực nhiều lần';
      }
    }
    if (isEn) return type;
    switch (type) {
      case 'Free Tourist Visa (15 Days, Exempt)':
        return 'Miễn Thị Thực (15 Ngày, Miễn Phí)';
      case 'Tourist (30 Days)':
        return 'Thị Thực Du Lịch (30 Ngày, 1 Lần)';
      case 'Tourist (90 Days)':
        return 'Thị Thực Du Lịch (90 Ngày, Nhiều Lần)';
      case 'Business (30 Days)':
        return 'Thị Thực Thương Mại (30 Ngày, 2 Lần)';
      case 'Business (90 Days)':
        return 'Thị Thực Thương Mại (90 Ngày, Nhiều Lần)';
      case 'Visa / TRC (Temporary Residence Card)':
        return 'Thẻ Tạm Trú TRC (2 Năm)';
      default:
        return type;
    }
  };

  const isVisaFormValid = () => {
    if (formData.destinationCountry === 'Vietnam') {
      return !!(
        formData.firstName?.trim() &&
        formData.lastName?.trim() &&
        formData.passportNumber?.trim() &&
        formData.dateOfBirth &&
        formData.email?.trim() &&
        isValidEmail(formData.email) &&
        formData.phone?.trim() &&
        formData.arrivalDate &&
        formData.passportScan &&
        formData.photoScan
      );
    }
    return !!(
      formData.firstName?.trim() &&
      formData.lastName?.trim() &&
      formData.passportNumber?.trim() &&
      formData.email?.trim() &&
      isValidEmail(formData.email) &&
      formData.phone?.trim()
    );
  };

  return (
    <div className="space-y-6" id="visa-form-v2">
      {/* 1. Country & Visa Tier Selection */}
      <div className="p-5 sm:p-6 bg-slate-50/50 rounded-2xl border border-slate-205 space-y-4 shadow-sm" id="v2-card-tier">
        <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-150">
          <div className="h-6 w-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-650">
            <Globe className="h-4 w-4" />
          </div>
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-slate-800">
            {isEn ? '1. Select Destination Class & Nationality' : '1. Chọn Quốc Tịch & Loại Thị Thực'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Destination Country */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              {isEn ? 'Destination Country' : 'Quốc gia điểm đến'}
            </label>
            <select
              value={formData.destinationCountry || 'Vietnam'}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  destinationCountry: val,
                  nationality: val === 'Vietnam' ? 'Korea' : val,
                  visaType: val === 'Vietnam' ? 'Single eVisa' : 'Tourist (30 Days)',
                  resultsOption: val === 'Vietnam' ? 'within_2_days' : '',
                  submissionTiming: val === 'Vietnam' ? 'before_3pm' : '',
                }));
              }}
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
            >
              <option value="Vietnam">{isEn ? 'Vietnam (eVisa)' : 'Việt Nam (eVisa)'}</option>
              <option value="Korea">{isEn ? 'Korea' : 'Hàn Quốc'}</option>
              <option value="Japan">{isEn ? 'Japan' : 'Nhật Bản'}</option>
              <option value="Taiwan">{isEn ? 'Taiwan' : 'Đài Loan'}</option>
              <option value="China">{isEn ? 'China' : 'Trung Quốc'}</option>
            </select>
          </div>

          {/* Visa Type dropdown selection */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              {isEn ? 'Entry Visa' : 'Thị thực nhập cảnh'}
            </label>
            <select
              value={
                formData.visaType === 'Multiple eVisa' || formData.visaType === 'Tourist (90 Days)' || formData.visaType === 'Multiple' 
                  ? 'Multiple' 
                  : 'Single'
              }
              onChange={(e) => {
                const val = e.target.value;
                const mappedType = formData.destinationCountry === 'Vietnam'
                  ? (val === 'Multiple' ? 'Multiple eVisa' : 'Single eVisa')
                  : (val === 'Multiple' ? 'Tourist (90 Days)' : 'Tourist (30 Days)');
                setFormData((prev) => ({ ...prev, visaType: mappedType as any }));
              }}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
            >
              <option value="Single">
                {isEn ? 'Single' : '1 Lần'}
              </option>
              <option value="Multiple">
                {isEn ? 'Multiple' : 'Nhiều Lần'}
              </option>
            </select>
          </div>
        </div>

        {/* Live Prices Grid or Vietnam sub-options */}
        {formData.destinationCountry === 'Vietnam' ? (
          <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3.5 shadow-xs animate-fade-in mt-2">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <h4 className="font-display font-bold text-xs text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                <span>⚡</span>{' '}
                {formData.visaType === 'Vietnam approval letter on arrival'
                  ? (isEn ? 'Vietnam Approval Letter Processing Schedule' : 'Lịch trình xử lý Thư chấp thuận Việt Nam')
                  : (isEn ? 'Vietnam eVisa Processing Schedule' : 'Lịch trình xử lý e-Thị thực Việt Nam')}
              </h4>

              {/* Clean compact time badge */}
              <div className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap shadow-2xs">
                <Clock className="h-3 w-3 text-indigo-600 animate-pulse" />
                <span>{vnTimeDetails.formattedTime} {isEn ? 'Vietnam Time (GMT +7)' : 'Giờ Việt Nam (GMT +7)'}</span>
              </div>
            </div>

            {/* Subtle Interactive Form Fill Time Simulator for testing */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] bg-slate-50 p-2 rounded-xl border border-slate-150">
              <span className="text-slate-600 font-semibold flex items-center gap-1">
                <Timer className="h-3.5 w-3.5 text-indigo-600" />
                {isEn ? 'Form Fill Time Tracker:' : 'Thời gian điền đơn (Realtime):'}
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-slate-400 font-medium mr-1 text-[9.5px] hidden sm:inline">{isEn ? 'Simulate time:' : 'Thử giờ:'}</span>
                {[
                  { id: 'live', label: '⚡ Live' },
                  { id: '09:30', label: '09:30 AM' },
                  { id: '14:15', label: '14:15 PM' },
                  { id: '17:30', label: '17:30 PM' },
                  { id: '21:30', label: '21:30 PM' },
                  { id: '22:00', label: '22:00 PM' },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setSimulatedTimeMode(btn.id as any)}
                    className={`px-2 py-0.5 rounded font-bold text-[9.5px] transition-all cursor-pointer ${
                      simulatedTimeMode === btn.id
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
            
            {formData.visaType === 'Vietnam approval letter on arrival' ? (
              <div className="p-3 bg-indigo-50/10 border border-indigo-200 rounded-xl space-y-2 animate-fade-in">
                <span className="block text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                  {isEn ? 'Processing Option:' : 'Phương thức xử lý:'}
                </span>
                <div className="p-3 bg-white border border-indigo-500 rounded-xl flex justify-between items-center shadow-2xs">
                  <div className="flex items-center space-x-2.5">
                    <div className="h-4 w-4 rounded-full border border-indigo-650 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {isEn ? 'Applicable on Saturdays, Sundays, and public holidays' : 'Áp dụng vào Thứ Bảy, Chủ Nhật và các ngày nghỉ lễ'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {isEn ? 'Emergency weekend & holiday airport approval letter processing' : 'Xử lý công văn chấp thuận khẩn cấp vào cuối tuần & ngày lễ'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-xs font-extrabold text-indigo-650 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-mono">
                      {formatVietnamPrice(formData.visaType, '', '')}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-650 font-sans">
                      {isEn ? 'Holiday Urgent' : 'Khẩn lễ tết'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* 2 Main Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Results available within 2 days */}
                  <div 
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      resultsOption: 'within_2_days',
                      submissionTiming: prev.submissionTiming || (vnTimeDetails.isBefore3pmActive ? 'before_3pm' : 'before_9pm_next_day_5pm')
                    }))}
                    className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                      formData.resultsOption === 'within_2_days'
                        ? 'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-500 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          {isEn ? 'Results within 2 days' : 'Có kết quả trong vòng 2 ngày'}
                        </span>
                        <input 
                          type="radio" 
                          checked={formData.resultsOption === 'within_2_days'} 
                          onChange={() => {}}
                          className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        {isEn ? 'Expedited processing with flexible submission windows' : 'Xử lý nhanh theo các khung giờ nộp nhận'}
                      </p>

                      {/* Best Recommended badge for Option 1 */}
                      <div className="pt-1">
                        {vnTimeDetails.isAfter9pm ? (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Clock className="h-3 w-3 text-amber-600 animate-pulse" />
                            {isEn ? '⏱️ Tomorrow Queue: Choose Any Option' : '⏱️ Hàng đợi ngày mai: Chọn tùy ý'}
                          </span>
                        ) : vnTimeDetails.isBefore3pmActive ? (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Sparkles className="h-3 w-3 text-emerald-600" />
                            {isEn ? '⭐ Best Option: Submit before 15:00' : '⭐ Tối ưu nhất: Nộp trước 15:00'}
                          </span>
                        ) : vnTimeDetails.isBefore9pmActive ? (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            <Sparkles className="h-3 w-3 text-indigo-600" />
                            {isEn ? '⭐ Best Option: Submit before 21:00' : '⭐ Tối ưu nhất: Nộp trước 21:00'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <Lock className="h-3 w-3 text-slate-500" />
                            {isEn ? 'Cutoffs Passed Today' : 'Đã qua các ca nộp hôm nay'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Results available the same day (Cutoff at 12:00 PM Noon) */}
                  <div 
                    onClick={() => {
                      if (vnTimeDetails.isSameDayAvailable) {
                        setFormData(prev => ({ 
                          ...prev, 
                          resultsOption: 'same_day',
                          submissionTiming: ''
                        }));
                      } else {
                        // After 12:00 PM Noon: Disallow selection & trigger Same-Day Cutoff Modal
                        setIsSameDayCutoffModalOpen(true);
                      }
                    }}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                      !vnTimeDetails.isSameDayAvailable
                        ? 'border-slate-200 bg-slate-100/70 text-slate-400 opacity-70 cursor-pointer select-none'
                        : formData.resultsOption === 'same_day'
                          ? 'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-500 shadow-2xs cursor-pointer'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/30 cursor-pointer'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${!vnTimeDetails.isSameDayAvailable ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {isEn ? 'Results available the same day' : 'Có kết quả ngay trong ngày'}
                        </span>
                        <input 
                          type="radio" 
                          disabled={!vnTimeDetails.isSameDayAvailable}
                          checked={formData.resultsOption === 'same_day'} 
                          onChange={() => {}}
                          className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        {isEn ? 'Same-day urgent clearance (Requires submission before 12:00 PM Noon)' : 'Hồ sơ khẩn nộp nhận trong ngày (Yêu cầu nộp trước 12:00 Trưa)'}
                      </p>

                      {/* Best Recommended / Cutoff Passed Tag for Option 2 */}
                      <div className="pt-1">
                        {vnTimeDetails.isSameDayAvailable ? (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Zap className="h-3 w-3 text-emerald-600" />
                            {isEn 
                              ? `⭐ Best Option: Receive Today 18:00 (${vnTimeDetails.formatDuration(vnTimeDetails.minsBeforeSameDayCutoff)} left)` 
                              : `⭐ Nhận 18:00 HÔM NAY (Còn ${vnTimeDetails.formatDuration(vnTimeDetails.minsBeforeSameDayCutoff)})`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <Lock className="h-3 w-3 text-rose-500" />
                            {isEn ? '🔒 Cutoff Passed (Bấm để xem lý do)' : '🔒 Đã quá 12:00 Trưa (Bấm để xem)'}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-medium">
                          {isEn ? 'Total price:' : 'Trọn gói:'}
                        </span>
                        <span className="text-xs font-extrabold text-indigo-600 font-mono">
                          {formatVietnamPrice(formData.visaType, 'same_day', '')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-options for Option 1 and Test Sandbox with Locked and Recommended states */}
                {(formData.resultsOption === 'within_2_days' || formData.resultsOption === 'test_sandbox') && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        {isEn ? 'Select Submission & Delivery Schedule:' : 'Chọn Khung Giờ Nộp & Trả Kết Quả:'}
                      </span>
                      <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1">
                        <Clock className="h-3 w-3 text-indigo-500" />
                        {isEn ? 'Realtime Availability' : 'Tính theo giờ thực'}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      {[
                        {
                          id: 'before_3pm',
                          label: isEn ? 'Submit before 3:00 PM, receive by 5:00 PM next day' : 'Nộp trước 15:00, nhận trước 17:00 ngày hôm sau',
                          targetDate: vnTimeDetails.subOpt1TargetDate,
                          targetTime: '17:00',
                          isLocked: vnTimeDetails.isSubOpt1Locked,
                          isBest: !vnTimeDetails.isSubOpt1Locked && !vnTimeDetails.isAfter9pm,
                          remainingText: vnTimeDetails.isAfter9pm 
                            ? (isEn ? '⏱️ Queued for tomorrow 15:00 batch' : '⏱️ Xếp lịch nộp mốc 15:00 ngày mai (+2 ngày)')
                            : (!vnTimeDetails.isSubOpt1Locked 
                              ? (isEn ? `⏱️ ${vnTimeDetails.formatDuration(vnTimeDetails.minsBefore3pm)} left today` : `⏱️ Còn ${vnTimeDetails.formatDuration(vnTimeDetails.minsBefore3pm)} nộp hôm nay`)
                              : (isEn ? '🔒 Passed 15:00 cutoff today' : '🔒 Đã qua mốc 15:00 hôm nay'))
                        },
                        {
                          id: 'before_9pm_next_day_5pm',
                          label: isEn ? 'Submit before 9:00 PM, receive by 5:00 PM next day' : 'Nộp trước 21:00, nhận trước 17:00 ngày hôm sau',
                          targetDate: vnTimeDetails.subOpt2TargetDate,
                          targetTime: '17:00',
                          isLocked: false,
                          isBest: vnTimeDetails.isSubOpt1Locked && !vnTimeDetails.isAfter9pm,
                          remainingText: vnTimeDetails.isAfter9pm
                            ? (isEn ? '⏱️ Queued for tomorrow 21:00 batch' : '⏱️ Xếp lịch nộp mốc 21:00 ngày mai (+2 ngày)')
                            : (isEn ? `⏱️ ${vnTimeDetails.formatDuration(vnTimeDetails.minsBefore9pm)} left today` : `⏱️ Còn ${vnTimeDetails.formatDuration(vnTimeDetails.minsBefore9pm)} nộp hôm nay`)
                        },
                        {
                          id: 'before_9pm_next_day_noon',
                          label: isEn ? 'Submit before 9:00 PM, receive by 12:00 PM Noon next day' : 'Nộp trước 21:00, nhận trước 12:00 trưa hôm sau',
                          targetDate: vnTimeDetails.subOpt3TargetDate,
                          targetTime: '12:00 PM NOON',
                          isLocked: false,
                          isBest: false,
                          remainingText: vnTimeDetails.isAfter9pm
                            ? (isEn ? '⚡ Queued for tomorrow 21:00 batch' : '⚡ Xếp lịch nộp mốc 21:00 ngày mai (+2 ngày)')
                            : (isEn ? `⚡ Morning Express (${vnTimeDetails.formatDuration(vnTimeDetails.minsBefore9pm)} left)` : `⚡ Trả Trưa Khẩn (Còn ${vnTimeDetails.formatDuration(vnTimeDetails.minsBefore9pm)})`)
                        }
                      ].map((subOpt) => {
                        const active = formData.submissionTiming === subOpt.id && !subOpt.isLocked;

                        return (
                          <div
                            key={subOpt.id}
                            onClick={() => {
                              if (!subOpt.isLocked) {
                                setFormData(prev => ({ ...prev, submissionTiming: subOpt.id }));
                              }
                            }}
                            className={`p-3 rounded-xl border text-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                              subOpt.isLocked
                                ? 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-65 cursor-not-allowed select-none'
                                : active
                                  ? 'border-indigo-600 bg-white shadow-2xs ring-1 ring-indigo-500 font-semibold text-slate-900 cursor-pointer'
                                  : 'border-slate-200 bg-white hover:bg-slate-50/80 text-slate-700 cursor-pointer'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <div className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                  subOpt.isLocked
                                    ? 'border-slate-300 bg-slate-200'
                                    : active ? 'border-indigo-650 bg-indigo-50' : 'border-slate-300'
                                }`}>
                                  {subOpt.isLocked ? (
                                    <Lock className="h-2.5 w-2.5 text-slate-500" />
                                  ) : active ? (
                                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                                  ) : null}
                                </div>
                                <span className={`font-bold ${subOpt.isLocked ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                  {subOpt.label}
                                </span>
                              </div>

                              <div className="pl-5 flex items-center space-x-2 text-[10px]">
                                {subOpt.isLocked ? (
                                  <span className="font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded border border-slate-300 flex items-center gap-1">
                                    <Lock className="h-3 w-3 text-slate-500" />
                                    {isEn ? 'Cutoff time passed - Option locked' : 'Khung giờ nộp đã qua - Lựa chọn đã bị khóa'}
                                  </span>
                                ) : (
                                  <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                    📅 {isEn ? 'Est. Result:' : 'Trả kết quả:'} {subOpt.targetDate} @ {subOpt.targetTime}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end space-x-2 shrink-0 pl-5 sm:pl-0">
                              {subOpt.isLocked ? (
                                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-500 border border-slate-300 flex items-center gap-1">
                                  <Lock className="h-3 w-3 text-slate-500" />
                                  {isEn ? 'LOCKED' : 'ĐÃ KHÓA'}
                                </span>
                              ) : subOpt.isBest ? (
                                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                  <Sparkles className="h-3 w-3 text-emerald-600" />
                                  {isEn ? '⭐ BEST RECOMMENDED' : '⭐ KHUYÊN DÙNG'}
                                </span>
                              ) : (
                                <span className="text-[9.5px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {subOpt.remainingText}
                                </span>
                              )}

                              <span className={`text-xs font-extrabold px-2 py-0.5 rounded font-mono border ${
                                subOpt.isLocked 
                                  ? 'text-slate-400 bg-slate-200/50 border-slate-300' 
                                  : 'text-indigo-700 bg-indigo-50 border-indigo-100'
                              }`}>
                                {formatVietnamPrice(formData.visaType, 'within_2_days', subOpt.id)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {vnTimeDetails.isAfter9pm && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 animate-fade-in text-xs text-amber-800">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold">
                            {isEn ? 'Next-Day Submission Queue Active' : 'Hàng Đợi Hồ Sơ Ngày Mai Đã Kích Hoạt'}
                          </p>
                          <p className="text-[10.5px] leading-relaxed text-amber-700">
                            {isEn 
                              ? 'The current time is past the 9:00 PM cutoff. All submissions are queued and will be dispatched to the Immigration Department first thing tomorrow morning. You can freely choose any option above and complete your order now.' 
                              : 'Giờ hiện tại đã qua khung giờ 21:00. Toàn bộ hồ sơ tạo mới sẽ được xếp vào hàng đợi và nộp lên Cục Xuất Nhập Cảnh vào đầu sáng ngày mai. Quý khách có thể tự do lựa chọn bất kỳ khung giờ xử lý nào phía trên và hoàn thành thanh toán.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Same Day Information Message */}
                {formData.resultsOption === 'same_day' && (
                  <div className="p-3 bg-indigo-50/40 border border-indigo-200 rounded-xl space-y-1 animate-fade-in text-xs">
                    <div className="flex items-center space-x-2 font-bold text-indigo-900">
                      <Zap className="h-3.5 w-3.5 text-indigo-600" />
                      <span>{isEn ? 'Same-Day Expedited Delivery Schedule:' : 'Lịch trình Trả Kết Quả Khẩn Trong Ngày:'}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {vnTimeDetails.sameDayStatus === 'morning' ? (
                        isEn 
                          ? `Application submitted now (${vnTimeDetails.formattedTime}) will be delivered by 18:00 PM TODAY! (${vnTimeDetails.formatDuration(vnTimeDetails.minsSameDayRemaining)} remaining in morning cutoff).`
                          : `Nộp đơn lúc này (${vnTimeDetails.formattedTime}) sẽ nhận kết quả vào 18:00 PM HÔM NAY! (Còn ${vnTimeDetails.formatDuration(vnTimeDetails.minsSameDayRemaining)} trong ca sáng).`
                      ) : vnTimeDetails.sameDayStatus === 'afternoon' ? (
                        isEn
                          ? `Application submitted now (${vnTimeDetails.formattedTime}) will be delivered by 20:30 PM EVENING TODAY! (${vnTimeDetails.formatDuration(vnTimeDetails.minsSameDayRemaining)} remaining in afternoon cutoff).`
                          : `Nộp đơn lúc này (${vnTimeDetails.formattedTime}) sẽ nhận kết quả ca tối 20:30 PM HÔM NAY! (Còn ${vnTimeDetails.formatDuration(vnTimeDetails.minsSameDayRemaining)} trong ca chiều).`
                      ) : (
                        isEn
                          ? `Today's same-day processing cutoff has passed (${vnTimeDetails.formattedTime}). Your application will be priority-dispatched at 08:00 AM tomorrow and delivered by 12:00 PM NOON tomorrow.`
                          : `Đã qua giờ nhận hồ sơ khẩn trong ngày (${vnTimeDetails.formattedTime}). Đơn sẽ được ưu tiên xử lý lúc 08:00 AM sáng mai và nhận kết quả trước 12:00 TRƯA HÔM SAU.`
                      )}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {isKoreaOrJapan ? (
                allowedVisaTypes.map((type) => {
                  const isSelected = formData.visaType === type;
                  return (
                    <div
                      key={type}
                      onClick={() => setFormData((prev) => ({ ...prev, visaType: type as any }))}
                      className={`flex flex-col justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-indigo-600 bg-indigo-50/10 ring-1 ring-indigo-500 shadow-sm' 
                          : 'border-slate-150 hover:border-slate-305 bg-white'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-slate-800 line-clamp-1">
                        {translateVisaType(type)}
                      </span>
                      <strong className="text-[11px] font-bold text-indigo-700 font-mono mt-1">
                        {formatCharge(VISA_PRICES[type])}
                      </strong>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col justify-between p-3 rounded-xl border border-indigo-650 bg-indigo-50/10 ring-1 ring-indigo-500 shadow-sm col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-800 line-clamp-1">
                    {isEn ? 'Single (Tourist)' : 'Một lần (Du lịch)'}
                  </span>
                  <strong className="text-[11px] font-bold text-indigo-750 font-mono mt-1">
                    {formData.nationality === 'Taiwan' 
                      ? (currency === 'VND' ? '3.450.000 ₫' : '$130') 
                      : (currency === 'VND' ? '3.445.000 ₫' : '$130')}
                  </strong>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Applicant Identity & Passport Logs */}
      <div className="p-5 sm:p-6 bg-slate-50/50 rounded-2xl border border-slate-205 space-y-4 shadow-sm" id="v2-card-bio">
        <HistoricalAutofill
          serviceType="Visa"
          language={language}
          onSelect={(profile: any) => {
            setFormData((prev) => ({
              ...prev,
              firstName: profile.firstName || (profile.contactName ? profile.contactName.split(' ')[0] : prev.firstName),
              lastName: profile.lastName || (profile.contactName ? profile.contactName.split(' ').slice(1).join(' ') : prev.lastName),
              passportNumber: profile.passportNumber || prev.passportNumber,
              passportExpiry: profile.passportExpiry || prev.passportExpiry,
              nationality: profile.nationality || prev.nationality,
              dateOfBirth: profile.dateOfBirth || prev.dateOfBirth,
              email: profile.email || prev.email,
              phone: profile.phone || prev.phone,
            }));
          }}
        />

        <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-150">
          <div className="h-6 w-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-650">
            <FileUser className="h-4 w-4" />
          </div>
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-slate-800">
            {isEn ? '2. Applicant Biographical Profiles' : '2. Thông Tin Nhân Thân Người Đăng Ký'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {isEn ? 'Given Names (First Name) *' : 'Tên & Tên Đệm (như trong Hộ chiếu) *'}
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
              placeholder={isEn ? 'e.g. ALEXANDRA' : 'Ví dụ: ALEXANDRA'}
              className={`w-full bg-white border rounded-xl px-3 outline-none py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                errors.firstName ? 'border-red-400 bg-red-50/5' : 'border-slate-200'
              }`}
            />
            {errors.firstName && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.firstName}</span>}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {isEn ? 'Surname (Last Name) *' : 'Họ (như trong Hộ chiếu) *'}
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
              placeholder={isEn ? 'e.g. SMITH' : 'Ví dụ: SMITH'}
              className={`w-full bg-white border rounded-xl px-3 outline-none py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                errors.lastName ? 'border-red-400 bg-red-50/5' : 'border-slate-200'
              }`}
            />
            {errors.lastName && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.lastName}</span>}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {isEn ? 'Passport Book Code *' : 'Số Hộ Chiếu *'}
            </label>
            <input
              type="text"
              value={formData.passportNumber}
              onChange={(e) => {
                const val = sanitizePassportInput(e.target.value);
                setFormData((prev) => ({ ...prev, passportNumber: val }));
                if (errors.passportNumber) {
                  setErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.passportNumber;
                    return copy;
                  });
                }
              }}
              placeholder={isEn ? 'e.g. A12345678' : 'Ví dụ: A12345678'}
              className={`w-full bg-white border rounded-xl px-3 outline-none py-2 text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                errors.passportNumber ? 'border-red-400 bg-red-50/5' : 'border-slate-200'
              }`}
            />
            {errors.passportNumber && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.passportNumber}</span>}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {isEn ? 'Passport Expiry Date *' : 'Ngày Hết Hạn Hộ Chiếu *'}
            </label>
            <div className="relative">
              <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={formData.passportExpiry}
                onChange={(e) => setFormData((prev) => ({ ...prev, passportExpiry: e.target.value }))}
                className={`w-full bg-white border rounded-xl px-3 outline-none py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                  errors.passportExpiry ? 'border-red-400 bg-red-50/5' : 'border-slate-200'
                }`}
              />
            </div>
            {errors.passportExpiry && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.passportExpiry}</span>}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {isEn ? 'Date of Birth *' : 'Ngày Sinh *'}
            </label>
            <div className="relative">
              <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={formData.dateOfBirth}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  const val = e.target.value;
                  const todayStr = new Date().toISOString().split('T')[0];
                  setFormData((prev) => ({ ...prev, dateOfBirth: val }));
                  if (val && val > todayStr) {
                    setErrors((prev) => ({
                      ...prev,
                      dateOfBirth: isEn ? 'Date of birth cannot be in the future' : 'Ngày sinh không thể ở tương lai'
                    }));
                  } else if (errors.dateOfBirth) {
                    setErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.dateOfBirth;
                      return copy;
                    });
                  }
                }}
                className={`w-full bg-white border rounded-xl px-3 outline-none py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                  errors.dateOfBirth ? 'border-red-400 bg-red-50/5' : 'border-slate-200'
                }`}
              />
            </div>
            {errors.dateOfBirth && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.dateOfBirth}</span>}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {isEn ? 'Planned Date of Arrival *' : 'Ngày Nhập Cảnh Dự Kiến *'}
            </label>
            <div className="relative">
              <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={formData.arrivalDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  const val = e.target.value;
                  const todayStr = new Date().toISOString().split('T')[0];
                  setFormData((prev) => ({ ...prev, arrivalDate: val }));
                  if (val && val < todayStr) {
                    setErrors((prev) => ({
                      ...prev,
                      arrivalDate: isEn ? 'Planned arrival date cannot be in the past' : 'Ngày nhập cảnh không thể ở quá khứ'
                    }));
                  } else if (errors.arrivalDate) {
                    setErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.arrivalDate;
                      return copy;
                    });
                  }
                }}
                className={`w-full bg-white border rounded-xl px-3 outline-none py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                  errors.arrivalDate ? 'border-red-400 bg-red-50/5' : 'border-slate-200'
                }`}
              />
            </div>
            {errors.arrivalDate && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.arrivalDate}</span>}
          </div>
        </div>
      </div>

      {/* 3. Document Drag Zone */}
      <div className="p-5 sm:p-6 bg-slate-50/50 rounded-2xl border border-slate-205 space-y-4 shadow-sm" id="v2-card-docs">
        <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-150">
          <div className="h-6 w-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-650">
            <Upload className="h-4 w-4" />
          </div>
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-slate-800">
            {isEn ? '3. Identity Visual Credentials' : '3. Hồ Sơ Hình Ảnh Nhân Thân'}
          </h3>
        </div>

        <div className="space-y-4">
          {/* Single Dropzone: Passport Information Page */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              {isEn ? 'Passport Photo Information Page *' : 'Ảnh chụp trang thông tin Hộ chiếu *'}
            </label>
            
            <div
              onDragEnter={(e) => handleDrag(e, 'passport')}
              onDragOver={(e) => handleDrag(e, 'passport')}
              onDragLeave={(e) => handleDrag(e, 'passport')}
              onDrop={(e) => handleDrop(e, 'passport')}
              className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all flex flex-col items-center justify-center min-h-[160px] bg-white ${
                passportDragActive 
                  ? 'border-indigo-500 bg-indigo-50/20 shadow-md' 
                  : formData.passportScan 
                    ? 'border-emerald-400 bg-emerald-50/10' 
                    : errors.passportScan
                      ? 'border-red-400 bg-red-50/15'
                      : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="file"
                ref={passportInputRef}
                onChange={(e) => handleFileChange(e, 'passport')}
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                className="hidden"
              />

              {formData.passportScan ? (
                <div className="space-y-2 flex flex-col items-center w-full">
                  {formData.passportScanDataUrl ? (
                    <div 
                      onClick={() => setPreviewModalUrl(formData.passportScanDataUrl || null)}
                      className="relative group cursor-pointer overflow-hidden rounded-xl border border-emerald-300 shadow-xs max-h-32 bg-slate-900 flex items-center justify-center"
                      title={isEn ? "Click to view full preview" : "Bấm để xem ảnh phóng to"}
                    >
                      <img 
                        src={formData.passportScanDataUrl} 
                        alt="Passport Scan Preview" 
                        className="max-h-28 w-auto object-contain transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white bg-black/60 px-2.5 py-1 rounded-full border border-white/30 flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {isEn ? 'Phóng to' : 'Xem ảnh'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <CheckCircle className="h-8 w-8 text-emerald-550 mx-auto" />
                  )}

                  <div className="text-center">
                    <p className="text-[11px] font-bold text-emerald-800 flex items-center justify-center gap-1">
                      <Check className="h-3.5 w-3.5" />
                      {isEn ? 'Passport Image Ready' : 'Đã tải ảnh Hộ chiếu thành công'}
                    </p>
                    <p className="text-[9.5px] text-slate-400 truncate max-w-[200px] mx-auto font-mono mt-0.5">{formData.passportScan}</p>
                  </div>

                  {/* Cancel / Delete Image Button */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleRemoveFile('passport')}
                      className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>{isEn ? 'Cancel / Remove' : 'Hủy & Xóa ảnh'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerFileInput('passport')}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3 text-slate-500" />
                      <span>{isEn ? 'Replace' : 'Đổi ảnh'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => triggerFileInput('passport')}
                  className="space-y-1.5 py-3 cursor-pointer w-full flex flex-col items-center"
                >
                  <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    {isEn ? 'Drop Passport Info Page' : 'Kéo thả ảnh Hộ chiếu vào đây'}
                  </p>
                  <p className="text-[9.5px] text-slate-400 font-medium">
                    {isEn ? 'Supports JPG, JPEG, PNG (Max 2MB)' : 'Chỉ nhận định dạng JPG, JPEG, PNG (Dung lượng < 2MB)'}
                  </p>
                </div>
              )}
            </div>
            {errors.passportScan && <p className="text-[10px] text-red-500 font-medium block mt-1">{errors.passportScan}</p>}
          </div>
        </div>
      </div>

      {/* 4. Communication channels & RED Corporate Invoice details */}
      <div className="p-5 sm:p-6 bg-slate-50/50 rounded-2xl border border-slate-205 space-y-4 shadow-sm" id="v2-card-comm">
        <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-150">
          <div className="h-6 w-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-650">
            <FileText className="h-4 w-4" />
          </div>
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-slate-800">
            {isEn ? '4. Contact & Invoicing details' : '4. Thông Tin Liên Hệ & Xuất Hóa Đơn'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {isEn ? 'Receipt Liaison Email *' : 'Email Nhận Kết Quả *'}
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((prev) => ({ ...prev, email: val }));
                if (errors.email) {
                  if (!val.trim() || isValidEmail(val)) {
                    setErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.email;
                      return copy;
                    });
                  }
                }
              }}
              onBlur={() => {
                if (formData.email.trim() && !isValidEmail(formData.email)) {
                  setErrors((prev) => ({
                    ...prev,
                    email: isEn 
                      ? 'A valid suitable email address is required (e.g. user@example.com)' 
                      : 'Vui lòng nhập địa chỉ email hợp lệ (VD: user@example.com)'
                  }));
                }
              }}
              placeholder="e.g. traveller@domain.com"
              className={`w-full bg-white border rounded-xl px-3 outline-none py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                errors.email ? 'border-red-400 bg-red-50/5' : 'border-slate-200'
              }`}
            />
            {errors.email && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.email}</span>}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {isEn ? 'Active Mobile Hotline *' : 'Số Điện Thoại Liên Hệ *'}
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((prev) => ({ ...prev, phone: val }));
                if (val.trim() && isValidInternationalPhone(val)) {
                  if (errors.phone) {
                    setErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.phone;
                      return copy;
                    });
                  }
                }
              }}
              placeholder={isEn ? "e.g. +84912345678" : "VD: +84912345678"}
              className={`w-full bg-white border rounded-xl px-3 outline-none py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                errors.phone ? 'border-red-400 bg-red-50/5' : 'border-slate-200'
              }`}
            />
            {errors.phone && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.phone}</span>}
          </div>
        </div>

        {/* Liaison channel selection */}
        <div className="bg-white p-3 border border-slate-150 rounded-xl">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            {isEn ? 'Preferred direct chat preference (Updates & Alerts)' : 'Kênh liên lạc ưu tiên nhận thông báo (Cập nhật & Cảnh báo)'}
          </span>
          <div className="flex flex-wrap gap-2">
            {['WhatsApp', 'Zalo', 'SMS'].map((chan) => {
              const active = contactPref === chan;
              return (
                <button
                  key={chan}
                  type="button"
                  onClick={() => setContactPref(chan as any)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer transition-all ${
                    active 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {chan === 'WhatsApp' ? (isEn ? '💬 WhatsApp Channel' : '💬 Kênh WhatsApp') : chan === 'Zalo' ? (isEn ? '🔵 Zalo Chat' : '🔵 Chat Zalo') : (isEn ? '✉️ Traditional SMS' : '✉️ Tin nhắn SMS')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Invoice toggle */}
        <div className="bg-white p-4 border border-slate-150 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center">
              <FileText className="h-4.5 w-4.5 text-indigo-650 mr-2 shrink-0" />
              {isEn ? '🧾 Request Red Corporate VAT Billing' : '🧾 Yêu cầu xuất Hóa đơn đỏ GTGT (VAT)'}
            </span>
            <input 
              type="checkbox" 
              checked={wantsInvoice} 
              onChange={() => setWantsInvoice(!wantsInvoice)} 
              className="h-4 w-4 text-indigo-600 rounded border-slate-350 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {wantsInvoice && (
            <div className="p-3.5 bg-slate-50/50 border rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-550 mb-1">
                  {isEn ? 'Registered Company Name *' : 'Tên Công Ty Đăng Ký *'}
                </label>
                <input 
                  type="text" 
                  value={companyName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCompanyName(val);
                    if (val.trim() && errors.companyName) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.companyName;
                        return copy;
                      });
                    }
                  }}
                  placeholder="DIGIVISA VIETNAM CO LTD"
                  className={`w-full bg-white border rounded-lg p-2 text-xs ${
                    errors.companyName ? 'border-red-400 bg-red-50/5' : 'border-slate-200'
                  }`}
                />
                {errors.companyName && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.companyName}</span>}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-550 mb-1">
                  {isEn ? 'Registered MST / Tax Code *' : 'Mã Số Thuế Công Ty (MST) *'}
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
                  placeholder="0102030405"
                  className={`w-full bg-white border rounded-lg p-2 text-xs font-mono ${
                    errors.taxCode ? 'border-red-400 bg-red-50/5' : 'border-slate-200'
                  }`}
                />
                {errors.taxCode && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.taxCode}</span>}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-550 mb-1">
                  {isEn ? 'Company Registered Physical Address *' : 'Địa Chỉ Trụ Sở Công Ty *'}
                </label>
                <input 
                  type="text" 
                  value={companyAddress}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCompanyAddress(val);
                    if (val.trim() && errors.companyAddress) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.companyAddress;
                        return copy;
                      });
                    }
                  }}
                  placeholder="15 Le Loi, Ben Nghe, District 1, HCMC"
                  className={`w-full bg-white border rounded-lg p-2 text-xs ${
                    errors.companyAddress ? 'border-red-400 bg-red-50/5' : 'border-slate-200'
                  }`}
                />
                {errors.companyAddress && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.companyAddress}</span>}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-550 mb-1">
                  {isEn ? 'Recipient invoicing email (Optional)' : 'Email nhận hóa đơn (Không bắt buộc)'}
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
                  placeholder="finance@yourcompany.com"
                  className={`w-full bg-white border rounded-lg p-2 text-xs ${
                    errors.companyEmail ? 'border-red-400 bg-red-50/5' : 'border-slate-200'
                  }`}
                />
                {errors.companyEmail && <span className="text-[10px] text-red-500 font-medium block mt-1">{errors.companyEmail}</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Submit & Payment gateway */}
      <div className="p-5 sm:p-6 bg-slate-50/50 rounded-2xl border border-slate-205 space-y-4 shadow-sm" id="v2-card-sub">
        <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-150">
          <div className="h-6 w-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-650">
            <CreditCard className="h-4 w-4" />
          </div>
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-slate-800">
            {isEn ? '5. Payment Gateway' : '5. Cổng Thanh Toán'}
          </h3>
        </div>

        {/* Secure Checkout Selection */}
        <div className="space-y-3 pt-1">
          <h4 className="font-display font-bold text-[11px] uppercase text-slate-500">
            {isEn ? 'Select Secure Checkout Gateway' : 'Chọn Cổng Thanh Toán Bảo Mật'}
          </h4>
          <div className="grid grid-cols-1 gap-4">
            {/* 9Pay option */}
            <div 
              onClick={() => {
                if (!isVisaFormValid()) {
                  alert(isEn 
                    ? '⚠️ Please complete all required form fields above before generating the 9Pay QR code!' 
                    : '⚠️ Vui lòng điền đầy đủ các thông tin bắt buộc phía trên (Họ tên, Số Passport, Email, SĐT...) trước khi tạo Mã QR 9Pay!');
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

        {/* Billing Ledger */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-700 space-y-2">
          {formData.destinationCountry !== 'Vietnam' && (
            <>
              {/* Base Fee Row */}
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-150">
                <span className="font-medium text-slate-700">
                  {translateVisaType(formData.visaType)} {isEn ? '(Base Visa Fee)' : '(Lệ phí Visa gốc)'}
                </span>
                <span className="font-bold text-slate-900">{formatCharge(fees.base, 'base')}</span>
              </div>

              {/* Speed Surcharge Row */}
              {fees.speed > 0 && (
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-150">
                  <span className="font-medium text-slate-700">
                    {formData.destinationCountry === 'Vietnam'
                      ? (formData.resultsOption === 'same_day'
                          ? (isEn ? '⚡ Same-Day Rush Processing' : '⚡ Xử lý khẩn trong ngày')
                          : (formData.submissionTiming === 'before_9pm_next_day_noon'
                              ? (isEn ? '⚡ Next-Day Noon Express' : '⚡ Trả Trưa Khẩn hôm sau')
                              : (isEn ? '⚡ Next-Day 5PM Express' : '⚡ Trả Chiều Khẩn hôm sau')))
                      : (formData.processingSpeed === 'Express'
                          ? (isEn ? '⚡ Express Processing (2-3 days)' : '⚡ Xử lý Khẩn (2-3 ngày)')
                          : (isEn ? '⚡ Super Express Processing (24h)' : '⚡ Xử lý Siêu Khẩn (24h)'))
                    }
                  </span>
                  <span className="font-bold text-indigo-600">+{formatCharge(fees.speed, 'speed')}</span>
                </div>
              )}

              {/* Tax / Government Levy Row */}
              {fees.tax > 0 && (
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-150">
                  <span className="font-medium text-slate-700">
                    {isEn ? '🏛️ Gov. Levy & VAT Transaction Fee' : '🏛️ Lệ phí Cổng & Thuế VAT'}
                  </span>
                  <span className="font-bold text-slate-900">+{formatCharge(fees.tax, 'tax')}</span>
                </div>
              )}
            </>
          )}

          {/* Total Row */}
          <div className="flex justify-between items-center text-sm pt-0.5">
            <span className="font-bold text-slate-900">{isEn ? 'Total Fee:' : 'Tổng Lệ Phí Thanh Toán:'}</span>
            <strong className="font-display font-black text-slate-900 text-base bg-emerald-50 text-emerald-800 px-3 py-1 rounded">
              {formatCharge(fees.total, 'total')}
            </strong>
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

        {/* Action checkout button */}
        <div className="pt-4 border-t flex justify-center">
          <button
            onClick={handleSubmit}
            id="visa-submit-btn"
            className="w-full sm:w-auto px-10 py-4.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:brightness-110 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/15 cursor-pointer active:scale-[0.99] transition-all"
          >
            <CreditCard className="h-4.5 w-4.5" />
            <span>
              {isEn ? 'Complete Live Registration & Authorize Ticket' : 'Hoàn Tất Đăng Ký & Thanh Toán Ngay'}
            </span>
          </button>
        </div>
      </div>

      {/* Image Preview Lightbox Modal */}
      {previewModalUrl && (
        <div 
          onClick={() => setPreviewModalUrl(null)}
          className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden p-2 flex flex-col items-center shadow-2xl">
            <button
              onClick={() => setPreviewModalUrl(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={previewModalUrl}
              alt="Document Scan Preview Full"
              className="max-h-[80vh] w-auto object-contain rounded-2xl"
            />
            <p className="text-xs text-slate-300 font-mono mt-2">
              {isEn ? 'Press anywhere or click ✕ to close preview' : 'Bấm bất kỳ đâu hoặc bấm ✕ để đóng'}
            </p>
          </div>
        </div>
      )}
      {/* Modal Cảnh Báo Đã Quá Giờ Nhận Đơn Khẩn Trong Ngày (Same-Day Cutoff Modal) */}
      {isSameDayCutoffModalOpen && (
        <div 
          onClick={() => setIsSameDayCutoffModalOpen(false)}
          className="fixed inset-0 z-[300] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7 text-slate-800 space-y-4 font-sans"
          >
            <button
              onClick={() => setIsSameDayCutoffModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center text-amber-600 shadow-xs">
                <AlertTriangle className="h-7 w-7 text-amber-500" />
              </div>

              <h3 className="text-lg font-black tracking-tight font-display text-slate-900 leading-snug">
                {isEn ? '⚠️ Same-Day Urgent Cutoff Passed' : '⚠️ Đã Quá Giờ Tiếp Nhận Đơn Khẩn Trong Ngày'}
              </h3>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2 text-slate-600 text-left font-sans">
                <p className="leading-relaxed">
                  {isEn 
                    ? 'Same-day urgent processing only accepts applications submitted BEFORE 12:00 PM NOON (Vietnam Time) for priority officer clearance.'
                    : 'Rất tiếc! Dịch vụ nộp khẩn lấy kết quả ngay trong ngày chỉ tiếp nhận hồ sơ TRƯỚC 12:00 TRƯƠA (giờ Việt Nam) để kịp duyệt với Cục XNK.'}
                </p>
                <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between font-mono font-bold text-[11px]">
                  <span className="text-slate-500">{isEn ? 'Current VN Time:' : 'Giờ Việt Nam hiện tại:'}</span>
                  <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {vnTimeDetails.formattedTime} (UTC+7)
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                {isEn 
                  ? 'Please select the "Results within 2 days" option to schedule express delivery for tomorrow.' 
                  : 'Quý khách vui lòng chọn tùy chọn "Có kết quả sau 2 ngày" để được sắp xếp lịch trả kết quả khẩn vào ngày hôm sau.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({
                  ...prev,
                  resultsOption: 'within_2_days',
                  submissionTiming: prev.submissionTiming || 'before_3pm'
                }));
                setIsSameDayCutoffModalOpen(false);
              }}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <CheckCircle className="h-4 w-4" />
              <span>
                {isEn ? '⚡ Switch to Express 2-Day Option' : '⚡ Đã Hiểu - Chuyển Sang Chọn Gói Sau 2 Ngày'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
