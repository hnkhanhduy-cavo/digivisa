import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plane, Sparkles, CheckCircle, ShieldCheck, Compass, HelpCircle, 
  MapPin, Clock, Star, MessageSquare, ExternalLink, RefreshCw, 
  Search, ShieldAlert, Award, FileText, ChevronRight, BellRing, PhoneCall
} from 'lucide-react';

import { Order, Currency, CURRENCY_SYMBOLS } from './types';
import { safeStorage } from './utils/storage';
import { Language, TRANSLATIONS } from './utils/translations';
import { getTodayStr, getTodayOffsetStr } from './utils/validation';
import { formatConvertedPrice, resolveOrderAmountVnd } from './utils/pricing';
import { NINEPAY_MIN_AMOUNT_VND } from './utils/ninepay';
import { syncUnpaidOrdersViaInquire, verifyOrderPayment } from './utils/paymentSync';
import Header from './components/Header';
import Footer from './components/Footer';
import VisaForm from './components/VisaForm';
import FastTrackForm from './components/FastTrackForm';
import AirportPickupForm from './components/AirportPickupForm';
import OrderTracker from './components/OrderTracker';
import Faqs from './components/Faqs';
import OMS from './components/OMS';
import { saveOrderToFirestore, fetchAllOrdersFromFirestore, fetchOrdersForUser, auth, onAuthStateChanged, logoutUser, currentUserHasStaffClaim } from './utils/firebase';
import { generateTrackingToken } from './utils/orderIds';
import { claimPendingOrdersFromLocalStorage } from './utils/orderClaim';
import PostBookingAuthModal from './components/PostBookingAuthModal';
import UserAuthModal from './components/UserAuthModal';
import AdminLoginModal from './components/AdminLoginModal';
import PaymentSuccessModal from './components/PaymentSuccessModal';

interface SafeServiceBoundaryProps {
  children: React.ReactNode;
  serviceKey: string;
  onReset: () => void;
}

class SafeServiceBoundary extends React.Component<SafeServiceBoundaryProps, { hasError: boolean }> {
  props!: SafeServiceBoundaryProps;
  state: { hasError: boolean } = { hasError: false };
  setState!: (state: { hasError: boolean }) => void;

