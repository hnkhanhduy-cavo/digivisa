import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plane, Sparkles, CheckCircle, ShieldCheck, Compass, HelpCircle, 
  MapPin, Clock, Star, MessageSquare, ExternalLink, RefreshCw, 
  Search, ShieldAlert, Award, FileText, ChevronRight, BellRing, PhoneCall
} from 'lucide-react';

import { Order, Currency, CURRENCY_SYMBOLS } from './types';
import { safeStorage, ordersStorageKey } from './utils/storage';
import { Language, TRANSLATIONS } from './utils/translations';
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
import { fetchOrdersForUser, fetchAllOrdersFromFirestore, saveOrderToFirestore, updateOrderFields, subscribeAllOrders, subscribeOrdersForUser, auth, onAuthStateChanged, logoutUser, currentUserHasStaffClaim } from './utils/firebase';
import { generateOrderId, generateTrackingToken } from './utils/orderIds';
import PostBookingAuthModal from './components/PostBookingAuthModal';
import UserAuthModal from './components/UserAuthModal';
import AdminLoginModal from './components/AdminLoginModal';
import PaymentSuccessModal from './components/PaymentSuccessModal';
import PaymentFailedModal from './components/PaymentFailedModal';

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

  const [orders, setOrders] = useState<Order[]>([]);
  const ordersRef = useRef<Order[]>(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const languageRef = useRef<Language>(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const [isUserAuthOpen, setIsUserAuthOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ uid?: string; email?: string | null; displayName?: string | null } | null>(null);

  const [paymentSuccessState, setPaymentSuccessState] = useState<{
    isOpen: boolean;
    order: Order | null;
    transactionId: string;
  }>({ isOpen: false, order: null, transactionId: '' });

  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);
  const [paymentFailedState, setPaymentFailedState] = useState<{
    isOpen: boolean;
    orderId: string | null;
    reason: 'cancelled' | 'unconfirmed' | 'error';
  }>({ isOpen: false, orderId: null, reason: 'unconfirmed' });

  const prevUidRef = useRef<string | null>(null);
  const prevRoleRef = useRef<'customer' | 'staff'>(userRole);

  useEffect(() => {
    if (prevRoleRef.current === 'staff' && userRole === 'customer') {
      setOrders([]);
    }
    prevRoleRef.current = userRole;
  }, [userRole]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (prevUidRef.current && prevUidRef.current !== user.uid) {
          setOrders([]);
        }
        prevUidRef.current = user.uid;

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
        prevUidRef.current = null;
        setCurrentUser(null);
        setUserRole('customer');
        setOrders([]);
        safeStorage.setItem('digivisa_user_role', 'customer');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubSubscription: (() => void) | null = null;
    let isFirstSnapshot = true;

    if (safeStorage.getItem('digivisa_orders')) {
      safeStorage.removeItem('digivisa_orders');
    }

    const uid = currentUser?.uid;
    const key = ordersStorageKey(uid);
    const saved = safeStorage.getItem(key);
    if (saved && saved !== 'undefined') {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const sanitized = parsed.map(sanitizeOrder);
          const filtered = sanitized.filter(o => 
            o.id !== 'DV-774910' && 
            o.id !== 'DV-FT4015' && 
            o.id !== 'DV-PICK-33880'
          );
          if (!cancelled) setOrders(filtered);
        }
      } catch (e) {
        console.error("Localstorage orders parse error", e);
      }
    } else {
      if (!uid && !cancelled) {
        setOrders([]);
      }
    }

    const handleNewServerOrders = (serverOrders: any[]) => {
      if (cancelled) return;
      if (!serverOrders) return;

      const sanitized = serverOrders.map(sanitizeOrder);

      // Compare 5 fields with current memory orders if not first snapshot
      if (!isFirstSnapshot) {
        const currentOrders = ordersRef.current || [];
        const currentMap = new Map(currentOrders.map(o => [o.id, o]));
        const isEn = languageRef.current === 'EN';

        const formatVal = (val: any) => {
          if (val === null || val === undefined || String(val).trim() === '') {
            return isEn ? '(cleared)' : '(xoá)';
          }
          return String(val);
        };

        interface FieldChange {
          label: string;
          oldVal: string;
          newVal: string;
        }

        interface ChangedOrder {
          id: string;
          lastUpdatedBy?: string;
          changes: FieldChange[];
        }

        const changedOrders: ChangedOrder[] = [];

        sanitized.forEach(newOrder => {
          const existing = currentMap.get(newOrder.id);
          if (existing) {
            const exAny = existing as any;
            const newAny = newOrder as any;
            const changes: FieldChange[] = [];

            if (exAny.status !== newAny.status) {
              changes.push({
                label: isEn ? 'Status' : 'Trạng thái',
                oldVal: formatVal(exAny.status),
                newVal: formatVal(newAny.status),
              });
            }

            if (exAny.subStatus !== newAny.subStatus) {
              changes.push({
                label: isEn ? 'Sub-status' : 'Trạng thái chi tiết',
                oldVal: formatVal(exAny.subStatus),
                newVal: formatVal(newAny.subStatus),
              });
            }

            if (exAny.paymentStatus !== newAny.paymentStatus) {
              changes.push({
                label: isEn ? 'Payment' : 'Thanh toán',
                oldVal: formatVal(exAny.paymentStatus),
                newVal: formatVal(newAny.paymentStatus),
              });
            }

            if (exAny.assignedPartnerId !== newAny.assignedPartnerId) {
              changes.push({
                label: isEn ? 'Partner' : 'Đối tác',
                oldVal: formatVal(exAny.assignedPartnerName),
                newVal: formatVal(newAny.assignedPartnerName),
              });
            }

            if (exAny.assignedPartnerIdSecondary !== newAny.assignedPartnerIdSecondary) {
              changes.push({
                label: isEn ? 'Secondary partner' : 'Đối tác chặng phụ',
                oldVal: formatVal(exAny.assignedPartnerNameSecondary),
                newVal: formatVal(newAny.assignedPartnerNameSecondary),
              });
            }

            if (changes.length > 0) {
              changedOrders.push({
                id: newOrder.id,
                lastUpdatedBy: newAny.lastUpdatedBy,
                changes
              });
            }
          }
        });

        if (changedOrders.length === 1) {
          const orderInfo = changedOrders[0];
          const updaterEmail = orderInfo.lastUpdatedBy ? String(orderInfo.lastUpdatedBy).trim() : '';

          const header = isEn ? `Order ${orderInfo.id}` : `Đơn ${orderInfo.id}`;
          const actionLine = updaterEmail
            ? (isEn ? `${updaterEmail} just changed:` : `${updaterEmail} vừa đổi:`)
            : (isEn ? `was just updated:` : `vừa được cập nhật:`);

          const changeLines = orderInfo.changes.map(c => `  ${c.label}: ${c.oldVal} → ${c.newVal}`).join('\n');
          const msg = `${header}\n${actionLine}\n${changeLines}`;

          triggerToast(msg, 'info', 7000);
        } else if (changedOrders.length > 1) {
          const emails = changedOrders.map(o => o.lastUpdatedBy ? String(o.lastUpdatedBy).trim() : '').filter(Boolean);
          const uniqueEmails = Array.from(new Set(emails));

          let updaterText = '';
          if (uniqueEmails.length === 1 && emails.length === changedOrders.length) {
            updaterText = uniqueEmails[0];
          } else {
            updaterText = isEn ? 'someone else' : 'người khác';
          }

          const header = isEn
            ? `${changedOrders.length} orders were just updated by ${updaterText}`
            : `${changedOrders.length} đơn vừa được ${updaterText} cập nhật`;

          const ids = changedOrders.map(o => o.id);
          let idsText = '';
          if (ids.length <= 5) {
            idsText = ids.join(', ');
          } else {
            const first5 = ids.slice(0, 5).join(', ');
            const remainingCount = ids.length - 5;
            idsText = isEn ? `${first5} … and ${remainingCount} more` : `${first5} … và ${remainingCount} đơn khác`;
          }

          const msg = `${header}\n${idsText}`;
          triggerToast(msg, 'info', 7000);
        }
      }

      isFirstSnapshot = false;
      setOrders(sanitized);
      safeStorage.setItem(ordersStorageKey(uid), JSON.stringify(sanitized));
    };

    if (uid) {
      if (userRole === 'staff') {
        unsubSubscription = subscribeAllOrders(
          handleNewServerOrders,
          (err) => console.error("Error in staff real-time order subscription:", err)
        );
      } else {
        unsubSubscription = subscribeOrdersForUser(
          uid,
          handleNewServerOrders,
          (err) => console.error("Error in user real-time order subscription:", err)
        );
      }
    }

    return () => {
      cancelled = true;
      if (unsubSubscription) {
        unsubSubscription();
      }
    };
  }, [currentUser?.uid, userRole]);

  const updateOrderAndSave = async (
    orderId: string,
    fields: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> => {
    const isEn = languageRef.current === 'EN';
    const uid = currentUser?.uid;

    const oldOrders = ordersRef.current || [];
    const targetOrder = oldOrders.find(o => o.id === orderId);
    if (!targetOrder) {
      return { success: false, error: 'Order not found' };
    }

    const payloadWithAudit = {
      ...fields,
      lastUpdatedBy: auth.currentUser?.email || 'staff',
      lastUpdatedAt: new Date().toISOString()
    };

    const updatedOrders = oldOrders.map(o => {
      if (o.id !== orderId) return o;
      const newOrder = { ...o };
      let newDetails: any = null;
      for (const [key, val] of Object.entries(payloadWithAudit)) {
        if (key.startsWith('details.')) {
          if (!newDetails) {
            newDetails = { ...(o.details || {}) };
          }
          const subKey = key.slice('details.'.length);
          newDetails[subKey] = val;
        } else {
          (newOrder as any)[key] = val;
        }
      }
      if (newDetails) {
        newOrder.details = newDetails;
      }
      return newOrder;
    });
    setOrders(updatedOrders);
    safeStorage.setItem(ordersStorageKey(uid), JSON.stringify(updatedOrders));

    try {
      const res = await updateOrderFields(orderId, payloadWithAudit);
      if (res && res.success) {
        return { success: true };
      } else {
        setOrders(oldOrders);
        safeStorage.setItem(ordersStorageKey(uid), JSON.stringify(oldOrders));
        const reason = res?.error || (isEn ? 'Server error' : 'Lỗi máy chủ');
        const errorMsg = isEn
          ? `Could not save changes to order ${orderId}: ${reason}`
          : `Không lưu được thay đổi cho đơn ${orderId}: ${reason}`;
        triggerToast(errorMsg, 'error');
        return { success: false, error: reason };
      }
    } catch (err: any) {
      setOrders(oldOrders);
      safeStorage.setItem(ordersStorageKey(uid), JSON.stringify(oldOrders));
      const reason = err?.message || (isEn ? 'Network error' : 'Lỗi kết nối mạng');
      const errorMsg = isEn
        ? `Could not save changes to order ${orderId}: ${reason}`
        : `Không lưu được thay đổi cho đơn ${orderId}: ${reason}`;
      triggerToast(errorMsg, 'error');
      return { success: false, error: reason };
    }
  };

  const [postBookingOrder, setPostBookingOrder] = useState<Order | null>(null);
  const [pendingCheckoutOrder, setPendingCheckoutOrder] = useState<Order | null>(null);



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

  const saveOrders = (updatedOrdersOrFn: Order[] | ((prev: Order[]) => Order[])) => {
    setOrders((prev) => {
      const rawNext = typeof updatedOrdersOrFn === 'function' ? updatedOrdersOrFn(prev) : updatedOrdersOrFn;
      const next = rawNext.map(sanitizeOrder);
      const key = ordersStorageKey(currentUser?.uid);
      safeStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };


  const clearAllOrders = () => {
    saveOrders([]);
    triggerToast("All applications cleared! Pristine production view activated.", "info");
  };

  const triggerToast = (msg: string, type: 'success' | 'info' | 'error' = 'success', duration: number = 4500) => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, duration);
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
    const key = ordersStorageKey(currentUser?.uid);
    const storedOrdersRaw = safeStorage.getItem(key) || '[]';
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
      status: 'Confirmed',
      ninepayPaymentNo: transactionId || foundOrder.ninepayPaymentNo,
    };

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

  const startPaymentForOrder = async (
    orderId: string,
    options?: { skipVerify?: boolean }
  ): Promise<void> => {
    let isRedirecting = false;
    setRetryingOrderId(orderId);
    try {
      if (!options?.skipVerify) {
        const verifyData = await verifyOrderPayment(orderId, { force: true });
        if (verifyData.isPaid) {
          setPaymentFailedState((prev) => ({ ...prev, isOpen: false }));
          applyPaidOrderLocally(orderId, verifyData.payment_no || '', { showSuccessModal: true });
          triggerToast(
            language === 'VI'
              ? 'Đơn này đã được thanh toán rồi.'
              : 'This order has already been paid.',
            'success'
          );
          return;
        }
      }

      const res = await fetch('/api/9pay-create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        paymentUrl?: string;
        error?: string;
      };

      if (res.ok && data.success && data.paymentUrl) {
        isRedirecting = true;
        window.location.href = data.paymentUrl;
        return;
      }

      if (res.status === 409) {
        if (data.error && data.error.toLowerCase().includes('already paid')) {
          const verifyData = await verifyOrderPayment(orderId, { force: true });
          setPaymentFailedState((prev) => ({ ...prev, isOpen: false }));
          applyPaidOrderLocally(orderId, verifyData.payment_no || '', { showSuccessModal: true });
          triggerToast(
            language === 'VI'
              ? 'Đơn này đã được thanh toán rồi.'
              : 'This order has already been paid.',
            'success'
          );
          return;
        }
        triggerToast(
          language === 'VI'
            ? `Không tạo được liên kết 9Pay: ${data.error || 'Xung đột thông tin'}.`
            : `Failed to create 9Pay link: ${data.error || 'Conflict error'}.`,
          'error'
        );
        return;
      }

      triggerToast(
        language === 'VI'
          ? `Không tạo được liên kết 9Pay: ${data.error || res.statusText}. Đơn ${orderId} vẫn chưa thanh toán.`
          : `Failed to create 9Pay link: ${data.error || res.statusText}. Order ${orderId} remains unpaid.`,
        'error'
      );
    } catch (e) {
      console.error('[DigiVisa 9Pay] startPaymentForOrder error:', e);
      triggerToast(
        language === 'VI'
          ? `Lỗi khởi tạo thanh toán: ${e instanceof Error ? e.message : String(e)}. Đơn vẫn chưa thanh toán.`
          : `Payment init error: ${e instanceof Error ? e.message : String(e)}. Order remains unpaid.`,
        'error'
      );
    } finally {
      if (!isRedirecting) setRetryingOrderId(null);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const orderId = urlParams.get('orderId');

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
      setPaymentFailedState({ isOpen: true, orderId, reason: 'cancelled' });
      return;
    }

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
            setPaymentFailedState({ isOpen: true, orderId, reason: 'unconfirmed' });
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
          setPaymentFailedState({ isOpen: true, orderId, reason: 'error' });
        } finally {
          if (!cancelled) setIsVerifyingPayment(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }
  }, []);

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

  const handleBookingSuccess = async (newOrder: Order): Promise<boolean> => {
    try {
      const activeUid = auth.currentUser?.uid || currentUser?.uid;
      if (!activeUid) {
        setPendingCheckoutOrder(newOrder);
        setPostBookingOrder(newOrder);
        return false;
      }

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
          userId: activeUid,
          userEmail: auth.currentUser?.email || currentUser?.email || (newOrder as any).userEmail || (newOrder.details as any)?.email,
          paymentStatus: 'Pending',
        };
        saveOrders([unpaid, ...orders]);
        saveOrderToFirestore(unpaid)
          .then((saveRes) => {
            if (saveRes && !saveRes.success) {
              console.error('Firestore save failed:', saveRes.error);
            }
          })
          .catch((err) => {
            console.error('Firestore sync background err:', err);
          });
        return true;
      }

      const trackingToken = newOrder.trackingToken || generateTrackingToken();
      const orderWithUser: Order = {
        ...newOrder,
        amountVnd,
        trackingToken,
        userId: activeUid,
        userEmail: auth.currentUser?.email || currentUser?.email || (newOrder as any).userEmail || (newOrder.details as any)?.email,
        paymentStatus: 'Pending',
      };
      saveOrders([orderWithUser, ...orders]);
      const saveRes = await saveOrderToFirestore(orderWithUser);
      if (saveRes && !saveRes.success) {
        console.error('Firestore save failed (9Pay flow):', saveRes.error);
      }

      triggerToast(
        language === 'VI'
          ? `Đơn ${orderWithUser.id} đã khởi tạo. Đang chuyển sang 9Pay...`
          : `Order ${orderWithUser.id} created. Opening 9Pay...`,
        'success'
      );

      await startPaymentForOrder(orderWithUser.id, { skipVerify: true });
      return true;
    } catch (e) {
      console.error('[DigiVisa 9Pay] handleBookingSuccess execution error:', e);
      triggerToast(
        language === 'VI'
          ? `Lỗi khởi tạo thanh toán: ${e instanceof Error ? e.message : String(e)}. Đơn vẫn chưa thanh toán.`
          : `Payment init error: ${e instanceof Error ? e.message : String(e)}. Order remains unpaid.`,
        'error'
      );
      return true;
    }
  };

  return (
    <div className={`min-h-screen bg-[#F8FAFC] flex flex-col font-sans antialiased text-slate-800 ${language === 'VI' ? 'lang-vi' : ''}`} id="applet-viewport">
      
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
                <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed">{toastMessage}</p>
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

      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setActiveService(null);
        }}
        orderCount={currentUser?.uid ? orders.filter((o) => (o as any).userId === currentUser.uid).length : 0}
        userRole={userRole}
        setUserRole={handleSetUserRole}
        language={language}
        setLanguage={handleSetLanguage}
        currentUser={currentUser}
        onOpenUserAuth={() => setIsUserAuthOpen(true)}
        onLogout={async () => {
          await logoutUser();
          setCurrentUser(null);
          setOrders([]);
          triggerToast(language === 'VI' ? 'Đăng xuất!' : 'Logged out successfully!', 'info');
        }}
      />

      <main className="flex-1 py-8 sm:py-12 bg-gradient-to-b from-teal-500/[0.02] to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          


          <AnimatePresence mode="wait">
            
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
                      <h1 className="font-display font-black text-slate-950 text-xl sm:text-3xl md:text-4.5xl tracking-tight whitespace-nowrap">
                        {language === 'EN' ? (
                          <>Begin your journey <span className="text-indigo-600 bg-indigo-50/70 px-2 py-0.5 rounded-lg border border-indigo-100/50">seamlessly</span></>
                        ) : (
                          <>Khởi đầu hành trình <span className="text-indigo-600 bg-indigo-50/70 px-2 py-0.5 rounded-lg border border-indigo-100/50">thật suôn sẻ</span></>
                        )}
                      </h1>
                      <p className="text-slate-500 text-sm sm:text-base max-w-3xl mx-auto leading-relaxed">
                        {language === 'EN'
                          ? 'Professional visa assistance, priority immigration, and airport transfers, delivered fast and seamlessly.'
                          : 'Hỗ trợ cấp visa chuyên nghiệp, dịch vụ nhập cảnh ưu tiên và xe đón tiễn sân bay một cách nhanh chóng và tiện lợi'}
                      </p>
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
                          </div>

                          <div className="pt-5 border-t border-slate-100 flex items-center justify-between mt-6">
                            <div>
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
                          </div>

                          <div className="pt-6 border-t border-slate-100 flex items-center justify-between mt-6">
                            <div>
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
                        orders={orders}
                      />
                    )}
                    {activeService === 'fasttrack' && (
                      <FastTrackForm
                        currency={currency}
                        onSuccess={handleBookingSuccess}
                        onCancel={() => setActiveService(null)}
                        language={language}
                        orders={orders}
                      />
                    )}
                    {activeService === 'pickup' && (
                      <AirportPickupForm
                        currency={currency}
                        onSuccess={handleBookingSuccess}
                        onCancel={() => setActiveService(null)}
                        language={language}
                        orders={orders}
                      />
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'tracker' && (
              <motion.div key="tracker" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <OrderTracker
                  orders={orders}
                  setOrders={saveOrders}
                  currency={currency}
                  onNavigateToServices={() => { setActiveTab('services'); setActiveService(null); }}
                  onClearAllOrders={clearAllOrders}
                  language={language}
                  currentUser={currentUser}
                  userRole={userRole}
                  onRetryPayment={startPaymentForOrder}
                  retryingOrderId={retryingOrderId}
                  onOpenUserAuth={() => setIsUserAuthOpen(true)}
                />
              </motion.div>
            )}

            {activeTab === 'faqs' && (
              <motion.div key="faqs" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <Faqs language={language} />
              </motion.div>
            )}

            {activeTab === 'oms' && (
              <motion.div key="oms" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                <OMS orders={orders} setOrders={saveOrders} currency={currency} language={language} onUpdateOrder={updateOrderAndSave} />
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      <Footer language={language} />

      <PostBookingAuthModal
        isOpen={!!postBookingOrder}
        order={postBookingOrder}
        onClose={() => {
          setPostBookingOrder(null);
          setPendingCheckoutOrder(null);
        }}
        onOpenAuth={() => {
          setPostBookingOrder(null);
          setIsUserAuthOpen(true);
        }}
        language={language}
      />

      <UserAuthModal
        isOpen={isUserAuthOpen}
        onClose={() => setIsUserAuthOpen(false)}
        onSuccess={async (userData) => {
          setCurrentUser(userData);
          setIsUserAuthOpen(false);
          triggerToast(language === 'VI' ? 'Đăng nhập thành công!' : 'Logged in successfully!', 'success');

          if (pendingCheckoutOrder) {
            const orderToPay = pendingCheckoutOrder;
            setPendingCheckoutOrder(null);
            const activeUser = auth.currentUser || userData;
            const orderWithUser: Order = {
              ...orderToPay,
              userId: activeUser.uid,
              userEmail: activeUser.email || (orderToPay.details as any)?.email,
            };
            await handleBookingSuccess(orderWithUser);
          }
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

      {/* Payment Failed / Unconfirmed / Cancelled Modal */}
      <PaymentFailedModal
        isOpen={paymentFailedState.isOpen}
        order={orders.find((o) => o.id === paymentFailedState.orderId) || null}
        orderId={paymentFailedState.orderId || undefined}
        reason={paymentFailedState.reason}
        isRetrying={retryingOrderId === paymentFailedState.orderId}
        onRetry={() => {
          if (paymentFailedState.orderId) startPaymentForOrder(paymentFailedState.orderId);
        }}
        onDismiss={() => setPaymentFailedState((prev) => ({ ...prev, isOpen: false }))}
        language={language}
      />
    </div>
  );
}
