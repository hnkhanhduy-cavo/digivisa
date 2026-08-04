import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, Landmark, CreditCard, CheckCircle, AlertCircle, TrendingUp
} from 'lucide-react';
import { VisaApplication, Currency, CURRENCY_SYMBOLS, EXCHANGE_RATES, NATIONALITIES, Order } from '../types';
import { Language, TRANSLATIONS } from '../utils/translations';
import { getVietnamPricing } from '../utils/pricing';
import VisaFormV2 from './VisaFormV2';
import { HistoricalProfile } from '../data/historicalUsers';
import { safeStorage, safeOpen } from '../utils/storage';
import { isValidEmail, isValidPassportNumber, isValidInternationalPhone, isValidTaxCode } from '../utils/validation';
import { generateOrderId, generateTrackingToken } from '../utils/orderIds';
import UploadErrorModal, { UploadErrorModalData } from './UploadErrorModal';

interface VisaFormProps {
  language: Language;
  currency: Currency;
  onSuccess: (newOrder: Order) => void;
  onCancel: () => void;
}

export default function VisaForm({ language, currency, onSuccess, onCancel }: VisaFormProps) {
  const isEn = language === 'EN';
  const initialDraft = React.useMemo(() => {
    try {
      const saved = safeStorage.getItem('digivisa_visa_draft');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse initial visa draft:', e);
    }
    return null;
  }, []);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<'9pay' | 'bank_transfer'>(() => (initialDraft && initialDraft.paymentMethod) ?? '9pay');
  const [isRedirecting, setIsRedirecting] = useState(false);

  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(() => {
    if (initialDraft && initialDraft.formData) {
      const f = initialDraft.formData;
      return !!(f.firstName || f.lastName || f.passportNumber || f.email);
    }
    return false;
  });

  // VAT Invoice options states
  const [wantsInvoice, setWantsInvoice] = useState<boolean>(() => (initialDraft && initialDraft.wantsInvoice) ?? false);
  const [companyName, setCompanyName] = useState<string>(() => (initialDraft && initialDraft.companyName) ?? '');
  const [taxCode, setTaxCode] = useState<string>(() => (initialDraft && initialDraft.taxCode) ?? '');
  const [companyAddress, setCompanyAddress] = useState<string>(() => (initialDraft && initialDraft.companyAddress) ?? '');
  const [companyEmail, setCompanyEmail] = useState<string>(() => (initialDraft && initialDraft.companyEmail) ?? '');

  // Form State
  const [formData, setFormData] = useState<Omit<VisaApplication, 'totalFee'>>(() => {
    return (initialDraft && initialDraft.formData) || {
      firstName: '',
      lastName: '',
      passportNumber: '',
      passportExpiry: '',
      nationality: 'Korea',
      dateOfBirth: '',
      arrivalDate: '',
      email: '',
      phone: '',
      visaType: 'Single eVisa',
      processingSpeed: 'Standard',
      passportScan: '',
      photoScan: '',
      destinationCountry: 'Vietnam',
      resultsOption: 'within_2_days',
      submissionTiming: 'before_3pm',
    };
  });

  // Drag and Drop Ref/States
  const [passportDragActive, setPassportDragActive] = useState(false);
  const [photoDragActive, setPhotoDragActive] = useState(false);
  const [contactPref, setContactPref] = useState<'WhatsApp' | 'Zalo' | 'SMS'>(() => (initialDraft && initialDraft.contactPref) ?? 'WhatsApp');

  const passportInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Save draft on change (auto-save)
  React.useEffect(() => {
    const draft = {
      formData,
      paymentMethod,
      contactPref,
      wantsInvoice,
      companyName,
      taxCode,
      companyAddress,
      companyEmail
    };
    safeStorage.setItem('digivisa_visa_draft', JSON.stringify(draft));
  }, [formData, paymentMethod, contactPref, wantsInvoice, companyName, taxCode, companyAddress, companyEmail]);

  const handleResetDraft = () => {
    safeStorage.removeItem('digivisa_visa_draft');
    setFormData({
      firstName: '',
      lastName: '',
      passportNumber: '',
      passportExpiry: '',
      nationality: 'Korea',
      dateOfBirth: '',
      arrivalDate: '',
      email: '',
      phone: '',
      visaType: 'Single eVisa',
      processingSpeed: 'Standard',
      passportScan: '',
      photoScan: '',
      destinationCountry: 'Vietnam',
      resultsOption: 'within_2_days',
      submissionTiming: 'before_3pm',
    });
    setWantsInvoice(false);
    setCompanyName('');
    setTaxCode('');
    setCompanyAddress('');
    setCompanyEmail('');
    setHasRestoredDraft(false);
  };

  const validateAll = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nationality) newErrors.nationality = isEn ? 'Nationality is required' : 'Vui lòng chọn quốc tịch';
    if (!formData.firstName.trim()) newErrors.firstName = isEn ? 'First Name is required' : 'Vui lòng nhập tên';
    if (!formData.lastName.trim()) newErrors.lastName = isEn ? 'Last Name is required' : 'Vui lòng nhập họ';
    if (!formData.email.trim() || !isValidEmail(formData.email)) {
      newErrors.email = isEn 
        ? 'A valid suitable email address is required (e.g. user@example.com)' 
        : 'Vui lòng nhập địa chỉ email hợp lệ (VD: user@example.com)';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = isEn ? 'Phone Number is required' : 'Vui lòng nhập số điện thoại';
    } else if (!isValidInternationalPhone(formData.phone)) {
      newErrors.phone = isEn 
        ? 'Phone number must be in valid international format (e.g., +84912345678)' 
        : 'Số điện thoại phải theo định dạng quốc tế (VD: +84912345678)';
    }
    if (!formData.passportNumber.trim()) {
      newErrors.passportNumber = isEn ? 'Passport number is required' : 'Vui lòng nhập số hộ chiếu';
    } else if (!isValidPassportNumber(formData.passportNumber)) {
      newErrors.passportNumber = isEn 
        ? 'Invalid passport number format (only alphanumeric characters allowed)' 
        : 'Định dạng số hộ chiếu không hợp lệ (chỉ chấp nhận chữ và số)';
    }
    if (!formData.passportExpiry) newErrors.passportExpiry = isEn ? 'Passport expiry date is required' : 'Vui lòng chọn ngày hết hạn hộ chiếu';
    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = isEn ? 'Date of birth is required' : 'Vui lòng chọn ngày sinh';
    } else {
      const todayStr = new Date().toISOString().split('T')[0];
      if (formData.dateOfBirth > todayStr) {
        newErrors.dateOfBirth = isEn ? 'Date of birth cannot be in the future' : 'Ngày sinh không thể ở tương lai';
      }
    }
    if (!formData.arrivalDate) {
      newErrors.arrivalDate = isEn ? 'Planned arrival date is required' : 'Vui lòng chọn ngày nhập cảnh dự kiến';
    } else {
      const todayStr = new Date().toISOString().split('T')[0];
      if (formData.arrivalDate < todayStr) {
        newErrors.arrivalDate = isEn ? 'Planned arrival date cannot be in the past' : 'Ngày nhập cảnh không thể ở quá khứ';
      }
    }
    
    if (formData.passportExpiry) {
      const expiry = new Date(formData.passportExpiry);
      const today = new Date();
      const sixMonths = new Date();
      sixMonths.setMonth(today.getMonth() + 6);
      if (expiry < sixMonths) {
        newErrors.passportExpiry = isEn ? 'Passport must be valid for at least 6 months beyond today' : 'Hộ chiếu phải còn hạn ít nhất 6 tháng';
      }
    }

    if (!formData.passportScan) newErrors.passportScan = isEn ? 'Passport photo scan is required' : 'Vui lòng tải lên ảnh trang nhân thân hộ chiếu';

    if (wantsInvoice) {
      if (!companyName.trim()) {
        newErrors.companyName = isEn ? 'Company registered name is required' : 'Vui lòng nhập tên công ty đăng ký';
      }
      if (!taxCode.trim()) {
        newErrors.taxCode = isEn ? 'Registered tax code (MST) is required' : 'Vui lòng nhập mã số thuế công ty (MST)';
      } else if (!isValidTaxCode(taxCode)) {
        newErrors.taxCode = isEn 
          ? 'Invalid Tax Code format (must be 10 digits or 13 digits for branches, e.g., 0102030405)' 
          : 'Mã số thuế không hợp lệ (gồm 10 số hoặc 13 số nhánh, VD: 0102030405)';
      }
      if (!companyAddress.trim()) {
        newErrors.companyAddress = isEn ? 'Company tax billing address is required' : 'Vui lòng nhập địa chỉ trụ sở công ty';
      }
      if (companyEmail.trim() && !isValidEmail(companyEmail)) {
        newErrors.companyEmail = isEn ? 'Valid company invoicing email is required' : 'Vui lòng nhập email công ty hợp lệ';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Computed live dossier clearance appraisal
  const readiness = calculateVisaReadiness(formData, language);

  // Pricing constants in USD dynamically computed based on nationality
  const isTaiwanOrChina = formData.nationality === 'Taiwan' || formData.nationality === 'China';
  
  const VISA_PRICES: Record<string, number> = {
    'Tourist (30 Days)': isTaiwanOrChina ? 130 : 120,
    'Tourist (90 Days)': 220,
  };

  const PROCESSING_FEES: Record<VisaApplication['processingSpeed'], number> = {
    Standard: 0,
    Express: 35,
    SuperExpress: 75,
  };

  const getCalculatedFees = () => {
    if (formData.destinationCountry === 'Vietnam') {
      return getVietnamPricing(
        formData.visaType,
        formData.resultsOption || '',
        formData.submissionTiming || ''
      );
    } else {
      const base = VISA_PRICES[formData.visaType] || 120;
      const speed = 0;
      const subtotal = base + speed;
      const processingTaxRate = 0; // Tax included in option price
      const tax = 0;
      const total = subtotal;

      // Direct VND calculation using exact values requested:
      let baseVnd = base * 25000;
      if (formData.nationality === 'Taiwan') {
        if (base === 130) baseVnd = 3450000;
      } else if (formData.nationality === 'China') {
        if (base === 130) baseVnd = 3445000;
      } else if (formData.nationality === 'Korea' || formData.nationality === 'Japan' || formData.nationality === 'South Korea') {
        if (base === 120) baseVnd = 3120000;
        if (base === 220) baseVnd = 5720000;
      }

      const speedVnd = 0;
      const subtotalVnd = baseVnd + speedVnd;
      const taxVnd = 0;
      const totalVnd = subtotalVnd;

      return {
        base,
        speed,
        tax,
        total,
        baseVnd,
        speedVnd,
        taxVnd,
        totalVnd,
      };
    }
  };

  const fees = getCalculatedFees();

  // Helper convert
  const formatCharge = (usdAmount: any, type?: 'base' | 'speed' | 'tax' | 'total') => {
    const val = typeof usdAmount === 'number' ? usdAmount : (parseFloat(usdAmount) || 0);
    if (currency === 'VND') {
      const calculated = getCalculatedFees();
      let vndVal = val * 25000;
      if (type === 'base') vndVal = calculated.baseVnd;
      else if (type === 'speed') vndVal = calculated.speedVnd;
      else if (type === 'tax') vndVal = calculated.taxVnd;
      else if (type === 'total') vndVal = calculated.totalVnd;
      else {
        // First check standard base rates for specific nationalities so the option cards are correct
        if (formData.nationality === 'Taiwan' && val === 130) {
          vndVal = 3450000;
        } else if (formData.nationality === 'China' && val === 130) {
          vndVal = 3445000;
        } else if (formData.nationality === 'Korea' || formData.nationality === 'Japan' || formData.nationality === 'South Korea') {
          if (val === 120) vndVal = 3120000;
          else if (val === 220) vndVal = 5720000;
        } else {
          // Fallback or generic lookup
          if (val === calculated.base) vndVal = calculated.baseVnd;
          else if (val === calculated.total) vndVal = calculated.totalVnd;
          else if (val === calculated.speed) vndVal = calculated.speedVnd;
          else if (val === calculated.tax) vndVal = calculated.taxVnd;
        }
      }
      return `${vndVal.toLocaleString('vi-VN')} ${CURRENCY_SYMBOLS[currency]}`;
    }
    return `${CURRENCY_SYMBOLS[currency]}${val.toFixed(2)}`;
  };

  const [uploadErrorModal, setUploadErrorModal] = useState<UploadErrorModalData | null>(null);

  // Remove/Cancel uploaded file and revert to empty initial state
  const handleRemoveFile = (type: 'passport' | 'photo') => {
    if (type === 'passport') {
      setFormData((prev) => ({ ...prev, passportScan: '', passportScanDataUrl: '' }));
      if (passportInputRef.current) passportInputRef.current.value = '';
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.passportScan;
        return copy;
      });
    } else {
      setFormData((prev) => ({ ...prev, photoScan: '', photoScanDataUrl: '' }));
      if (photoInputRef.current) photoInputRef.current.value = '';
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.photoScan;
        return copy;
      });
    }
  };

  // Real local passport / photo upload with format & size validation
  const simulateFileUpload = (file: File, type: 'passport' | 'photo') => {
    const fileName = file.name.toLowerCase();
    const ext = fileName.split('.').pop() || '';
    const validExts = ['jpg', 'jpeg', 'png'];
    const isExtValid = validExts.includes(ext);

    // 1. Format check: Only JPG, JPEG, PNG are accepted
    if (!isExtValid) {
      handleRemoveFile(type);
      setUploadErrorModal({
        isOpen: true,
        type: 'format',
        fileName: file.name,
        uploadType: type
      });
      return;
    }

    // 2. Size check: Under 2MB limit (2 * 1024 * 1024 bytes)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      handleRemoveFile(type);
      const fileSizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setUploadErrorModal({
        isOpen: true,
        type: 'size',
        fileName: file.name,
        fileSizeMb,
        uploadType: type
      });
      return;
    }

    // 3. Valid file: Convert to Base64 image Data URL for Firebase Firestore storage
    const reader = new FileReader();
    reader.onload = (event) => {
      const resultDataUrl = event.target?.result as string;
      if (!resultDataUrl) return;

      const img = new Image();
      img.onload = () => {
        // High resolution limit (1920px Full HD for ultra-sharp passport text readability)
        const maxDim = 1920;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        let finalDataUrl = resultDataUrl;
        if (ctx) {
          // Fill canvas with solid crisp white background to prevent checkered/transparent/black background artifacts
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          // Export high-fidelity JPEG with 0.95 quality
          finalDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        }

        if (type === 'passport') {
          setFormData((prev) => ({
            ...prev,
            passportScan: file.name,
            passportScanDataUrl: finalDataUrl
          }));
          setErrors((prev) => {
            const copy = { ...prev };
            delete copy.passportScan;
            return copy;
          });
        } else {
          setFormData((prev) => ({
            ...prev,
            photoScan: file.name,
            photoScanDataUrl: finalDataUrl
          }));
          setErrors((prev) => {
            const copy = { ...prev };
            delete copy.photoScan;
            return copy;
          });
        }
      };
      img.onerror = () => {
        if (type === 'passport') {
          setFormData((prev) => ({
            ...prev,
            passportScan: file.name,
            passportScanDataUrl: resultDataUrl
          }));
          setErrors((prev) => {
            const copy = { ...prev };
            delete copy.passportScan;
            return copy;
          });
        } else {
          setFormData((prev) => ({
            ...prev,
            photoScan: file.name,
            photoScanDataUrl: resultDataUrl
          }));
          setErrors((prev) => {
            const copy = { ...prev };
            delete copy.photoScan;
            return copy;
          });
        }
      };
      img.src = resultDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent, type: 'passport' | 'photo') => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      if (type === 'passport') setPassportDragActive(true);
      if (type === 'photo') setPhotoDragActive(true);
    } else if (e.type === 'dragleave') {
      if (type === 'passport') setPassportDragActive(false);
      if (type === 'photo') setPhotoDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent, type: 'passport' | 'photo') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'passport') setPassportDragActive(false);
    if (type === 'photo') setPhotoDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      simulateFileUpload(e.dataTransfer.files[0], type);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'passport' | 'photo') => {
    if (e.target.files && e.target.files[0]) {
      simulateFileUpload(e.target.files[0], type);
    }
  };

  const triggerFileInput = (type: 'passport' | 'photo') => {
    if (type === 'passport') passportInputRef.current?.click();
    if (type === 'photo') photoInputRef.current?.click();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) {
      alert(isEn 
        ? '⚠️ Please complete all required fields highlighted in red (Name, Passport, Email, Phone, Document Uploads) before proceeding to 9Pay Checkout!' 
        : '⚠️ Vui lòng điền đầy đủ các thông tin còn thiếu (được đánh dấu khung đỏ phía trên như Họ tên, Số Passport, Email, SĐT, Tải ảnh Passport...) trước khi chuyển hướng 9Pay!');
      // Scroll to first invalid element if any
      setTimeout(() => {
        const errField = document.querySelector('.border-red-400');
        if (errField) {
          errField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    const orderId = generateOrderId();
    const trackingToken = generateTrackingToken();

    const finalApplication: VisaApplication = {
      ...formData,
      phone: `${formData.phone} (${contactPref})`,
      totalFee: fees.total,
      wantsInvoice,
      companyName: wantsInvoice ? companyName : undefined,
      taxCode: wantsInvoice ? taxCode : undefined,
      companyAddress: wantsInvoice ? companyAddress : undefined,
      companyEmail: wantsInvoice ? companyEmail : undefined,
      readinessPercent: readiness.score,
      readinessChecks: readiness.checks,
    };

    const newOrder: Order = {
      id: orderId,
      type: 'Visa',
      status: 'Pending Payment',
      createdAt: new Date().toISOString(),
      paymentStatus: 'Pending',
      trackingToken,
      details: finalApplication,
    };

    safeStorage.removeItem('digivisa_visa_draft');
    onSuccess(newOrder);
  };

  return (
    <div className="max-w-7xl mx-auto" id="visa-flow-container">
      {/* 9Pay Redirecting overlay */}
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
                  <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 border-r-indigo-500/20 border-b-indigo-500/10 border-l-indigo-500/30 animate-spin"></div>
                  <div className="absolute inset-2 bg-slate-950 rounded-full flex items-center justify-center">
                    <span className="font-display font-extrabold text-[10px] text-indigo-400">9Pay</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-extrabold text-lg">
                  {isEn ? 'Connecting to 9Pay Gate' : 'Đang Kết Nối Cổng 9Pay'}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  {isEn 
                    ? "Please wait while we route your clearance transaction to 9Pay's secured billing gateway."
                    : 'Vui lòng chờ trong giây lát khi hệ thống chuyển hướng giao dịch của bạn sang cổng thanh toán bảo mật 9Pay.'}
                </p>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span>{isEn ? 'Merchant ID:' : 'ID Đối Tác:'}</span>
                  <span className="font-mono text-slate-400">DIGIVISA-SYS</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>{isEn ? 'USD Charge Amount:' : 'Số tiền thanh toán USD:'}</span>
                  <strong className="text-teal-400 font-mono font-bold">${fees.total.toFixed(2)} USD</strong>
                </div>
              </div>
              <div className="text-[10px] text-amber-500 font-medium">
                {isEn 
                  ? '⚠️ Secure payment page will open in a new tab. Do not reload.'
                  : '⚠️ Trang thanh toán bảo mật sẽ mở trong tab mới. Vui lòng không tải lại.'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back button & title */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onCancel}
          id="visa-cancel-back"
          className="flex items-center space-x-2 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{isEn ? 'Back to Landing' : 'Quay lại Trang Chủ'}</span>
        </button>
        <div className="text-xs font-mono bg-slate-100 text-slate-600 px-3 py-1 rounded-full border border-slate-200">
          {isEn ? 'SECURE REGISTRATION GATEWAY' : 'CỔNG ĐĂNG KÝ BẢO MẬT'}
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        
          {/* Visa Wizard Progress Header */}
          <div className="bg-slate-50 border-b border-slate-100 px-6 py-6 sm:px-10 sm:py-8 text-slate-900">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
              <div className="flex items-center space-x-3">
                <Landmark className="h-5 w-5 text-indigo-600" />
                <span className="font-display font-bold text-xs uppercase tracking-widest text-[#64748B] select-none">
                  {isEn ? 'DIGIVISA GLOBAL CORE' : 'HỆ THỐNG GỐC DIGIVISA'}
                </span>
              </div>
            </div>
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-slate-900">
              {isEn ? 'Visa Clearance Registration' : 'Đăng Ký Thủ Tục Cấp Visa'}
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              {isEn 
                ? 'Submit your travel records in a single streamlined form to obtain exit/entry clearance codes.'
                : 'Khai báo thông tin hành trình để nhận công văn chấp thuận nhập cảnh chính thức nhanh chóng.'}
            </p>

            {hasRestoredDraft && (
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800" id="visa-draft-alert">
                <div className="flex items-center space-x-2">
                  <span className="flex h-2 w-2 rounded-full bg-amber-500 relative animate-pulse shrink-0" />
                  <span className="font-sans">
                    <strong>{isEn ? 'Restored Draft state:' : 'Bản Nháp Đã Khôi Phục:'}</strong>{' '}
                    {isEn 
                      ? 'We automatically loaded your previous progress so you can continue where you left off.'
                      : 'Hệ thống tự động tải lại tiến trình trước đó để bạn có thể tiếp tục hoàn thành biểu mẫu.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetDraft}
                  className="mt-2 sm:mt-0 ml-0 sm:ml-3 text-amber-700 hover:text-amber-900 hover:no-underline underline font-bold transition-all shrink-0 cursor-pointer self-start sm:self-auto"
                >
                  {isEn ? 'Clear Form & Start Fresh' : 'Xóa Nháp & Làm Mới'}
                </button>
              </div>
            )}
          </div>

          <div className="p-6 sm:p-10">
            <VisaFormV2
              language={language}
              currency={currency}
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              setErrors={setErrors}
              wantsInvoice={wantsInvoice}
              setWantsInvoice={setWantsInvoice}
              companyName={companyName}
              setCompanyName={setCompanyName}
              taxCode={taxCode}
              setTaxCode={setTaxCode}
              companyAddress={companyAddress}
              setCompanyAddress={setCompanyAddress}
              companyEmail={companyEmail}
              setCompanyEmail={setCompanyEmail}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              contactPref={contactPref}
              setContactPref={setContactPref}
              passportDragActive={passportDragActive}
              setPassportDragActive={setPassportDragActive}
              photoDragActive={photoDragActive}
              setPhotoDragActive={setPhotoDragActive}
              handleDrag={handleDrag}
              handleDrop={handleDrop}
              handleFileChange={handleFileChange}
              triggerFileInput={triggerFileInput}
              handleRemoveFile={handleRemoveFile}
              passportInputRef={passportInputRef}
              photoInputRef={photoInputRef}
              fees={fees}
              formatCharge={formatCharge}
              handleSubmit={handleSubmit}
              VISA_PRICES={VISA_PRICES}
            />
          </div>
        </div>

      {/* Pop-up error modal for invalid file format or size > 2MB */}
      <UploadErrorModal
        data={uploadErrorModal}
        onClose={() => setUploadErrorModal(null)}
        language={language}
      />
    </div>
  );
}

export interface AssessmentItem {
  id: string;
  name: string;
  description: string;
  status: 'passed' | 'warning' | 'pending';
}

export function calculateVisaReadiness(formData: any, language: Language = 'EN') {
  const isEn = language === 'EN';
  let score = 10;
  const checks: AssessmentItem[] = [];

  // Nationality Check
  if (formData.nationality) {
    checks.push({
      id: 'nationality',
      name: isEn ? 'Passport Origin Assessed' : 'Đánh Giá Quốc Tịch',
      description: isEn 
        ? `Targeting regulations for entry with ${formData.nationality} travel records.`
        : `Áp dụng quy định nhập cảnh dành cho công dân quốc tịch ${formData.nationality}.`,
      status: 'passed'
    });
    score += 5;
  } else {
    checks.push({
      id: 'nationality',
      name: isEn ? 'Passport Origin' : 'Quốc Tịch Hộ Chiếu',
      description: isEn 
        ? 'Select your country of passport to determine state entry rules.'
        : 'Vui lòng chọn quốc tịch hộ chiếu để đối soát quy định nhập cảnh.',
      status: 'pending'
    });
  }

  // Personal Fields Check
  const personalFieldsComplete = formData.firstName.trim().length > 0 && formData.lastName.trim().length > 0;
  if (personalFieldsComplete) {
    checks.push({
      id: 'personal',
      name: isEn ? 'Sponsor & Identity Authenticated' : 'Xác Minh Danh Tính',
      description: isEn 
        ? 'Legal biographical names match electronic records.'
        : 'Họ tên khai sinh trùng khớp chính xác với hồ sơ điện tử.',
      status: 'passed'
    });
    score += 20;
  } else {
    checks.push({
      id: 'personal',
      name: isEn ? 'Traveller Bio Profile' : 'Thông Tin Nhân Thân',
      description: isEn 
        ? 'Provide first & last names matching your passport document exactly.'
        : 'Cung cấp họ tên đầy đủ khớp chính xác với hộ chiếu của bạn.',
      status: 'pending'
    });
  }

  // Passport Info Check
  if (formData.passportNumber.trim().length > 0) {
    checks.push({
      id: 'passport_num',
      name: isEn ? 'Document Code Registered' : 'Ghi Nhận Số Hộ Chiếu',
      description: isEn 
        ? 'Standard machine-readable document registered.'
        : 'Số hộ chiếu đã được ghi nhận trên hệ thống.',
      status: 'passed'
    });
    score += 10;
  } else {
    checks.push({
      id: 'passport_num',
      name: isEn ? 'Passport Number Registration' : 'Đăng Ký Số Hộ Chiếu',
      description: isEn 
        ? 'Enter your booklet passport number for border lookups.'
        : 'Nhập số hộ chiếu để đối chiếu tại cửa khẩu nhập cảnh.',
      status: 'pending'
    });
  }

  // Passport Expiration Check (> 6 Months beyond arrival)
  if (formData.passportExpiry && formData.arrivalDate) {
    try {
      const expiryDate = new Date(formData.passportExpiry);
      const arrivalDate = new Date(formData.arrivalDate);
      const timeDiff = expiryDate.getTime() - arrivalDate.getTime();
      const daysDiff = timeDiff / (1000 * 3600 * 24);
      const monthsDiff = daysDiff / 30.4;

      if (monthsDiff >= 6) {
        checks.push({
          id: 'expiry',
          name: isEn ? 'Expiry Date Threshold Safe' : 'Thời Hạn Hộ Chiếu An Toàn',
          description: isEn 
            ? `Passport is valid for ${Math.max(0, monthsDiff).toFixed(1)} months beyond arrival (safe requirement).`
            : `Hộ chiếu còn hạn ${Math.max(0, monthsDiff).toFixed(1)} tháng từ ngày đến (đủ điều kiện nhập cảnh).`,
          status: 'passed'
        });
        score += 15;
      } else {
        checks.push({
          id: 'expiry',
          name: isEn ? 'Urgent: Expiry Warning' : 'Cảnh Báo Hết Hạn Hộ Chiếu',
          description: isEn 
            ? `Expires in only ${Math.max(0, monthsDiff).toFixed(1)} months. Border authorities reject entries with < 6 months validity.`
            : `Hộ chiếu chỉ còn hạn ${Math.max(0, monthsDiff).toFixed(1)} tháng. Cơ quan xuất nhập cảnh từ chối nếu thời hạn dưới 6 tháng.`,
          status: 'warning'
        });
      }
    } catch (e) {
      checks.push({
        id: 'expiry',
        name: isEn ? 'Passport Expiry Invalid' : 'Ngày Hết Hạn Không Hợp Lệ',
        description: isEn 
          ? 'Provide a valid dates format for exit passport booklet check.'
          : 'Vui lòng cung cấp ngày hết hạn hợp lệ để kiểm tra điều kiện xuất nhập cảnh.',
        status: 'warning'
      });
    }
  } else if (formData.passportExpiry) {
    // Check expiry vs today
    try {
      const expiryDate = new Date(formData.passportExpiry);
      const today = new Date();
      const sixMonths = new Date();
      sixMonths.setMonth(today.getMonth() + 6);
      if (expiryDate >= sixMonths) {
        checks.push({
          id: 'expiry',
          name: isEn ? 'Expiry Date Safe Check' : 'Kiểm Tra Thời Hạn Hộ Chiếu',
          description: isEn 
            ? 'Temporary passport valid for over 6 months from today.'
            : 'Hộ chiếu còn hạn trên 6 tháng so với ngày hôm nay.',
          status: 'passed'
        });
        score += 15;
      } else {
        checks.push({
          id: 'expiry',
          name: isEn ? 'Passport Expiry Insufficient' : 'Hạn Hộ Chiếu Không Đủ',
          description: isEn 
            ? 'Document expires in less than 6 months. Renewal recommended before flight entry.'
            : 'Hộ chiếu còn hạn dưới 6 tháng. Khuyến nghị gia hạn trước khi bay.',
          status: 'warning'
        });
      }
    } catch (e) {
      checks.push({
        id: 'expiry',
        name: isEn ? 'Passport Expiry Invalid' : 'Ngày Hết Hạn Không Hợp Lệ',
        description: isEn ? 'Provide a valid dates format.' : 'Cung cấp định dạng ngày hợp lệ.',
        status: 'warning'
      });
    }
  } else {
    checks.push({
      id: 'expiry',
      name: isEn ? 'Passport Expiration Date' : 'Ngày Hết Hạn Hộ Chiếu',
      description: isEn 
        ? 'Border controls require at least 6 months validity from date of arrival.'
        : 'Cơ quan biên phòng yêu cầu hộ chiếu còn hạn ít nhất 6 tháng tính từ ngày đến.',
      status: 'pending'
    });
  }

  // Passport Scans Checklist
  if (formData.passportScan) {
    checks.push({
      id: 'scan_passport',
      name: isEn ? 'Identity Ledger Scan Match' : 'Đã Tải Trang Hộ Chiếu',
      description: isEn 
        ? `Passport image OCR matching enabled (${formData.passportScan}).`
        : `Đã kết nối quét ảnh hộ chiếu tự động OCR (${formData.passportScan}).`,
      status: 'passed'
    });
    score += 43;
  } else {
    checks.push({
      id: 'scan_passport',
      name: isEn ? 'Biometrics Info Scan' : 'Quét Thông Tin Sinh Trắc',
      description: isEn 
        ? 'Upload high-resolution passport photo page for AI OCR scanner automation.'
        : 'Tải lên ảnh trang thông tin hộ chiếu sắc nét để hệ thống AI OCR tự động xử lý.',
      status: 'pending'
    });
  }

  // Priority bonus check
  if (formData.processingSpeed === 'Express' || formData.processingSpeed === 'SuperExpress') {
    score += 5;
  }

  // Bound score between 12% and 98%
  const finalScore = Math.min(Math.max(score, 12), 98);

  return {
    score: finalScore,
    checks,
    recommendations: generateRecommendations(checks, language)
  };
}

function generateRecommendations(checks: AssessmentItem[], language: Language = 'EN'): string[] {
  const isEn = language === 'EN';
  const recommendations: string[] = [];
  const pending = checks.filter(c => c.status === 'pending');
  const warnings = checks.filter(c => c.status === 'warning');

  if (warnings.length > 0) {
    warnings.forEach(w => {
      if (w.id === 'expiry') {
        recommendations.push(isEn 
          ? "Passport expiration warning: Consider updating / renewing your passport booklet to ensure border authorities do not decline boarding permission."
          : "Cảnh báo hết hạn hộ chiếu: Vui lòng cân nhắc gia hạn hộ chiếu sớm để tránh nguy cơ bị hãng hàng không từ chối làm thủ tục bay.");
      }
    });
  }

  if (pending.length > 0) {
    if (pending.some(p => p.id === 'scan_passport')) {
      recommendations.push(isEn 
        ? "Upload a crisp passport scanned image where all text is clear to trigger automatic AI pre-screening approval."
        : "Hãy tải lên bản scan hộ chiếu rõ nét, không bị lóa mờ để kích hoạt cơ chế AI tự động duyệt hồ sơ.");
    }
    if (pending.some(p => p.id === 'personal')) {
      recommendations.push(isEn 
        ? "Complete all spelling details matching your passport character-by-character to prevent processing delays."
        : "Điền họ tên đầy đủ trùng khớp từng ký tự trên hộ chiếu để hạn chế tối đa các chậm trễ ngoài ý muốn.");
    }
  } else if (warnings.length === 0) {
    recommendations.push(isEn 
      ? "Assessment level excellent. Your dossier is highly synchronized with digital boundary standards."
      : "Mức độ đánh giá xuất sắc. Hồ sơ của bạn đạt chuẩn tuyệt đối và sẵn sàng phê duyệt lập tức.");
  }

  return recommendations;
}