  constructor(props: SafeServiceBoundaryProps) {
    super(props as any);
    this.props = props;
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error(`Service Error Caught [${this.props.serviceKey}]:`, error, errorInfo);
    try {
      localStorage.removeItem(`digivisa_${this.props.serviceKey}_draft`);
    } catch (e) {
      console.error('Failed to clear broken draft:', e);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-4 max-w-lg mx-auto shadow-xl">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-slate-900 text-lg">Khôi Phục Biểu Mẫu Dịch Vụ Mượt Mà</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Phát hiện dữ liệu nháp cũ không tương thích trên trình duyệt. Hệ thống đã tự động dọn dẹp để bạn nhập biểu mẫu hoàn toàn mượt mà.
          </p>
          <button
            onClick={() => {
              try {
                localStorage.removeItem(`digivisa_${this.props.serviceKey}_draft`);
              } catch (e) {}
              this.setState({ hasError: false });
              this.props.onReset();
            }}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            🔄 Tải Lại Form Mới
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [userRole, setUserRole] = useState<'customer' | 'staff'>('customer');

  const [activeTab, setActiveTab] = useState<'services' | 'tracker' | 'faqs' | 'oms'>('services');
  const [activeService, setActiveService] = useState<'visa' | 'fasttrack' | 'pickup' | null>(null);
  const [language, setLanguage] = useState<Language>(() => {
    const saved = safeStorage.getItem('digivisa_language');
    return (saved === 'VI' ? 'VI' : 'EN') as Language;
  });
  const currency: Currency = language === 'VI' ? 'VND' : 'USD';
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  const handleSetUserRole = (role: 'customer' | 'staff') => {
    setUserRole(role);
    safeStorage.setItem('digivisa_user_role', role);
    if (role === 'customer' && activeTab === 'oms') {
      setActiveTab('services');
    }
  };

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    safeStorage.setItem('digivisa_language', lang);
  };

  // Pristine empty state by default for production users, loads from local storage if existing
  const [orders, setOrders] = useState<Order[]>([]);

  const [isUserAuthOpen, setIsUserAuthOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ uid?: string; email?: string | null; displayName?: string | null } | null>(null);

  const [paymentSuccessState, setPaymentSuccessState] = useState<{
    isOpen: boolean;
    order: Order | null;
    transactionId: string;
  }>({ isOpen: false, order: null, transactionId: '' });

  // Firebase auth state listener — staff role only from custom claim, never localStorage
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser({ uid: user.uid, email: user.email, displayName: user.displayName });
        try {
          const token = await user.getIdTokenResult();
          if (token.claims.staff === true) {
            setUserRole('staff');
            safeStorage.setItem('digivisa_user_role', 'staff');
          } else {
            setUserRole('customer');
            safeStorage.setItem('digivisa_user_role', 'customer');
          }
        } catch {
          setUserRole('customer');
        }
      } else {
        setCurrentUser(null);
        setUserRole('customer');
        safeStorage.setItem('digivisa_user_role', 'customer');
      }
    });
    return () => unsubscribe();
  }, []);

  // Load orders specific to the currently logged in user
  useEffect(() => {
    const loadUserOrders = async () => {
      if (currentUser?.email || currentUser?.uid) {
        try {
          const userOrders = await fetchOrdersForUser(currentUser.uid || '', currentUser.email || undefined);
          if (userOrders) {
            setOrders(userOrders.map(sanitizeOrder));
          }
        } catch (e) {
          console.error("Error loading orders for user:", e);
        }
      }
    };
    if (userRole === 'customer') {
      loadUserOrders();
    }
  }, [currentUser, userRole]);

  const [postBookingOrder, setPostBookingOrder] = useState<Order | null>(null);
  /** Order ids queued for /api/order-claim after guest registers / signs in. */
  const [pendingClaimOrderIds, setPendingClaimOrderIds] = useState<string[]>([]);

  const runOrderClaimAfterAuth = async (preferIds?: string[]) => {
    try {
      const result = await claimPendingOrdersFromLocalStorage(preferIds);
      if (result.claimed.length > 0) {
        const uid = auth.currentUser?.uid || '';
        const email = auth.currentUser?.email || undefined;
        setOrders((prev) =>
          prev.map((o) =>
            result.claimed.includes(o.id)
              ? { ...o, userId: uid, userEmail: email || o.userEmail }
              : o
          )
        );
        if (uid) {
          const remote = await fetchOrdersForUser(uid);
          if (remote?.length) {
            const byId = new Map(remote.map((o: any) => [o.id, sanitizeOrder(o)]));
            setOrders((prev) => {
              const merged = new Map(prev.map((o) => [o.id, o]));
              byId.forEach((o, id) => merged.set(id, o));
              return Array.from(merged.values());
            });
          }
        }
        triggerToast(
          language === 'VI'
            ? `Đã gắn ${result.claimed.length} đơn vào tài khoản.`
            : `Linked ${result.claimed.length} order(s) to your account.`,
          'success'
        );
      }
      if (result.conflicts.length > 0) {
        triggerToast(
          language === 'VI'
            ? 'Một số đơn đã thuộc tài khoản khác — không thể nhận.'
            : 'Some orders already belong to another account — not claimed.',
          'error'
        );
      }
    } catch (e) {
      console.error('[order-claim] client', e);
    }
  };

  // Staff modal already verified Firebase claim staff:true before calling this
  const handleAdminSuccess = async () => {
    const isStaff = await currentUserHasStaffClaim();
    if (!isStaff) {
      triggerToast(
        language === 'VI' ? 'Thiếu claim staff — không mở OMS.' : 'Missing staff claim — OMS denied.',
        'error'
      );
      setIsAdminLoginOpen(false);
      return;
    }
    setUserRole('staff');
    safeStorage.setItem('digivisa_user_role', 'staff');
    setActiveTab('oms');
    setIsAdminLoginOpen(false);
    try {
      const remoteOrders = await fetchAllOrdersFromFirestore();
      if (remoteOrders && remoteOrders.length > 0) {
        setOrders(remoteOrders.map(sanitizeOrder));
      }
    } catch (e) {
      console.error("Firestore sync error", e);
    }
    triggerToast(language === 'VI' ? 'Đăng nhập Staff thành công!' : 'Staff logged in successfully!', 'success');
  };

  // Hash route listener for secret admin URL: /#/verynoice -> Pops up password prompt or opens OMS tab
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash === '#/verynoice' || hash === '#verynoice') {
        const savedRole = safeStorage.getItem('digivisa_user_role');
        if (userRole === 'staff' || savedRole === 'staff') {
          setActiveTab('oms');
        } else {
          setIsAdminLoginOpen(true);
        }
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [userRole]);

  // Check if we are in local development mode or if a query parameter ?demo=true is present
  const isDemoMode = (typeof window !== 'undefined' && (
    window.location.hostname.includes('localhost') || 
    window.location.hostname.includes('127.0.0.1') ||
    window.location.search.includes('demo=true')
  ));

  // Helper to sanitize any legacy TSN references and missing order properties
  const sanitizeOrder = (o: any): Order => {
    if (!o) return { id: 'DV-UNKNOWN', type: 'Visa', status: 'Pending', createdAt: '', paymentStatus: 'Pending', details: {} as any };
    const id = o.id || o.orderId || o.docId || 'DV-UNKNOWN';
    const type = o.type || 'Visa';
    const status = o.status || 'Pending';
    const paymentStatus = o.paymentStatus || 'Pending';
    const createdAt = o.createdAt || '';
    const details = { ...(o.details || {}) } as any;

    if (typeof details.airport === 'string') {
      details.airport = details.airport.replace(/TSN/g, 'SGN');
    }
    if (typeof details.pickupAddress === 'string') {
      details.pickupAddress = details.pickupAddress.replace(/TSN/g, 'SGN');
    }
    if (typeof details.destinationAddress === 'string') {
      details.destinationAddress = details.destinationAddress.replace(/TSN/g, 'SGN');
    }
    return { ...o, id, type, status, paymentStatus, createdAt, details };
  };

  // Load orders from localStorage if any, filtering out any old default mock records
  useEffect(() => {
    const saved = safeStorage.getItem('digivisa_orders');
    if (saved && saved !== 'undefined') {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Sanitize TSN -> SGN and filter out old default mock orders
          const sanitized = parsed.map(sanitizeOrder);
          const filtered = sanitized.filter(o => 
            o.id !== 'DV-774910' && 
            o.id !== 'DV-FT4015' && 
            o.id !== 'DV-PICK-33880'
          );
          
          setOrders(filtered);
          safeStorage.setItem('digivisa_orders', JSON.stringify(filtered));
        }
      } catch (e) {
        console.error("Localstorage orders parse error", e);
      }
    }
  }, []);

  // Sync html class and lang attribute based on selected language
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      if (language === 'VI') {
        html.classList.add('lang-vi');
        html.setAttribute('lang', 'vi');
      } else {
        html.classList.remove('lang-vi');
        html.setAttribute('lang', 'en');
      }
    }
  }, [language]);

  // Sync state to local storage when state changes
  const saveOrders = (updatedOrdersOrFn: Order[] | ((prev: Order[]) => Order[])) => {
    setOrders((prev) => {
      const rawNext = typeof updatedOrdersOrFn === 'function' ? updatedOrdersOrFn(prev) : updatedOrdersOrFn;
      const next = rawNext.map(sanitizeOrder);
      safeStorage.setItem('digivisa_orders', JSON.stringify(next));
      return next;
    });
  };

  // Pre-seed demo data handler
  const loadDemoData = () => {
    const defaultMockOrders: Order[] = [
      {
        id: 'DV-774910',
        type: 'Visa',
        status: 'Agency Review',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        paymentStatus: 'Paid (9Pay)',
        details: {
          firstName: 'Eleanor',
          lastName: 'Vance',
          passportNumber: 'US8743012',
          passportExpiry: '2031-10-15',
          nationality: 'United States',
          dateOfBirth: '1992-04-12',
          arrivalDate: getTodayStr(),
          email: 'eleanor.vance@gmail.com',
          phone: '+15557001200',
          visaType: 'Tourist (30 Days)',
          processingSpeed: 'Standard',
          passportScan: 'passport_scan_vance.jpg',
          photoScan: 'photo_biometric.png',
          totalFee: 120,
        } as any,
      },
      {
        id: 'DV-FT4015',
        type: 'FastTrack',
        status: 'Staff Assigned',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        paymentStatus: 'Paid (Bank Transfer)',
        details: {
          airlineName: 'Singapore Airlines',
          flightNumber: 'SQ308',
          arrivalDate: getTodayStr(),
          arrivalTime: '11:45',
          numberOfPassengers: 1,
          packageType: 'Fast Track Standard',
          contactName: 'Eleanor Vance',
          contactEmail: 'eleanor.vance@gmail.com',
          contactPhone: '+15557001200',
          specialRequests: 'Passenger requires wheelchair setup at aerobridge gate.',
          totalFee: 78.75,
        } as any,
      },
      {
        id: 'DV-PICK-33880',
        type: 'AirportPickup',
        status: 'Staff Assigned',
        createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
        paymentStatus: 'Paid (Bank Transfer)',
        staffName: 'Mr. Minh Quan (VIP Chauffeur Partner)',
        staffPhone: '+84912345678',
        licensePlate: '30A - 888.88',
        details: {
          pickupDate: getTodayOffsetStr(1),
          pickupTime: '20:45',
          flightNumber: 'VJ-123',
          airlineName: 'VietJet Air',
          destinationAddress: 'Sheraton Saigon Hotel, District 1, HCMC',
          pickupAddress: 'Noi Bai Airport T2',
          direction: 'Arrival',
          vehicleType: '7 seats',
          passengerName: 'Olivia Taylor',
          passengerPhone: '+61292843000',
          passengerEmail: 'olivia.taylor@melbournetourism.com.au',
          luggageCount: 4,
          terminalNumber: 'Terminal 2 International',
          totalFee: 24.0,
          addFastTrack: false,
          paymentMethod: 'bank_transfer',
          wantsInvoice: true,
        } as any,
      },
    ];
    saveOrders(defaultMockOrders);
    triggerToast("Demo orders seeded successfully! Switch tabs to explore tracking and OMS.", "success");
  };

  // Clear all data handler
  const clearAllOrders = () => {
    saveOrders([]);
    triggerToast("All applications cleared! Pristine production view activated.", "info");
  };

  // Toast notification helper
  const triggerToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const getConvertedPrice = (usdAmount: any) => {
    const val = typeof usdAmount === 'number' ? usdAmount : (parseFloat(usdAmount) || 0);
    return formatConvertedPrice(val, currency);
  };

  const applyPaidOrderLocally = (
    orderId: string,
    transactionId: string,
    opts?: { showSuccessModal?: boolean }
  ) => {
    const showSuccessModal = opts?.showSuccessModal !== false;
    const storedOrdersRaw = safeStorage.getItem('digivisa_orders') || '[]';
    let storedOrders: Order[] = [];
    try { storedOrders = JSON.parse(storedOrdersRaw); } catch { /* ignore */ }

    const foundOrder = storedOrders.find((o) => o.id === orderId) || orders.find((o) => o.id === orderId);
    if (!foundOrder) {
      triggerToast(
        language === 'VI'
          ? `Thanh toán xác nhận cho ${orderId}, đang đồng bộ đơn hàng…`
          : `Payment confirmed for ${orderId}, syncing order…`,
        'success'
      );
      return;
    }

    const updatedOrder: Order = {
      ...foundOrder,
      paymentStatus: 'Paid (9Pay)',
      status: 'Agency Review',
      ninepayPaymentNo: transactionId || foundOrder.ninepayPaymentNo,
    };

    // Local UX only — Firestore Paid is written solely by /api/9pay-verify (Inquire).
    saveOrders((prev) => {
      const base = prev.some((o) => o.id === orderId) ? prev : storedOrders;
      const merged = base.some((o) => o.id === orderId) ? base : [updatedOrder, ...base];
      return merged.map((o) => (o.id === orderId ? updatedOrder : o));
    });

    if (showSuccessModal) {
      safeStorage.removeItem('digivisa_visa_draft');
      safeStorage.removeItem('digivisa_fasttrack_draft');
      safeStorage.removeItem('digivisa_airport_pickup_draft');
      setActiveService(null);
      setPaymentSuccessState({
        isOpen: true,
        order: updatedOrder,
        transactionId: transactionId || updatedOrder.ninepayPaymentNo || orderId,
      });
    }

    triggerToast(
      language === 'VI'
        ? `Thanh toán 9Pay đơn hàng ${orderId} thành công!`
        : `9Pay payment for order ${orderId} confirmed!`,
      'success'
    );
  };

  // return_url is UX-only: never trust query params to set Paid. Inquire decides.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Sandbox discovery: log whatever 9Pay actually appends on return.
    console.log('[DigiVisa 9Pay return_url] window.location.search =', window.location.search);

    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const orderId = urlParams.get('orderId');

    // Informational only — if result/checksum ever appear, inquire remains authoritative.
    if (urlParams.get('result') || urlParams.get('checksum')) {
      console.log('[DigiVisa 9Pay return_url] observed result/checksum params (ignored for Paid; inquire decides)', {
        hasResult: !!urlParams.get('result'),
        hasChecksum: !!urlParams.get('checksum'),
      });
    }

    const cleanUrl = () => {
      window.history.replaceState({}, document.title, window.location.pathname);
    };

    if (paymentStatus === 'cancel' && orderId) {
      cleanUrl();
      triggerToast(
        language === 'VI'
          ? `Đơn hàng ${orderId} chưa hoàn tất thanh toán. Dữ liệu của bạn vẫn được giữ nguyên.`
          : `Payment for order ${orderId} was cancelled. Your order remains unpaid.`,
        'info'
      );
      return;
    }

    // ?payment=success is only a UX signal to inquire — never trust URL params for Paid.
    // Hand-typed success URLs without a real 9Pay payment stay Unpaid.
    if (paymentStatus === 'success' && orderId) {
      let cancelled = false;
      setIsVerifyingPayment(true);

      (async () => {
        try {
          const data = await verifyOrderPayment(orderId, { force: true });
          if (cancelled) return;
          cleanUrl();

          if (data.isPaid) {
            applyPaidOrderLocally(orderId, data.payment_no || '', { showSuccessModal: true });
          } else {
            triggerToast(
              language === 'VI'
                ? `Chưa xác nhận được thanh toán cho ${orderId}. Đơn vẫn chưa thanh toán.`
                : `Payment for ${orderId} not confirmed yet. Order remains unpaid.`,
              'info'
            );
          }
        } catch {
          if (cancelled) return;
          cleanUrl();
          triggerToast(
            language === 'VI'
              ? 'Không kết nối được máy chủ xác nhận thanh toán. Đơn vẫn chưa thanh toán.'
              : 'Could not reach payment verification server. Order remains unpaid.',
            'error'
          );
        } finally {
          if (!cancelled) setIsVerifyingPayment(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }
  }, []);

  // Backstop: when opening Tracker or OMS, re-inquire recent unpaid orders (debounced).
  useEffect(() => {
    if (activeTab !== 'tracker' && activeTab !== 'oms') return;
    if (!orders.length) return;

    let cancelled = false;
    (async () => {
      const paid = await syncUnpaidOrdersViaInquire(orders);
      if (cancelled || !paid.length) return;
      for (const result of paid) {
        applyPaidOrderLocally(result.orderId, result.payment_no || '', { showSuccessModal: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, orders]);

  // Submit Callbacks
  const handleBookingSuccess = async (newOrder: Order) => {
    try {
      console.log('[DigiVisa 9Pay] Order Creation Triggered:', newOrder.id);
      const amountVnd = resolveOrderAmountVnd(newOrder);

      if (amountVnd < NINEPAY_MIN_AMOUNT_VND) {
        triggerToast(
          language === 'VI'
            ? `Số tiền ${amountVnd.toLocaleString('vi-VN')}₫ dưới mức tối thiểu 9Pay (${NINEPAY_MIN_AMOUNT_VND.toLocaleString('vi-VN')}₫). Đơn giữ Unpaid.`
            : `Amount ${amountVnd} VND is below 9Pay minimum (${NINEPAY_MIN_AMOUNT_VND} VND). Order kept unpaid.`,
          'error'
        );
        const unpaid: Order = {
          ...newOrder,
          amountVnd,
          trackingToken: newOrder.trackingToken || generateTrackingToken(),
          userId: currentUser?.uid || (newOrder as any).userId,
          userEmail: currentUser?.email || (newOrder as any).userEmail || (newOrder.details as any)?.email,
          paymentStatus: 'Pending',
        };
        if (!currentUser?.uid) {
          delete (unpaid as any).userId;
        }
        saveOrders([unpaid, ...orders]);
        try {
          if (unpaid.trackingToken) safeStorage.setItem(`digivisa_track_${unpaid.id}`, unpaid.trackingToken);
        } catch { /* ignore */ }
        saveOrderToFirestore(unpaid)
          .then((saveRes) => {
            if (saveRes && !saveRes.success) {
              console.error('Firestore save failed (guest flow):', saveRes.error);
              triggerToast(
                language === 'VI'
                  ? `Đơn ${unpaid.id} chưa lưu được lên máy chủ. Vui lòng chụp màn hình mã theo dõi trước khi thanh toán.`
                  : `Order ${unpaid.id} could not be saved to the server. Please screenshot your tracking token before paying.`,
                'error'
              );
            }
          })
          .catch((err) => {
            console.error('Firestore sync background err:', err);
            triggerToast(
              language === 'VI'
                ? `Đơn ${unpaid.id} chưa lưu được lên máy chủ. Vui lòng chụp màn hình mã theo dõi trước khi thanh toán.`
                : `Order ${unpaid.id} could not be saved to the server. Please screenshot your tracking token before paying.`,
              'error'
            );
          });
        return;
      }

      const trackingToken = newOrder.trackingToken || generateTrackingToken();
      const orderWithUser: Order = {
        ...newOrder,
        amountVnd,
        trackingToken,
        userId: currentUser?.uid || (newOrder as any).userId,
        userEmail: currentUser?.email || (newOrder as any).userEmail || (newOrder.details as any)?.email,
        paymentStatus: 'Pending',
      };
      // Drop forged userId when guest (rules reject create with foreign userId)
      if (!currentUser?.uid) {
        delete (orderWithUser as any).userId;
      }
      saveOrders([orderWithUser, ...orders]);
      try {
        safeStorage.setItem(`digivisa_track_${orderWithUser.id}`, trackingToken);
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(trackingToken).catch(() => {});
        }
      } catch { /* ignore */ }
      const saveRes = await saveOrderToFirestore(orderWithUser);
      if (saveRes && !saveRes.success) {
        console.error('Firestore save failed (9Pay flow):', saveRes.error);
        triggerToast(
          language === 'VI'
            ? `Đơn ${orderWithUser.id} chưa lưu được lên máy chủ. Vui lòng chụp màn hình mã theo dõi trước khi thanh toán.`
            : `Order ${orderWithUser.id} could not be saved to the server. Please screenshot your tracking token before paying.`,
          'error'
        );
      }
      setPostBookingOrder(null);

      triggerToast(
        language === 'VI'
          ? `Đơn ${orderWithUser.id} tạo OK. Mã theo dõi đã copy — dán vào Tracker nếu cần. Đang sang 9Pay...`
          : `Order ${orderWithUser.id} created. Tracking token copied — paste into Tracker if needed. Opening 9Pay...`,
        'success'
      );

      const res = await fetch('/api/9pay-create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderWithUser.id,
          amountVnd,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        paymentUrl?: string;
        error?: string;
      };

      if (res.ok && data.success && data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      triggerToast(
        language === 'VI'
          ? `Không tạo được liên kết 9Pay: ${data.error || res.statusText}. Đơn ${orderWithUser.id} vẫn chưa thanh toán.`
          : `Failed to create 9Pay link: ${data.error || res.statusText}. Order ${orderWithUser.id} remains unpaid.`,
        'error'
      );
    } catch (e) {
      console.error('[DigiVisa 9Pay] handleBookingSuccess execution error:', e);
      triggerToast(
        language === 'VI'
          ? `Lỗi khởi tạo thanh toán: ${e instanceof Error ? e.message : String(e)}. Đơn vẫn chưa thanh toán.`
          : `Payment init error: ${e instanceof Error ? e.message : String(e)}. Order remains unpaid.`,
        'error'
      );
    }
  };

  return (
    <div className={`min-h-screen bg-[#F8FAFC] flex flex-col font-sans antialiased text-slate-800 ${language === 'VI' ? 'lang-vi' : ''}`} id="applet-viewport">
      
      {/* Toast alert banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-lg"
          >
            <div className={`p-4 rounded-2xl shadow-xl flex items-start space-x-3 text-white border ${
              toastType === 'success'
                ? 'bg-emerald-950 border-emerald-500/30'
                : toastType === 'error'
                  ? 'bg-rose-950 border-rose-500/30'
                  : 'bg-indigo-950 border-indigo-500/30'
            }`}>
              <div className={`p-1.5 rounded-lg ${
                toastType === 'success'
                  ? 'bg-emerald-500 text-slate-950'
                  : toastType === 'error'
                    ? 'bg-rose-500 text-white'
                    : 'bg-indigo-500 text-white'
              }`}>
                <BellRing className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className={`text-xs font-bold font-sans uppercase tracking-widest mb-0.5 ${
                  toastType === 'error' ? 'text-rose-400' : 'text-[#10B981]'
                }`}>Notification dispatch</p>
                <p className="text-xs text-slate-200">{toastMessage}</p>
              </div>
              <button 
                onClick={() => setToastMessage(null)}
                className="text-slate-400 hover:text-white text-xs font-mono px-1 select-none"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setActiveService(null); // return to sublist
        }}
        orderCount={orders.length}
        userRole={userRole}
        setUserRole={handleSetUserRole}
        language={language}
        setLanguage={handleSetLanguage}
        currentUser={currentUser}
        onOpenUserAuth={() => setIsUserAuthOpen(true)}
        onOpenAdminAuth={() => setIsAdminLoginOpen(true)}
        onLogout={async () => {
          await logoutUser();
          setCurrentUser(null);
          triggerToast(language === 'VI' ? 'Đã đăng xuất!' : 'Logged out successfully!', 'info');
        }}
      />

      {/* Main Container */}
      <main className="flex-1 py-8 sm:py-12 bg-gradient-to-b from-teal-500/[0.02] to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Sandbox Demo Seeding Banner - only visible in Dev or with ?demo=true query parameter */}
          {isDemoMode && orders.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl border border-indigo-500/20 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div className="flex items-center space-x-3.5 text-center sm:text-left">
                <span className="px-2.5 py-1 bg-indigo-500 text-slate-950 rounded-lg text-[10px] font-black tracking-wider uppercase shrink-0 select-none">
                  DEMO WORKSPACE
                </span>
                <div>
                  <p className="text-xs font-bold text-white">Pristine Production Environment Active</p>
                  <p className="text-[11px] text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                    The Order Tracker & Staff OMS views are currently empty. Click "Load Demo Data" to instantly seed 3 high-fidelity records, enabling flight landing alerts, VIP chauffeur dispatches, and secure communications.
                  </p>
                </div>
              </div>
              <button
                onClick={loadDemoData}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 text-xs font-bold rounded-xl shadow-md shadow-teal-500/10 transition-all duration-200 cursor-pointer transform active:scale-95 shrink-0"
              >
                ✨ Load Demo Data
              </button>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            
            {/* TAB 1: Services & Hub */}
            {activeTab === 'services' && (
              <motion.div
                key="services"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-12"
              >
                {!activeService ? (
                  // LANDING HERO & THE 3 SERVICES CARDS
                  <div className="space-y-10 animate-fade-in">
                    
                    {/* Hero Branding Showcase */}
                    <div className="py-10 sm:py-16 text-center max-w-3xl mx-auto space-y-4">
                      <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-widest rounded-full mb-2">
                        {language === 'EN' ? 'Simplifying Global Mobility' : 'Đơn giản hóa hành trình quốc tế'}
                      </span>
                      <h1 className="font-display font-extrabold text-slate-900 text-3.5xl sm:text-5xl tracking-tight leading-tight">
                        {language === 'EN' ? (
                          <>Your journey begins <span className="text-indigo-600">seamlessly.</span></>
                        ) : (
                          <>Hành trình của bạn bắt đầu <span className="text-indigo-600">suôn sẻ.</span></>
                        )}
                      </h1>
                      <p className="text-slate-500 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                        {language === 'EN'
                          ? 'Expert visa processing, fast-track arrival services, and premium airport logistics consolidated into one intelligent platform.'
                          : 'Hỗ trợ cấp visa chuyên nghiệp, dịch vụ nhập cảnh nhanh và xe đón tiễn sân bay cao cấp được hợp nhất trên một nền tảng thông minh.'}
                      </p>
                      
                      {/* Interactive Trust Indicators */}
                      <div className="flex flex-wrap items-center justify-center gap-3 pt-4 text-xs font-medium text-slate-500">
                        <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full">
                          <ShieldCheck className="h-4 w-4 text-indigo-600" />
                          <span>{language === 'EN' ? '100% Authorized Portal' : 'Cổng thông tin ủy quyền 100%'}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full">
                          <Clock className="h-4 w-4 text-indigo-600" />
                          <span>{language === 'EN' ? '4-Hour Rush Processing Available' : 'Xử lý Khẩn cấp trong 4 Giờ'}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full">
                          <ShieldCheck className="h-4 w-4 text-indigo-500" />
                          <span>{language === 'EN' ? 'AES-256 Encrypted Vault' : 'Mã hóa Bảo mật AES-256'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Services section */}
                    <div className="space-y-6">
                      <div className="text-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748B] block mb-1">{TRANSLATIONS[language].serviceOptions}</span>
                        <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900">{TRANSLATIONS[language].immigrationArrivalGateways}</h2>
                      </div>

                      {/* Required 3 SPECIFIC SERVICES: Visa Application, Fast Track (most used), Airport Pickup */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8" id="three-services-bento-grid">
                        
                        {/* Service 1: Visa Application */}
                        <div 
                          className="group bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                          id="service-card-visa"
                        >
                          <div>
                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-50 transition-colors">
                              <FileText className="w-6 h-6 text-slate-600 group-hover:text-indigo-600 transition-colors" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold font-display text-slate-900 mb-2">{TRANSLATIONS[language].visaApplication}</h3>
                            <p className="text-slate-500 text-xs leading-relaxed mb-5">
                              {TRANSLATIONS[language].visaBentoDesc}
                            </p>
                            <ul className="space-y-2 mb-6">
                              <li className="flex items-center text-xs text-slate-600">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-2"></span>
                                {TRANSLATIONS[language].touristBusinessClasses}
                              </li>
                              <li className="flex items-center text-xs text-slate-600">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-2"></span>
                                {TRANSLATIONS[language].guaranteedEntryCodes}
                              </li>
                            </ul>
                          </div>

                          <div className="pt-5 border-t border-slate-100 flex items-center justify-between mt-6">
                            <div>
                              <span className="text-[9px] text-[#94A3B8] uppercase block font-bold">{TRANSLATIONS[language].standardRates}</span>
                              <span className="font-display font-extrabold text-slate-900 text-sm tracking-tight">
                                from {getConvertedPrice(66)}
                              </span>
                            </div>
                            <button
                              onClick={() => setActiveService('visa')}
                              id="btn-apply-visa"
                              className="px-4 py-2 border border-slate-200 hover:border-indigo-500 bg-white hover:bg-indigo-50 text-indigo-600 font-bold rounded-xl text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm group-hover:border-indigo-500 group-hover:bg-indigo-600 group-hover:text-white"
                            >
                              <span>{TRANSLATIONS[language].applyNow}</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Service 2: Fast Track (Most Selected highlighted prominently) */}
                        <div 
                          className="relative bg-slate-900 text-white rounded-3xl border border-slate-800 p-6 sm:p-8 hover:border-indigo-550/30 shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between overflow-hidden"
                          id="service-card-fasttrack"
                        >
                          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-widest whitespace-nowrap shadow-md">
                            {TRANSLATIONS[language].mostSelected}
                          </div>

                          <div className="space-y-4">
                            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-2">
                              <Sparkles className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div className="space-y-1">
                              <h3 className="font-display font-bold text-white text-lg sm:text-xl">{TRANSLATIONS[language].vipFastTrack}</h3>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                {TRANSLATIONS[language].fastTrackBentoDesc}
                              </p>
                            </div>

                            <div className="bg-white/10 p-4 rounded-2xl mb-6">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">{TRANSLATIONS[language].avgClearanceTime}</span>
                                <span className="text-xs text-white font-mono font-bold">{TRANSLATIONS[language].avgClearanceValue}</span>
                              </div>
                              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-indigo-500 h-full w-4/5 rounded-full"></div>
                              </div>
                            </div>
                          </div>

                          <div className="pt-6 border-t border-slate-800 flex items-center justify-between mt-6">
                            <div>
                              <span className="text-[9px] text-[#94A3B8] uppercase block font-bold">{TRANSLATIONS[language].vipUpgradePrice}</span>
                              <span className="font-display font-extrabold text-[#F1F5F9] text-sm">
                                from {getConvertedPrice(45)}
                              </span>
                            </div>
                            <button
                              onClick={() => setActiveService('fasttrack')}
                              id="btn-book-fasttrack"
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition-colors flex items-center space-x-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
                            >
                              <span>{TRANSLATIONS[language].skipLines}</span>
                              <ChevronRight className="h-3.5 w-3.5 text-white" />
                            </button>
                          </div>
                        </div>

                        {/* Service 3: Airport Pickup */}
                        <div 
                          className="group bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 hover:border-indigo-500/60 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                          id="service-card-pickup"
                        >
                          <div>
                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-50 transition-colors">
                              <MapPin className="h-6 w-6 text-slate-700 group-hover:text-indigo-600 transition-colors" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold font-display text-slate-900 mb-2">{TRANSLATIONS[language].airportTransfer}</h3>
                            <p className="text-slate-500 text-xs leading-relaxed mb-5">
                              {TRANSLATIONS[language].pickupBentoDesc}
                            </p>
                            <ul className="space-y-2 mb-6">
                              <li className="flex items-center text-xs text-slate-600">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-2"></span>
                                {TRANSLATIONS[language].compWaitTime}
                              </li>
                              <li className="flex items-center text-xs text-slate-600">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-2"></span>
                                {TRANSLATIONS[language].luxuryFleet}
                              </li>
                            </ul>
                          </div>

                          <div className="pt-6 border-t border-slate-100 flex items-center justify-between mt-6">
                            <div>
                              <span className="text-[9px] text-[#94A3B8] uppercase block font-bold">{TRANSLATIONS[language].chauffeurRates}</span>
                              <span className="font-display font-extrabold text-slate-900 text-sm">
                                from {getConvertedPrice(27)}
                              </span>
                            </div>
                            <button
                              onClick={() => setActiveService('pickup')}
                              id="btn-book-pickup"
                              className="px-4 py-2 border border-slate-200 hover:border-indigo-500 bg-white hover:bg-indigo-50 text-indigo-600 font-bold rounded-xl text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm group-hover:border-indigo-500 group-hover:bg-indigo-600 group-hover:text-white"
                            >
                              <span>{TRANSLATIONS[language].bookShuttle}</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Security Seals Trust badges row */}
                    <div className="bg-slate-50 border border-slate-200/50 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="space-y-1 text-center sm:text-left">
                        <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-widest block bg-indigo-50 px-2.5 py-0.5 rounded-full w-fit">
                          Authorized Secure Clearing Standards
                        </span>
                        <h4 className="text-sm font-bold text-slate-950">Are you a tourism operator or travel manager?</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Connect our automated flight clearing APIs to submit bulk group e-visas directly from passenger manifest logs.
                        </p>
                      </div>
                      <div className="flex items-center space-x-4 shrink-0 justify-center">
                        <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col items-center justify-center font-bold text-[10px] text-zinc-600 shadow-sm w-24">
                          <Award className="h-4.5 w-4.5 text-indigo-600 mb-1" />
                          <span>ISO 27001</span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col items-center justify-center font-bold text-[10px] text-zinc-600 shadow-sm w-24">
                          <PhoneCall className="h-4.5 w-4.5 text-indigo-600 mb-1" />
                          <span>24/7 Desk Help</span>
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  // INDIVIDUAL DETAILED SERVICE STEP FORMS
                  <div>
                    {activeService === 'visa' && (
                      <VisaForm
                        currency={currency}
                        onSuccess={handleBookingSuccess}
                        onCancel={() => setActiveService(null)}
                        language={language}
                      />
                    )}
                    {activeService === 'fasttrack' && (
                      <FastTrackForm
                        currency={currency}
                        onSuccess={handleBookingSuccess}
                        onCancel={() => setActiveService(null)}
                        language={language}
                      />
                    )}
                    {activeService === 'pickup' && (
                      <AirportPickupForm
                        currency={currency}
                        onSuccess={handleBookingSuccess}
                        onCancel={() => setActiveService(null)}
                        language={language}
                      />
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 2: Tracker queue panel */}
            {activeTab === 'tracker' && (
              <motion.div
                key="tracker"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <OrderTracker
                  orders={orders}
                  setOrders={saveOrders}
                  currency={currency}
                  onNavigateToServices={() => {
                    setActiveTab('services');
                    setActiveService(null);
                  }}
                  onLoadDemoData={isDemoMode ? loadDemoData : undefined}
                  onClearAllOrders={clearAllOrders}
                  language={language}
                  currentUser={currentUser}
                  userRole={userRole}
                />
              </motion.div>
            )}

            {/* TAB 3: FAQ / Help Center */}
            {activeTab === 'faqs' && (
              <motion.div
                key="faqs"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <Faqs language={language} />
              </motion.div>
            )}

            {/* TAB 4: Order Management System (OMS) */}
            {activeTab === 'oms' && (
              <motion.div
                key="oms"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <OMS
                  orders={orders}
                  setOrders={saveOrders}
                  currency={currency}
                  language={language}
                />
              </motion.div>
            )}

          </AnimatePresence>

        </div>
      </main>

      {/* Footer layout */}
      <Footer language={language} />

      {/* Post-booking Auth prompt modal for Guest Users */}
      <PostBookingAuthModal
        isOpen={!!postBookingOrder && !currentUser}
        order={postBookingOrder}
        onCloseAsGuest={() => setPostBookingOrder(null)}
        onOpenAuth={() => {
          if (postBookingOrder?.id) {
            setPendingClaimOrderIds((prev) =>
              prev.includes(postBookingOrder.id) ? prev : [...prev, postBookingOrder.id]
            );
          }
          setPostBookingOrder(null);
          setIsUserAuthOpen(true);
        }}
        language={language}
      />

      {/* User Customer Auth Modal */}
      <UserAuthModal
        isOpen={isUserAuthOpen}
        onClose={() => setIsUserAuthOpen(false)}
        onSuccess={async (userData) => {
          setCurrentUser(userData);
          setIsUserAuthOpen(false);
          triggerToast(language === 'VI' ? 'Đăng nhập thành công!' : 'Logged in successfully!', 'success');
          const prefer = [...pendingClaimOrderIds];
          setPendingClaimOrderIds([]);
          await runOrderClaimAfterAuth(prefer.length ? prefer : undefined);
        }}
        language={language}
      />

      {/* Admin Password Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccess={handleAdminSuccess}
        language={language}
      />

      {/* Server-side payment verification after 9Pay return_url */}
      <AnimatePresence>
        {isVerifyingPayment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl px-6 py-5 shadow-xl flex items-center gap-3 max-w-sm w-full">
              <RefreshCw className="h-5 w-5 animate-spin text-indigo-600 shrink-0" />
              <p className="text-sm font-semibold text-slate-800">
                {language === 'VI' ? 'Đang xác nhận thanh toán…' : 'Confirming payment…'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Electronic Receipt & Payment Success Modal */}
      <PaymentSuccessModal
        isOpen={paymentSuccessState.isOpen}
        onClose={() => setPaymentSuccessState(prev => ({ ...prev, isOpen: false }))}
        order={paymentSuccessState.order}
        transactionId={paymentSuccessState.transactionId}
        onTrackOrder={() => {
          setPaymentSuccessState(prev => ({ ...prev, isOpen: false }));
          setActiveTab('tracker');
        }}
        language={language}
      />
    </div>
  );
}
