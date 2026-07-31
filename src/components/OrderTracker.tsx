import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Search, ClipboardCheck, ArrowRight, MapPin, Calendar, 
  Clock, ShieldAlert, Sparkles, Printer, User, RefreshCw, 
  BadgeAlert, Plane, ShieldCheck as VerifiedIcon, QrCode, CreditCard,
  CheckCircle, AlertTriangle, Check, Car
} from 'lucide-react';
import { Order, PublicOrderSummary, Currency, CURRENCY_SYMBOLS, EXCHANGE_RATES } from '../types';
import { safeOpen, safeStorage } from '../utils/storage';
import { Language } from '../utils/translations';
import { getVietnamPricing } from '../utils/pricing';
import { formatPhoneE164 } from '../utils/validation';
import { claimPendingOrdersFromLocalStorage, listLocalTrackingTokens } from '../utils/orderClaim';

interface OrderTrackerProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  currency: Currency;
  onNavigateToServices: () => void;
  onLoadDemoData?: () => void;
  onClearAllOrders?: () => void;
  language?: Language;
  currentUser?: { email?: string | null; displayName?: string | null; uid?: string } | null;
  userRole?: 'customer' | 'staff';
}

function publicSummaryToOrder(summary: PublicOrderSummary): Order {
  return {
    id: summary.id,
    type: (summary.type as Order['type']) || 'Visa',
    status: summary.status,
    createdAt: summary.createdAt,
    paymentStatus: (summary.paymentStatus as Order['paymentStatus']) || 'Pending',
    // Marker only — never hydrate PII from lookup API
    details: { __publicLookup: true } as any,
  };
}

function isPublicLookupOrder(order: Order | null | undefined): boolean {
  return !!(order && (order.details as any)?.__publicLookup === true);
}

export default function OrderTracker({
  orders,
  setOrders,
  currency,
  onNavigateToServices,
  onLoadDemoData,
  onClearAllOrders,
  language = 'EN',
  currentUser,
  userRole = 'customer',
}: OrderTrackerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookedUpOrder, setLookedUpOrder] = useState<Order | null>(null);
  const autoClaimDoneForUid = useRef<string | null>(null);

  const isEn = language === 'EN';

  // Auto-claim guest orders when a signed-in user still has digivisa_track_* tokens (once per uid, debounced).
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid || userRole === 'staff') return;
    if (autoClaimDoneForUid.current === uid) return;
    if (listLocalTrackingTokens().length === 0) {
      autoClaimDoneForUid.current = uid;
      return;
    }

    const timer = setTimeout(async () => {
      if (autoClaimDoneForUid.current === uid) return;
      autoClaimDoneForUid.current = uid;
      try {
        const result = await claimPendingOrdersFromLocalStorage();
        if (result.claimed.length > 0) {
          setOrders((prev) =>
            prev.map((o) =>
              result.claimed.includes(o.id)
                ? { ...o, userId: uid, userEmail: currentUser?.email || o.userEmail }
                : o
            )
          );
        }
      } catch (e) {
        console.error('[OrderTracker] auto-claim failed', e);
        // Allow retry on next mount / uid change
        if (autoClaimDoneForUid.current === uid) autoClaimDoneForUid.current = null;
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [currentUser?.uid, currentUser?.email, userRole, setOrders]);

  // Privacy filter: owners (userId) or this-browser local orders. Guests look up via trackingToken API.
  // Never match by passport number or guessable order id against remote data.
  const userVisibleOrders = orders.filter((o) => {
    if (userRole === 'staff') return true;
    if (currentUser?.uid && (o as any).userId === currentUser.uid) {
      return true;
    }
    if (currentUser?.email) {
      const currentEmail = currentUser.email.toLowerCase();
      const userEmail = (o as any).userEmail?.toLowerCase();
      if (userEmail === currentEmail) return true;
    }
    // Local-only guest copies from this device (already in memory / localStorage)
    if ((o as any).isLocalGuestSession === true) return true;
    if (o.trackingToken && safeStorage.getItem(`digivisa_track_${o.id}`) === o.trackingToken) {
      return true;
    }
    return false;
  });

  const filteredOrders = (() => {
    const list = lookedUpOrder
      ? [lookedUpOrder, ...userVisibleOrders.filter((o) => o.id !== lookedUpOrder.id)]
      : userVisibleOrders;
    const query = searchQuery.trim().toUpperCase();
    if (!query || query.length >= 32) return list;
    return list.filter((o) => {
      return (
        o.id.toUpperCase().includes(query) ||
        o.type.toUpperCase().includes(query)
      );
    });
  })();

  const lookupByTrackingToken = async () => {
    const token = searchQuery.trim();
    setLookupError(null);
    if (token.length < 32) {
      setLookupError(isEn
        ? 'Enter the full tracking token (≥32 characters) from your booking confirmation.'
        : 'Nhập đầy đủ mã theo dõi (≥32 ký tự) từ lúc đặt đơn.');
      return;
    }
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/order-lookup?trackingToken=${encodeURIComponent(token)}`);
      const data = await res.json() as { success?: boolean; order?: PublicOrderSummary; error?: string };
      if (!res.ok || !data.success || !data.order) {
        setLookedUpOrder(null);
        setLookupError(data.error || (isEn ? 'Order not found' : 'Không tìm thấy đơn'));
        return;
      }
      const publicOrder = publicSummaryToOrder(data.order);
      setLookedUpOrder(publicOrder);
      setSelectedOrderId(publicOrder.id);
    } catch {
      setLookedUpOrder(null);
      setLookupError(isEn ? 'Lookup failed. Try again.' : 'Tra cứu thất bại. Thử lại.');
    } finally {
      setLookupLoading(false);
    }
  };

  const getStatusColor = (status: Order['status']) => {
    const s = String(status || '').toLowerCase();
    switch (status) {
      case 'Confirmed':
        return 'bg-blue-50 text-blue-800 border-blue-200 font-semibold';
      case 'Assigned':
      case 'Staff Assigned':
      case 'Driver Assigned':
        return 'bg-sky-50/70 text-sky-800 border-sky-200';
      case 'Processing':
        return 'bg-indigo-50/70 text-indigo-800 border-indigo-200/60';
      case 'Completed':
      case 'Approved':
      case 'Approved & Issued':
      case 'Service Completed':
      case 'Journey Completed':
        return 'bg-emerald-50 text-emerald-850 border-emerald-250/60 font-bold';
      default:
        if (s.includes('approve') || s.includes('issue') || s.includes('check')) {
          return 'bg-teal-50 text-teal-700 border-teal-200 font-semibold';
        }
        if (s.includes('process') || s.includes('active') || s.includes('staff') || s.includes('driver') || s.includes('assign')) {
          return 'bg-sky-50 text-sky-700 border-sky-200 font-semibold';
        }
        if (s.includes('done') || s.includes('complete') || s.includes('journey')) {
          return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
        }
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusMessage = (order: Order) => {
    const s = normalizeStatusForTimeline(order.status, order.type);
    
    if (order.type === 'Visa') {
      if (s === 'Confirmed') {
        return 'Visa application has been verified. Initial setup and records initialized.';
      } else if (s === 'Processing') {
        return 'Dedicated immigration liaison is processing the clearance and running machine biometrics match checks.';
      } else if (s === 'Completed') {
        return 'Electronic travel clearance completely finalized, stamped, and registered with airport immigration archives.';
      }
      return `Visa clearance status: ${order.status}.`;
    } else if (order.type === 'FastTrack') {
      if (s === 'Confirmed') {
        return 'VIP Fast Track concierge coordinates locked. Greeting team standby confirmed.';
      } else if (s === 'Assigned') {
        return 'Personal VIP gate liaison escort assigned and dispatched to the arrival terminal gate.';
      } else if (s === 'Completed') {
        return 'VIP Meet & Assist completed. Passenger successfully guided through expedited customs transit.';
      }
      return `Fast Track status: ${order.status}.`;
    } else { // AirportPickup
      if (s === 'Confirmed') {
        return 'Private shuttle reservation locked. Dispatch queue standing by.';
      } else if (s === 'Assigned') {
        return 'Professional chauffeur partner assigned. Vehicle and driver details synced.';
      } else if (s === 'Completed') {
        return 'Private terminal transfer completed. Passenger safely arrived at target address.';
      }
      return `Transfer status: ${order.status}.`;
    }
  };

  // Convert prices
  const formatCharge = (usdAmount: any, order?: Order) => {
    const val = typeof usdAmount === 'number' ? usdAmount : (parseFloat(usdAmount) || 0);
    if (order && order.type === 'Visa') {
      const details = order.details as any;
      if (details.destinationCountry === 'Vietnam') {
        const pricing = getVietnamPricing(
          details.visaType,
          details.resultsOption || '',
          details.submissionTiming || ''
        );
        if (currency === 'VND') {
          return `${pricing.totalVnd.toLocaleString('en-US')} ₫`;
        }
        return `${CURRENCY_SYMBOLS[currency]}${Math.round(pricing.total * EXCHANGE_RATES[currency]).toLocaleString()}`;
      }
    }

    if (currency === 'VND') {
      if (order && order.type === 'Visa') {
        const details = order.details as any;
          const base = details.visaType === 'Tourist (90 Days)' ? 220 : (details.nationality === 'Taiwan' || details.nationality === 'China' ? 130 : 120);
          let baseVnd = base * 25000;
          if (details.nationality === 'Taiwan') baseVnd = 3450000;
          else if (details.nationality === 'China') baseVnd = 3445000;
          else if (details.nationality === 'Korea' || details.nationality === 'Japan' || details.nationality === 'South Korea') {
            if (base === 120) baseVnd = 3120000;
            if (base === 220) baseVnd = 5720000;
          }
          
          let speed = 0;
          
          const speedVnd = speed * 25000;
          const subtotalVnd = baseVnd + speedVnd;
          const taxVnd = Math.round(subtotalVnd * 0.08);
          const totalVnd = subtotalVnd + taxVnd;
          
          return `${totalVnd.toLocaleString('en-US')} ₫`;
        }

      if (order && order.type === 'AirportPickup') {
        const details = order.details as any;
        const airportName = details.airport || '';
        const vehicleType = details.vehicleType || '4 seats';
        
        const isHan = airportName.includes('HAN');
        const isDad = airportName.includes('DAD');
        let baseVnd = 750000;
        if (isHan) {
          if (vehicleType === '4 seats') baseVnd = 765000;
          else if (vehicleType === '7 seats') baseVnd = 1065000;
          else baseVnd = 1565000;
        } else if (isDad) {
          if (vehicleType === '4 seats') baseVnd = 700000;
          else if (vehicleType === '7 seats') baseVnd = 1000000;
          else baseVnd = 1500000;
        } else {
          // SGN
          if (vehicleType === '4 seats') baseVnd = 750000;
          else if (vehicleType === '7 seats') baseVnd = 1050000;
          else baseVnd = 1550000;
        }
        
        const addFastTrack = details.addFastTrack;
        const fastTrackType = details.fastTrackType || 'VIP Meet & Assist';
        let comboVnd = 0;
        if (addFastTrack) {
          if (fastTrackType === 'VIP Meet & Assist') comboVnd = 1150000;
          else if (fastTrackType === 'Premium Fast Track') comboVnd = 1250000;
          else if (fastTrackType === 'Elite Lounges Gate-to-Gate') comboVnd = 1400000;
        }
        
        let totalVnd = baseVnd + comboVnd;
        if (addFastTrack) {
          totalVnd = Math.max(0, totalVnd - 200000);
        }
        return `${totalVnd.toLocaleString('en-US')} ₫`;
      }

      if (order && order.type === 'FastTrack') {
        const details = order.details as any;
        const packageType = details.packageType || 'Fast Track Standard';
        let packageVnd = 1150000;
        if (packageType === 'Fast Track Standard') packageVnd = 1150000;
        else if (packageType === 'Fast Track Business') packageVnd = 1250000;
        else if (packageType === 'Fast Track Vip') packageVnd = 1400000;
        
        let esimVnd = details.hasEsim ? 375000 : 0;
        
        let pickupVnd = 0;
        if (details.addAirportPickup) {
          const airportName = details.airport || '';
          const vehicleType = details.selectedPickupVehicle || '4 seats';
          const isHan = airportName.includes('HAN');
          const isDad = airportName.includes('DAD');
          if (isHan) {
            if (vehicleType === '4 seats') pickupVnd = 765000;
            else if (vehicleType === '7 seats') pickupVnd = 1065000;
            else pickupVnd = 1565000;
          } else if (isDad) {
            if (vehicleType === '4 seats') pickupVnd = 700000;
            else if (vehicleType === '7 seats') pickupVnd = 1000000;
            else pickupVnd = 1500000;
          } else {
            // SGN
            if (vehicleType === '4 seats') pickupVnd = 750000;
            else if (vehicleType === '7 seats') pickupVnd = 1050000;
            else pickupVnd = 1550000;
          }
        }
        
        let totalVnd = packageVnd + esimVnd + pickupVnd;
        if (details.addAirportPickup) {
          totalVnd = Math.max(0, totalVnd - 200000);
        }
        return `${totalVnd.toLocaleString('en-US')} ₫`;
      }

      const EXACT_SUMS: Record<number, number> = {
        12: 300000,
        15: 375000,
        24: 600000,
        27: 700000,
        29: 750000,
        38: 1000000,
        39: 1000000,
        40: 1050000,
        42: 1100000,
        45: 1150000,
        48: 1250000,
        51: 1300000,
        54: 1375000,
        55: 1400000,
        57: 1500000,
        59: 1550000,
        60: 1525000,
        61: 1550000,
        63: 1600000,
        64: 1625000,
        65: 1700000,
        66: 1675000,
        67: 1750000,
        69: 1800000,
        70: 1775000,
        72: 1850000,
        73: 1850000,
        74: 1950000,
        75: 1950000,
        76: 2000000,
        78: 2050000,
        79: 2000000,
        80: 2100000,
        81: 2100000,
        82: 2100000,
        83: 2150000,
        84: 2200000,
        85: 2200000,
        86: 2250000,
        87: 2250000,
        88: 2225000,
        89: 2300000,
        91: 2350000,
        93: 2450000,
        94: 2375000,
        95: 2500000,
        96: 2475000,
        97: 2550000,
        99: 2600000,
        102: 2650000,
        103: 2700000,
        104: 2700000,
        105: 2750000,
        106: 2750000,
        108: 2800000,
        112: 2900000,
        114: 2950000,
        120: 3120000,
        130: 3450000,
        132: 3300000,
        135: 3375000,
        144: 3600000,
        147: 3675000,
        159: 3975000,
        162: 4100000,
        177: 4475000,
        195: 4875000,
        207: 5175000,
        210: 5250000,
        219: 5475000,
        220: 5720000,
        222: 5550000,
        234: 5850000,
        237: 5975000,
        252: 6350000,
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

  const getExpectedResultDate = (order: Order) => {
    const speed = (order.details as any)?.processingSpeed || 'Standard';
    const created = order.createdAt ? new Date(order.createdAt) : new Date();
    const resultDate = new Date(created);
    if (speed === 'SuperExpress') {
      resultDate.setHours(resultDate.getHours() + 6);
      return `${resultDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} (Within 4-8 hours)`;
    } else if (speed === 'Express') {
      resultDate.setDate(resultDate.getDate() + 2);
      return resultDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } else {
      resultDate.setDate(resultDate.getDate() + 4);
      return resultDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const getInvoiceBreakdown = (order: Order) => {
    const details = order.details as any;
    const isVnd = currency === 'VND';
    const lines: { label: string; value: string; isDiscount?: boolean }[] = [];

    if (order.type === 'Visa') {
      if (details.destinationCountry === 'Vietnam') {
        const pricing = getVietnamPricing(
          details.visaType,
          details.resultsOption || '',
          details.submissionTiming || ''
        );

        lines.push({
          label: isVnd ? `Phí Visa chính phủ & Dịch vụ (${details.visaType})` : `Govt Fee & Processing (${details.visaType})`,
          value: isVnd ? `${pricing.baseVnd.toLocaleString('en-US')} ₫` : `$ ${pricing.base.toFixed(2)}`
        });

        if (pricing.speed > 0) {
          let speedLabel = '';
          if (details.visaType === 'Vietnam approval letter on arrival') {
            speedLabel = isVnd ? 'Áp dụng Thứ 7, Chủ Nhật & ngày lễ' : 'Applicable on Saturdays, Sundays, and public holidays';
          } else if (details.resultsOption === 'same_day') {
            speedLabel = isVnd ? 'Nhận ngay trong ngày' : 'Same Day Urgency';
          } else if (details.resultsOption === 'within_2_days') {
            if (details.submissionTiming === 'before_3pm') {
              speedLabel = isVnd ? 'Nộp trước 15:00, nhận trước 17:00 hôm sau' : 'Submit < 3pm, receive < 5pm next day';
            } else if (details.submissionTiming === 'before_9pm_next_day_5pm') {
              speedLabel = isVnd ? 'Nộp trước 21:00, nhận trước 17:00 hôm sau' : 'Submit < 9pm, receive < 5pm next day';
            } else if (details.submissionTiming === 'before_9pm_next_day_noon') {
              speedLabel = isVnd ? 'Nộp trước 21:00, nhận trước 12:00 trưa hôm sau' : 'Submit < 9pm, receive < noon next day';
            }
          }

          lines.push({
            label: isVnd ? `Phí xử lý hỏa tốc (${speedLabel})` : `Express Priority (${speedLabel})`,
            value: isVnd ? `${pricing.speedVnd.toLocaleString('en-US')} ₫` : `$ ${pricing.speed.toFixed(2)}`
          });
        }

        lines.push({
          label: isVnd ? 'Thuế phí dịch vụ (8% VAT)' : 'Service VAT (8% VAT)',
          value: isVnd ? `${pricing.taxVnd.toLocaleString('en-US')} ₫` : `$ ${pricing.tax.toFixed(2)}`
        });
      } else {
        const base = details.visaType === 'Tourist (90 Days)' ? 220 : (details.nationality === 'Taiwan' || details.nationality === 'China' ? 130 : 120);
        let baseVnd = base * 25000;
        if (details.nationality === 'Taiwan') baseVnd = 3450000;
        else if (details.nationality === 'China') baseVnd = 3445000;
        else if (details.nationality === 'Korea' || details.nationality === 'Japan' || details.nationality === 'South Korea') {
          if (base === 120) baseVnd = 3120000;
          if (base === 220) baseVnd = 5720000;
        }
        lines.push({
          label: isVnd ? `Phí Visa chính phủ & Dịch vụ (${details.visaType})` : `Govt Fee & Processing (${details.visaType})`,
          value: isVnd ? `${baseVnd.toLocaleString('en-US')} ₫` : `$ ${base.toFixed(2)}`
        });

        let speed = 0;
        if (speed > 0) {
          lines.push({
            label: isVnd ? `Phí xử lý hỏa tốc (${details.processingSpeed})` : `Express Processing (${details.processingSpeed})`,
            value: isVnd ? `${(speed * 25000).toLocaleString('en-US')} ₫` : `$ ${speed.toFixed(2)}`
          });
        }

        const subtotal = base + speed;
        const subtotalVnd = baseVnd + (speed * 25000);
        const taxVnd = Math.round(subtotalVnd * 0.08);
        const taxUsd = subtotal * 0.08;
        lines.push({
          label: isVnd ? 'Thuế phí sân bay (8% VAT)' : 'Airport Surcharges (8% VAT)',
          value: isVnd ? `${taxVnd.toLocaleString('en-US')} ₫` : `$ ${taxUsd.toFixed(2)}`
        });
      }
    } else if (order.type === 'AirportPickup') {
      const airportName = details.airport || '';
      const vehicleType = details.vehicleType || '4 seats';
      const isHan = airportName.includes('HAN');
      const isDad = airportName.includes('DAD');
      
      let baseVnd = 750000;
      let baseUsd = 27;
      if (vehicleType === '4 seats') baseUsd = 27;
      else if (vehicleType === '7 seats') baseUsd = 38;
      else baseUsd = 55;

      if (isHan) {
        if (vehicleType === '4 seats') baseVnd = 765000;
        else if (vehicleType === '7 seats') baseVnd = 1065000;
        else baseVnd = 1565000;
      } else if (isDad) {
        if (vehicleType === '4 seats') baseVnd = 700000;
        else if (vehicleType === '7 seats') baseVnd = 1000000;
        else baseVnd = 1500000;
      } else {
        if (vehicleType === '4 seats') baseVnd = 750000;
        else if (vehicleType === '7 seats') baseVnd = 1050000;
        else baseVnd = 1550000;
      }

      lines.push({
        label: isVnd 
          ? `Tài xế riêng (${vehicleType === '4 seats' ? 'Xe 4 chỗ' : vehicleType === '7 seats' ? 'Xe 7 chỗ' : 'Xe 16 chỗ'})`
          : `Chauffeur (${vehicleType})`,
        value: isVnd ? `${baseVnd.toLocaleString('en-US')} ₫` : `$ ${baseUsd.toFixed(2)}`
      });

      const addFastTrack = details.addFastTrack;
      const fastTrackType = details.fastTrackType || 'VIP Meet & Assist';
      if (addFastTrack) {
        let comboVnd = 1150000;
        let comboUsd = 45;
        if (fastTrackType === 'VIP Meet & Assist') { comboVnd = 1150000; comboUsd = 45; }
        else if (fastTrackType === 'Premium Fast Track') { comboVnd = 1250000; comboUsd = 48; }
        else if (fastTrackType === 'Elite Lounges Gate-to-Gate') { comboVnd = 1400000; comboUsd = 55; }

        lines.push({
          label: isVnd 
            ? `Thủ tục nhanh (${fastTrackType === 'VIP Meet & Assist' ? 'VIP Đón' : fastTrackType === 'Premium Fast Track' ? 'Làn nhanh' : 'Hạng thương gia'})`
            : `Fast Track (${fastTrackType})`,
          value: isVnd ? `${comboVnd.toLocaleString('en-US')} ₫` : `$ ${comboUsd.toFixed(2)}`
        });

        lines.push({
          label: isVnd ? 'Giảm giá Combo (FT + Xe)' : 'Combo Discount (FT + Car)',
          value: isVnd ? '-200,000 ₫' : '-$ 9.00',
          isDiscount: true
        });
      }
    } else if (order.type === 'FastTrack') {
      const packageType = details.packageType || 'Fast Track Standard';
      let packageVnd = 1150000;
      let packageUsd = 45;
      if (packageType === 'Fast Track Standard') { packageVnd = 1150000; packageUsd = 45; }
      else if (packageType === 'Fast Track Business') { packageVnd = 1250000; packageUsd = 48; }
      else if (packageType === 'Fast Track Vip') { packageVnd = 1400000; packageUsd = 55; }

      lines.push({
        label: isVnd 
          ? `Thủ tục nhanh (${packageType === 'Fast Track Standard' ? 'Tiêu chuẩn' : packageType === 'Fast Track Business' ? 'Thương gia' : 'VIP'})`
          : `Fast Track (${packageType})`,
        value: isVnd ? `${packageVnd.toLocaleString('en-US')} ₫` : `$ ${packageUsd.toFixed(2)}`
      });

      if (details.hasEsim) {
        lines.push({
          label: isVnd ? 'Cài đặt eSIM' : 'eSIM Setup',
          value: isVnd ? '375,000 ₫' : '$ 15.00'
        });
      }

      if (details.addAirportPickup) {
        const airportName = details.airport || '';
        const vehicleType = details.selectedPickupVehicle || '4 seats';
        const isHan = airportName.includes('HAN');
        const isDad = airportName.includes('DAD');
        let pickupVnd = 750000;
        let pickupUsd = 27;
        if (vehicleType === '4 seats') pickupUsd = 27;
        else if (vehicleType === '7 seats') pickupUsd = 38;
        else pickupUsd = 55;

        if (isHan) {
          if (vehicleType === '4 seats') pickupVnd = 765000;
          else if (vehicleType === '7 seats') pickupVnd = 1065000;
          else pickupVnd = 1565000;
        } else if (isDad) {
          if (vehicleType === '4 seats') pickupVnd = 700000;
          else if (vehicleType === '7 seats') pickupVnd = 1000000;
          else pickupVnd = 1500000;
        } else {
          if (vehicleType === '4 seats') pickupVnd = 750000;
          else if (vehicleType === '7 seats') pickupVnd = 1050000;
          else pickupVnd = 1550000;
        }

        lines.push({
          label: isVnd 
            ? `Tài xế riêng (${vehicleType === '4 seats' ? 'Xe 4 chỗ' : vehicleType === '7 seats' ? 'Xe 7 chỗ' : 'Xe 16 chỗ'})`
            : `Chauffeur (${vehicleType})`,
          value: isVnd ? `${pickupVnd.toLocaleString('en-US')} ₫` : `$ ${pickupUsd.toFixed(2)}`
        });

        lines.push({
          label: isVnd ? 'Giảm giá Combo (FT + Xe)' : 'Combo Discount (FT + Car)',
          value: isVnd ? '-200,000 ₫' : '-$ 9.00',
          isDiscount: true
        });
      }
    }

    return lines;
  };

  const normalizeStatusForTimeline = (status: string, type?: string): string => {
    const s = String(status || '').trim();
    
    if (type === 'Visa') {
      const validVisaStatuses = ['Agency Review', 'Submitted to Embassy', 'Processing', 'Completed'];
      const matched = validVisaStatuses.find(opt => opt.toLowerCase() === s.toLowerCase());
      if (matched) return matched;

      const lower = s.toLowerCase();
      if (lower === 'completed' || lower === 'approved' || lower === 'approved & issued') {
        return 'Completed';
      }
      if (lower === 'processing' || lower === 'under review' || lower === 'standard processing') {
        return 'Processing';
      }
      if (lower === 'submitted to embassy' || lower === 'submitted') {
        return 'Submitted to Embassy';
      }
      return 'Agency Review';
    }

    if (type === 'AirportPickup') {
      const validPickupStatuses = ['Staff Assigned', 'Passenger Greet', 'Completed'];
      const matched = validPickupStatuses.find(opt => opt.toLowerCase() === s.toLowerCase());
      if (matched) return matched;

      const lower = s.toLowerCase();
      if (lower === 'completed' || lower === 'service completed' || lower === 'journey completed' || lower === 'clearance dynamic sync' || lower === 'luggage handover completed') {
        return 'Completed';
      }
      if (lower === 'passenger greet' || lower === 'passenger greeted') {
        return 'Passenger Greet';
      }
      return 'Staff Assigned';
    }

    if (type === 'FastTrack') {
      const validTrackStatuses = ['Staff Assigned', 'Completed'];
      const matched = validTrackStatuses.find(opt => opt.toLowerCase() === s.toLowerCase());
      if (matched) return matched;

      const lower = s.toLowerCase();
      if (lower === 'completed' || lower === 'service completed' || lower === 'journey completed' || lower === 'clearance dynamic sync' || lower === 'luggage handover completed') {
        return 'Completed';
      }
      return 'Staff Assigned';
    }

    return status;
  };

  const getTimelineStepsForOrder = (order: Order) => {
    if (order.type === 'Visa') {
      return [
        { id: 'Agency Review', label: 'Agency Review', desc: 'Dossier under agency review' },
        { id: 'Submitted to Embassy', label: 'Submitted to Embassy', desc: 'Submitted to embassy' },
        { id: 'Processing', label: 'Processing', desc: 'Under review at embassy' },
        { id: 'Completed', label: 'Completed', desc: 'Visa issued' }
      ];
    }
    if (order.type === 'FastTrack') {
      return [
        { id: 'Staff Assigned', label: 'Staff Assigned', desc: 'Staff assigned' },
        { id: 'Completed', label: 'Completed', desc: 'Service completed' }
      ];
    }
    // AirportPickup (Airport Transfer)
    return [
      { id: 'Staff Assigned', label: 'Staff Assigned', desc: 'Chauffeur assigned' },
      { id: 'Passenger Greet', label: 'Passenger Greet', desc: 'Passenger met' },
      { id: 'Completed', label: 'Completed', desc: 'Trip completed' }
    ];
  };

  const [userActiveComboLeg, setUserActiveComboLeg] = useState<'primary' | 'secondary'>('primary');

  // Simulate Step Progress changes - Highly engaging sandbox helper!
  const progressOrderStatus = (orderId: string) => {
    setOrders((prevOrders) => {
      const updated = prevOrders.map((o) => {
        if (o.id !== orderId) return o;
        
        const isSec = userActiveComboLeg === 'secondary' && ((o.type === 'FastTrack' && (o.details as any).addAirportPickup) || (o.type === 'AirportPickup' && (o.details as any).addFastTrack));
        const currentStatus = isSec ? (o.secondaryStatus || 'Confirmed') : o.status;
        const currentType = isSec ? (o.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack') : o.type;

        const tempOrder = { ...o, type: currentType, status: currentStatus };
        const steps = getTimelineStepsForOrder(tempOrder as any);
        const normalizedCurrent = normalizeStatusForTimeline(currentStatus, currentType);
        const currentIndex = steps.findIndex(step => step.id === normalizedCurrent);
        
        let nextIndex = (currentIndex + 1) % steps.length;
        let nextStep = steps[nextIndex];
        
        let nextStatus = nextStep.id;
        
        if (isSec) {
          const secType = o.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack';
          let updatedFields: any = { secondaryStatus: nextStatus, secondarySubStatus: undefined };
          if (nextStatus === 'Staff Assigned' || nextStatus === 'Assigned') {
            if (secType === 'AirportPickup') {
              updatedFields.secondaryStaffName = o.secondaryStaffName || 'Mr. Minh Quan (VIP Chauffeur Partner)';
              updatedFields.secondaryStaffPhone = o.secondaryStaffPhone || '+84912345678';
              updatedFields.secondaryStaffLocation = o.secondaryStaffLocation || 'Da Nang Airport (DAD) T1 Arrival Gate';
              updatedFields.secondaryStaffPhoto = o.secondaryStaffPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200';
              updatedFields.secondaryLicensePlate = o.secondaryLicensePlate || '43A-999.88';
              updatedFields.secondaryCarPhoto = o.secondaryCarPhoto || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=600';
            } else {
              updatedFields.secondaryStaffName = o.secondaryStaffName || 'Mr. Kevin Pham (Senior FastTrack Escort)';
              updatedFields.secondaryStaffPhone = o.secondaryStaffPhone || '+84905111222';
              updatedFields.secondaryStaffLocation = o.secondaryStaffLocation || 'Da Nang Airport (DAD) Inbound Immigration Hall';
              updatedFields.secondaryStaffPhoto = o.secondaryStaffPhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200';
            }
          }
          return { ...o, ...updatedFields };
        } else {
          let updatedFields: any = { status: nextStatus };
          if (nextStatus === 'Staff Assigned' || nextStatus === 'Assigned') {
            if (o.type === 'AirportPickup') {
              updatedFields.staffName = o.staffName || 'Mr. Minh Quan (VIP Chauffeur Partner)';
              updatedFields.staffPhone = o.staffPhone || '+84912345678';
              updatedFields.staffLocation = o.staffLocation || 'Da Nang Airport (DAD) T1 Arrival Gate';
              updatedFields.staffPhoto = o.staffPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200';
              updatedFields.licensePlate = o.licensePlate || '43A-999.88';
              updatedFields.carPhoto = o.carPhoto || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=600';
            } else if (o.type === 'FastTrack') {
              updatedFields.staffName = o.staffName || 'Mr. Kevin Pham (Senior FastTrack Escort)';
              updatedFields.staffPhone = o.staffPhone || '+84905111222';
              updatedFields.staffLocation = o.staffLocation || 'Da Nang Airport (DAD) Inbound Immigration Hall';
              updatedFields.staffPhoto = o.staffPhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200';
            }
          }
          return { ...o, ...updatedFields };
        }
      });
      safeStorage.setItem('digivisa_orders', JSON.stringify(updated));
      return updated;
    });
  };

  const selectedOrder =
    (lookedUpOrder && lookedUpOrder.id === selectedOrderId ? lookedUpOrder : null)
    || orders.find((o) => o.id === selectedOrderId)
    || null;

  // Reset active combo leg when selected order changes
  useEffect(() => {
    setUserActiveComboLeg('primary');
  }, [selectedOrderId]);

  const isCombo = selectedOrder ? (
    (selectedOrder.type === 'FastTrack' && (selectedOrder.details as any).addAirportPickup) ||
    (selectedOrder.type === 'AirportPickup' && (selectedOrder.details as any).addFastTrack)
  ) : false;

  const trackingOrder = (selectedOrder && isCombo && userActiveComboLeg === 'secondary') ? {
    ...selectedOrder,
    type: (selectedOrder.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack') as any,
    status: selectedOrder.secondaryStatus || 'Confirmed',
    subStatus: selectedOrder.secondarySubStatus,
    staffName: selectedOrder.secondaryStaffName,
    staffPhone: selectedOrder.secondaryStaffPhone,
    staffLocation: selectedOrder.secondaryStaffLocation,
    staffPhoto: selectedOrder.secondaryStaffPhoto,
    licensePlate: selectedOrder.secondaryLicensePlate,
    carPhoto: selectedOrder.secondaryCarPhoto,
    isSecondaryLeg: true,
  } : selectedOrder;

  const handleUpdateTrackingStatus = (newStatus: string) => {
    if (!selectedOrder) return;
    const isSec = isCombo && userActiveComboLeg === 'secondary';
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.id === selectedOrder.id) {
          if (isSec) {
            return { ...o, secondaryStatus: newStatus, secondarySubStatus: undefined };
          } else {
            return { ...o, status: newStatus, subStatus: undefined };
          }
        }
        return o;
      });
      safeStorage.setItem('digivisa_orders', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4" id="tracker-dashboard">
      <div className="text-center max-w-3xl mx-auto mb-10">
        <h1 className="font-display font-bold text-3xl sm:text-4xl text-slate-900 tracking-tight">Active Clearances & Orders</h1>
        <p className="text-slate-500 text-sm sm:text-base mt-2">Manage electronic clearances, contact VIP escorts, and track real-time airport shuttle dispatches.</p>
      </div>

      {/* Tracker Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Order list & lookup */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-150 shadow-sm flex flex-col space-y-4">
            
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-slate-900 text-sm uppercase tracking-wider">
                Search Clearances
              </h2>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                id="search-input"
                placeholder={isEn ? 'Paste tracking token (≥32 chars)...' : 'Dán mã theo dõi (≥32 ký tự)...'}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setLookupError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    lookupByTrackingToken();
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none transition-all font-medium font-mono"
              />
            </div>
            <button
              type="button"
              onClick={lookupByTrackingToken}
              disabled={lookupLoading || searchQuery.trim().length < 32}
              className="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-[11px] font-bold transition-colors"
            >
              {lookupLoading
                ? (isEn ? 'Looking up…' : 'Đang tra cứu…')
                : (isEn ? 'Look up status' : 'Tra cứu trạng thái')}
            </button>
            {lookupError && (
              <p className="text-[11px] text-rose-600 font-medium">{lookupError}</p>
            )}
            <p className="text-[10px] text-slate-400 leading-relaxed">
              {isEn
                ? 'Guests track by opaque token only — passport numbers and order IDs are not accepted for public lookup.'
                : 'Khách tra cứu bằng mã theo dõi — không dùng số passport hay mã đơn để tìm công khai.'}
            </p>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-4">
                <BadgeAlert className="h-10 w-10 text-slate-400 mx-auto" />
                <div>
                  <p className="text-xs font-bold text-slate-700">No Orders Found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Please check your ID, or create a new booking.</p>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-[200px] mx-auto">
                  <button
                    onClick={onNavigateToServices}
                    id="empty-services-navigate-btn"
                    className="w-full px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    Book New Clearance
                  </button>
                  {orders.length === 0 && onLoadDemoData && (
                    <button
                      onClick={onLoadDemoData}
                      id="empty-demo-data-btn"
                      className="w-full px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      ✨ Load Demo Data
                    </button>
                  )}
                </div>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = order.id === selectedOrderId;
                const details = order.details as any;
                const publicOnly = isPublicLookupOrder(order);
                const paxName = publicOnly
                  ? (isEn ? 'Status only (no personal data)' : 'Chỉ trạng thái (không hiện PII)')
                  : order.type === 'Visa'
                    ? `${details.firstName || ''} ${details.lastName || ''}`.trim() || '—'
                    : details.contactName || details.passengerName || '—';

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-teal-500 bg-teal-50/10 shadow-sm shadow-teal-500/5' 
                        : 'border-slate-150 hover:border-slate-250 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <span className="font-mono text-[10px] font-bold text-slate-400">{order.id}</span>
                      <span className={`text-[9px] font-bold border px-2 py-0.5 rounded-full ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">
                          {order.type === 'Visa' ? '📋 ' : order.type === 'FastTrack' ? '⚡ ' : '🚖 '}
                          {order.type === 'Visa' ? 'Visa' : order.type === 'FastTrack' ? 'Fast Track' : 'Airport Transfer'}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1 flex items-center">
                          <User className="h-3 w-3 text-slate-400 mr-1 shrink-0" />
                          <span className="truncate max-w-[150px]">{paxName}</span>
                        </p>
                      </div>
                      
                      <div className="text-right">
                        {!publicOnly && (
                          <span className="text-xs font-black text-slate-900 font-display">
                            {formatCharge(details.totalFee || 0, order)}
                          </span>
                        )}
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                            : '—'}
                        </p>
                        <p className="text-[9px] font-bold text-slate-500 mt-0.5">
                          {order.paymentStatus}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed visual layout */}
        <div className="lg:col-span-2">
          {selectedOrder && isPublicLookupOrder(selectedOrder) ? (
            <motion.div
              layoutId={selectedOrder.id}
              className="bg-white rounded-3xl border border-slate-150 shadow-md p-6 sm:p-8 space-y-5"
            >
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase font-black">
                  {isEn ? 'Public status (token lookup)' : 'Trạng thái công khai (mã theo dõi)'}
                </span>
                <h2 className="font-display font-bold text-2xl text-slate-900 mt-1">{selectedOrder.id}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Status</p>
                  <p className="font-bold text-slate-800 mt-1">{selectedOrder.status}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Payment</p>
                  <p className="font-bold text-slate-800 mt-1">{selectedOrder.paymentStatus}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Type</p>
                  <p className="font-bold text-slate-800 mt-1">{selectedOrder.type}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Created</p>
                  <p className="font-bold text-slate-800 mt-1">
                    {selectedOrder.createdAt
                      ? new Date(selectedOrder.createdAt).toLocaleString()
                      : '—'}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                {isEn
                  ? 'Passport, date of birth, and document scans are never returned by this lookup.'
                  : 'Passport, ngày sinh và ảnh scan không bao giờ được trả về qua tra cứu này.'}
              </p>
            </motion.div>
          ) : selectedOrder ? (
            <motion.div
              layoutId={selectedOrder.id}
              className="bg-white rounded-3xl border border-slate-150 shadow-md p-6 sm:p-8 space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase font-black">Authorized Tracking Ticket</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <h2 className="font-display font-bold text-2xl text-slate-900">{selectedOrder.id}</h2>
                    <span className={`text-xs font-mono font-bold px-3 py-1 border rounded-lg ${getStatusColor(trackingOrder.status)}`}>
                      {trackingOrder.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Segmented Control Toggles for Combo Orders */}
              {isCombo && (
                <div className="flex bg-slate-100 p-1 rounded-xl w-full max-w-md border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setUserActiveComboLeg('primary')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-black rounded-lg transition-all cursor-pointer ${
                      userActiveComboLeg === 'primary'
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Fast-Track Escort</span>
                    <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                      {selectedOrder.status}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserActiveComboLeg('secondary')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-black rounded-lg transition-all cursor-pointer ${
                      userActiveComboLeg === 'secondary'
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Car className="h-3.5 w-3.5" />
                    <span>Airport Transfer</span>
                    <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                      {selectedOrder.secondaryStatus || 'Confirmed'}
                    </span>
                  </button>
                </div>
              )}

              {/* Passenger Greet Active Cover Info Alert */}
              {['Passenger Greet', 'Passenger Greeted'].includes(trackingOrder.status) && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4.5 space-y-2 animate-fade-in flex items-start gap-3.5">
                  <div className="bg-emerald-100 text-emerald-700 p-2 rounded-xl text-lg leading-none shrink-0 select-none">
                    🤝
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] bg-emerald-150 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider font-sans border border-emerald-200">
                      Active Coverage
                    </span>
                    <h4 className="font-display font-extrabold text-slate-900 text-xs mt-1">
                      Passenger Greeted & Secured
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Our dispatch partner has successfully verified the physical identity of <strong>{(selectedOrder.details as any).firstName} {(selectedOrder.details as any).lastName}</strong>. The chauffeur is currently executing the safe drop-off transfer to the requested destination: <strong>{(selectedOrder.details as any).destinationAddress || 'Airport departures terminal'}</strong>.
                    </p>
                  </div>
                </div>
              )}



              {/* Interactive Status Roadmap Milestone Timeline */}
              {selectedOrder && (
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse shrink-0"></span>
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 font-mono">Live Service Milestone</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-450 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1 select-none">
                    <span>🔒 Live Sync (Read-Only)</span>
                  </div>
                </div>

                {/* Dynamic Horizontal Milestone Bar */}
                <div className="relative flex items-center justify-between w-full py-2">
                  {/* Connecting Line */}
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 z-0"></div>
                  
                  {/* Active Connecting Line Highlight */}
                  <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-500 transition-all duration-500 z-0"
                    style={{
                      width: (() => {
                        const stepsForOrder = getTimelineStepsForOrder(trackingOrder!);
                        const normalizedCurrent = normalizeStatusForTimeline(trackingOrder!.status, trackingOrder!.type);
                        const currentIndex = stepsForOrder.findIndex(step => step.id === normalizedCurrent);
                        if (currentIndex <= 0) return '0%';
                        if (currentIndex >= stepsForOrder.length - 1) return '100%';
                        return `${(currentIndex / (stepsForOrder.length - 1)) * 100}%`;
                      })()
                    }}
                  ></div>

                  {/* Steps */}
                  {getTimelineStepsForOrder(trackingOrder!).map((step, idx, arr) => {
                    const normalizedCurrent = normalizeStatusForTimeline(trackingOrder!.status, trackingOrder!.type);
                    const currentIndex = arr.findIndex(s => s.id === normalizedCurrent);
                    const isCompleted = idx < currentIndex;
                    const isActive = idx === currentIndex;

                    return (
                      <div 
                        key={step.id} 
                        onClick={() => {
                          return; // Live tracking is read-only for users
                          const statusToSet = step.id;
                          setOrders(prev => {
                            const updated = prev.map(o => {
                              if (o.id === selectedOrder.id) {
                                if (isCombo && userActiveComboLeg === 'secondary') {
                                  const secType = o.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack';
                                  let updatedFields: any = { secondaryStatus: statusToSet, secondarySubStatus: undefined };
                                  if (statusToSet === 'Assigned') {
                                    if (secType === 'AirportPickup') {
                                      updatedFields.secondaryStaffName = o.secondaryStaffName || 'Mr. Minh Quan (VIP Chauffeur Partner)';
                                      updatedFields.secondaryStaffPhone = o.secondaryStaffPhone || '+84912345678';
                                      updatedFields.secondaryStaffLocation = o.secondaryStaffLocation || 'Da Nang Airport (DAD) T1 Arrival Gate';
                                      updatedFields.secondaryStaffPhoto = o.secondaryStaffPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200';
                                      updatedFields.secondaryLicensePlate = o.secondaryLicensePlate || '43A-999.88';
                                      updatedFields.secondaryCarPhoto = o.secondaryCarPhoto || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=600';
                                    } else {
                                      updatedFields.secondaryStaffName = o.secondaryStaffName || 'Mr. Kevin Pham (Senior FastTrack Escort)';
                                      updatedFields.secondaryStaffPhone = o.secondaryStaffPhone || '+84905111222';
                                      updatedFields.secondaryStaffLocation = o.secondaryStaffLocation || 'Da Nang Airport (DAD) Inbound Immigration Hall';
                                      updatedFields.secondaryStaffPhoto = o.secondaryStaffPhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200';
                                    }
                                  }
                                  return { ...o, ...updatedFields };
                                } else {
                                  let subStatus = o.subStatus;
                                  let updatedFields: any = { status: statusToSet, subStatus };
                                  if (o.type === 'Visa') {
                                    if (statusToSet === 'Processing') {
                                      subStatus = subStatus || 'Standard processing';
                                    } else if (statusToSet === 'Completed') {
                                      subStatus = subStatus || 'Approved';
                                    } else {
                                      subStatus = undefined;
                                    }
                                    updatedFields.subStatus = subStatus;
                                  } else if (statusToSet === 'Assigned') {
                                    if (o.type === 'AirportPickup') {
                                      updatedFields.staffName = o.staffName || 'Mr. Minh Quan (VIP Chauffeur Partner)';
                                      updatedFields.staffPhone = o.staffPhone || '+84912345678';
                                      updatedFields.staffLocation = o.staffLocation || 'Da Nang Airport (DAD) T1 Arrival Gate';
                                      updatedFields.staffPhoto = o.staffPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200';
                                      updatedFields.licensePlate = o.licensePlate || '43A-999.88';
                                      updatedFields.carPhoto = o.carPhoto || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=600';
                                    } else if (o.type === 'FastTrack') {
                                      updatedFields.staffName = o.staffName || 'Mr. Kevin Pham (Senior FastTrack Escort)';
                                      updatedFields.staffPhone = o.staffPhone || '+84905111222';
                                      updatedFields.staffLocation = o.staffLocation || 'Da Nang Airport (DAD) Inbound Immigration Hall';
                                      updatedFields.staffPhoto = o.staffPhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200';
                                    }
                                  }
                                  return { ...o, ...updatedFields };
                                }
                              }
                              return o;
                            });
                            safeStorage.setItem('digivisa_orders', JSON.stringify(updated));
                            return updated;
                          });
                        }}
                        className="relative z-10 flex flex-col items-center cursor-default"
                      >
                        {/* Step Circle Bubble */}
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center border font-mono text-xs font-black transition-all duration-300 ${
                          isCompleted 
                            ? 'bg-emerald-500 border-emerald-600 text-white shadow-md shadow-emerald-500/10' 
                            : isActive 
                            ? 'bg-indigo-600 border-indigo-700 text-white ring-4 ring-indigo-100 shadow-md shadow-indigo-600/15 scale-110' 
                            : 'bg-white border-slate-250 text-slate-400 hover:border-slate-400 hover:text-slate-600'
                        }`}>
                          {isCompleted ? (
                            <Check className="h-4 w-4 text-white font-bold" />
                          ) : (
                            idx + 1
                          )}
                        </div>
                        
                        {/* Labels */}
                        <span className={`text-[11px] font-bold mt-2 transition-colors ${
                          isActive ? 'text-indigo-600 font-extrabold' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                        }`}>
                          {step.label}
                        </span>
                        <span className="text-[9px] text-slate-400 hidden sm:block mt-0.5 text-center">
                          {step.desc}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-white border border-slate-150 rounded-xl p-3 text-xs text-slate-600 flex items-start space-x-2.5 shadow-sm mt-2">
                  <div className={`p-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 mt-0.5`}>
                    <Plane className={`h-3.5 w-3.5 ${trackingOrder!.status?.toLowerCase() === 'assigned' ? 'animate-bounce' : ''}`} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                      Status Detail: 
                      <span className="text-indigo-600 font-mono font-black">{trackingOrder!.status}</span>
                      {trackingOrder!.type === 'Visa' && trackingOrder!.subStatus && (
                        (() => {
                          let label = trackingOrder!.subStatus;
                          let style = 'bg-slate-100 text-slate-800 border-slate-200';
                          if (trackingOrder!.subStatus === 'Standard Review') {
                            label = 'Document Check In-Progress';
                            style = 'bg-blue-50 text-blue-800 border-blue-200';
                          } else if (trackingOrder!.subStatus === 'More documents required') {
                            label = '⚠️ Additional Documents Required';
                            style = 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse';
                          } else if (trackingOrder!.subStatus === 'Standard processing') {
                            label = 'Standard Under Review';
                            style = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                          } else if (trackingOrder!.subStatus === 'Awaiting Paperwork') {
                            label = '⚠️ More Docs Required (Embassy Request)';
                            style = 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse';
                          } else if (trackingOrder!.subStatus === 'Approved') {
                            label = 'Approved & Issued';
                            style = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                          } else if (trackingOrder!.subStatus === 'Declined') {
                            label = 'Declined / Rejected';
                            style = 'bg-rose-100 text-rose-800 border-rose-200';
                          }
                          return (
                            <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${style}`}>
                              {label}
                            </span>
                          );
                        })()
                      )}
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{getStatusMessage(trackingOrder!)}</p>
                    
                    {trackingOrder!.type === 'Visa' && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2 text-[11px]">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Expected Result:</span>
                        <strong className="text-indigo-600 bg-indigo-50/50 border border-indigo-100 px-2 py-0.5 rounded font-mono font-black">
                          {getExpectedResultDate(trackingOrder!)}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assigned Physical Representative / Driver details */}
                {trackingOrder!.staffName && (
                  trackingOrder!.type === 'Visa' 
                    ? true 
                    : ['Staff Assigned', 'Flying', 'Passenger Greet', 'Completed'].includes(normalizeStatusForTimeline(trackingOrder!.status, trackingOrder!.type))
                ) && (
                  <div className="bg-gradient-to-r from-slate-50 to-indigo-50/20 border border-indigo-100 rounded-2xl p-4.5 space-y-3.5 shadow-sm mt-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-450 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                          {trackingOrder!.type === 'AirportPickup' ? 'Assigned Driver & Dispatch Vehicle' : 'Assigned Physical Escort Staff (PIC)'}
                        </span>
                      </div>
                      <span className="text-[8.5px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded uppercase font-mono">
                        Active Coordinator Sync
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {trackingOrder!.staffPhoto ? (
                        <img 
                           src={trackingOrder!.staffPhoto} 
                           alt={trackingOrder!.staffName} 
                           referrerPolicy="no-referrer"
                           className="h-12 w-12 rounded-full border border-slate-200 shadow-sm object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5" />
                        </div>
                      )}
                      <div className="space-y-1 flex-1 min-w-0">
                        <h4 className="font-display font-extrabold text-slate-800 text-xs">
                          {trackingOrder!.staffName}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-500">
                          {trackingOrder!.staffPhone && (
                            <span className="flex items-center gap-1">
                              <span>📞</span> <strong className="text-slate-700 select-all font-mono">{formatPhoneE164(trackingOrder!.staffPhone)}</strong>
                            </span>
                          )}
                          {trackingOrder!.staffLocation && (
                            <span className="flex items-center gap-1 truncate">
                              <span>📍</span> <span className="text-slate-700 font-semibold">{trackingOrder!.staffLocation}</span>
                            </span>
                          )}
                          {trackingOrder!.licensePlate && (
                            <span className="flex items-center gap-1 sm:col-span-2">
                              <span>🚘</span> Plate: <strong className="text-slate-800 font-mono select-all bg-white px-1.5 py-0.2 rounded border border-slate-200">{trackingOrder!.licensePlate}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {trackingOrder!.carPhoto && (
                      <div className="pt-2.5 border-t border-slate-150">
                        <div className="text-[8.5px] text-slate-400 uppercase font-black tracking-wider mb-1.5">Dispatch Fleet Vehicle Photo</div>
                        <img 
                           src={trackingOrder!.carPhoto} 
                           alt="Fleet Car" 
                           referrerPolicy="no-referrer"
                           className="w-full max-h-[160px] rounded-xl object-cover border border-slate-200 shadow-xs"
                        />
                      </div>
                    )}
                  </div>
                )}
                </div>
              )}

              {/* Unique Visual Voucher Layout */}
              <div className="border border-slate-150 rounded-2xl overflow-hidden bg-slate-50/50">
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono tracking-widest text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded uppercase font-black">
                      {selectedOrder.type}
                    </span>
                    <span className="text-xs font-bold">Secure Entry Pass</span>
                  </div>
                  <div className="flex items-center space-x-1 font-mono text-[9px] text-slate-400">
                    <VerifiedIcon className="h-3 w-3 text-emerald-400" />
                    <span>VERIFIED CO-CORRIDOR</span>
                  </div>
                </div>

                <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Left Specs */}
                  <div className="space-y-3.5 text-xs">
                    {selectedOrder.type === 'Visa' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Traveller Name</span>
                            <span className="font-bold text-slate-800">
                              {(selectedOrder.details as any).firstName} {(selectedOrder.details as any).lastName}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Country Need Visa</span>
                            <span className="font-bold text-slate-800">{(selectedOrder.details as any).destinationCountry || 'Vietnam'}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Passport Number</span>
                            <span className="font-bold text-slate-800 font-mono uppercase">{(selectedOrder.details as any).passportNumber}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Visa Class Type</span>
                            <span className="font-bold text-slate-800">
                              {(() => {
                                const isEn = language === 'EN';
                                const rawType = (selectedOrder.details as any).visaType || '';
                                const lower = rawType.toLowerCase();
                                if (lower.includes('multiple') || lower.includes('90 days') || lower.includes('trc')) {
                                  return isEn ? 'Multiple' : 'Nhiều lần';
                                }
                                return isEn ? 'Single' : 'Một lần';
                              })()}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Expected Arrival</span>
                            <span className="font-bold text-slate-800">{(selectedOrder.details as any).arrivalDate}</span>
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-slate-150">
                          <span className="text-indigo-600 block text-[10px] uppercase font-bold tracking-wide">Expected Date receive the result</span>
                          <span className="font-extrabold text-slate-800 flex items-center gap-1.5 mt-0.5">
                            <Calendar className="h-3.5 w-3.5 text-indigo-550 shrink-0" />
                            {getExpectedResultDate(selectedOrder)}
                          </span>
                        </div>
                      </>
                    )}

                    {selectedOrder.type === 'FastTrack' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Lead Contact</span>
                            <span className="font-bold text-slate-800">{(selectedOrder.details as any).contactName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Plan</span>
                            <span className="font-bold text-slate-800 text-xs">
                              {(() => {
                                const pkg = (selectedOrder.details as any).packageType;
                                if (pkg === 'VIP Meet & Assist' || pkg === 'Fast Track Standard') return 'Fast Track Standard';
                                if (pkg === 'Premium Fast Track' || pkg === 'Fast Track Business') return 'Fast Track Business';
                                if (pkg === 'Elite Lounges Gate-to-Gate' || pkg === 'Fast Track Vip' || pkg === 'Fast Track VIP') return 'Fast Track Vip';
                                return pkg || 'Fast Track Standard';
                              })()}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Service Direction</span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-teal-800 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-lg mt-0.5">
                              <span>{(selectedOrder.details as any).serviceDirection === 'Departure' ? '⬆️' : '⬇️'}</span>
                              <span>{(selectedOrder.details as any).serviceDirection || 'Arrival'}</span>
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">
                              {(selectedOrder.details as any).serviceDirection === 'Departure' ? 'Departure Airport' : 'Arrival Airport'}
                            </span>
                            <span className="font-bold text-slate-800 uppercase">{((selectedOrder.details as any).airport || 'Tan Son Nhat (SGN)').replace(/TSN/g, 'SGN')}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold font-sans">
                              {(selectedOrder.details as any).serviceDirection === 'Departure' ? 'Outbound Flight' : 'Inbound Flight'}
                            </span>
                            <span className="font-bold text-indigo-700 font-mono font-black uppercase">{(selectedOrder.details as any).airlineName} - {(selectedOrder.details as any).flightNumber}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">
                              {(selectedOrder.details as any).serviceDirection === 'Departure' ? 'Departure Date' : 'Arrival Date'}
                            </span>
                            <span className="font-bold text-slate-800 flex items-center">
                              <Calendar className="h-3 w-3 mr-1 text-slate-400" />
                              {(selectedOrder.details as any).arrivalDate}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">
                              {(selectedOrder.details as any).serviceDirection === 'Departure' ? 'Departure Time' : 'Landing Time'}
                            </span>
                            <span className="font-bold text-slate-800 flex items-center">
                              <Clock className="h-3 w-3 mr-1 text-slate-400" />
                              {(selectedOrder.details as any).arrivalTime}
                            </span>
                          </div>
                        </div>

                        {/* Combo Display Option inside My Orders */}
                        {(selectedOrder.details as any).addAirportPickup && (
                          <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1">
                            <div className="flex items-center space-x-1.5 text-indigo-700 font-extrabold text-[10px] uppercase tracking-wide">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Dual Combo Activated: Private Shuttle Added</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                              <div>
                                <span className="text-slate-400 block text-[9px] uppercase font-bold">Vehicle Class</span>
                                <span className="font-semibold text-slate-700">{(selectedOrder.details as any).selectedPickupVehicle || 'Private Sedan'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[9px] uppercase font-bold">Drop Destination</span>
                                <span className="font-semibold text-slate-700 truncate block">{(selectedOrder.details as any).pickupDestination || 'Specified drop address'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {selectedOrder.type === 'AirportPickup' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Lead Passenger</span>
                            <span className="font-bold text-slate-800">{(selectedOrder.details as any).passengerName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Selected Fleet</span>
                            <span className="font-bold text-slate-800">{(selectedOrder.details as any).vehicleType}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Service Direction</span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-teal-800 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-lg mt-0.5">
                              <span>{((selectedOrder.details as any).direction || (selectedOrder.details as any).serviceDirection) === 'Departure' ? '🛫 Departure' : '🛬 Arrival'}</span>
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Airport Port</span>
                            <span className="font-bold text-slate-800 truncate block">{((selectedOrder.details as any).airport || 'Tan Son Nhat (SGN)').replace(/TSN/g, 'SGN')}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Pickup Date</span>
                            <span className="font-bold text-slate-800 flex items-center text-xs">
                              <Calendar className="h-3 w-3 mr-1 text-slate-400 shrink-0" />
                              {(selectedOrder.details as any).pickupDate}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Pickup Time</span>
                            <span className="font-bold text-slate-800 flex items-center text-xs">
                              <Clock className="h-3 w-3 mr-1 text-slate-400 shrink-0" />
                              {(selectedOrder.details as any).pickupTime}
                            </span>
                          </div>
                        </div>

                        {((selectedOrder.details as any).direction || (selectedOrder.details as any).serviceDirection) !== 'Departure' && (
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Flight Number</span>
                              <span className="font-bold text-green-700 font-mono font-black uppercase">{(selectedOrder.details as any).flightNumber || 'N/A'}</span>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-4">
                          {((selectedOrder.details as any).direction || (selectedOrder.details as any).serviceDirection) === 'Departure' ? (
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold font-mono">Pickup Address</span>
                              <span className="font-bold text-slate-800 truncate block flex items-center">
                                <MapPin className="h-3.5 w-3.5 text-slate-400 mr-1 shrink-0" />
                                {(selectedOrder.details as any).pickupAddress || 'Specified pickup address'}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold font-mono">Drop Destination</span>
                              <span className="font-bold text-slate-800 truncate block flex items-center">
                                <MapPin className="h-3.5 w-3.5 text-slate-400 mr-1 shrink-0" />
                                {(selectedOrder.details as any).destinationAddress || 'Specified drop destination'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Combo Display Option inside My Orders */}
                        {(selectedOrder.details as any).addFastTrack && (
                          <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1">
                            <div className="flex items-center space-x-1.5 text-indigo-700 font-extrabold text-[10px] uppercase tracking-wide">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Dual Combo Activated: Fast Track Escort Added</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                              <div>
                                <span className="text-slate-400 block text-[9px] uppercase font-bold">Fast Track Class</span>
                                <span className="font-semibold text-slate-700">{(selectedOrder.details as any).fastTrackType || 'VIP Meet & Assist'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[9px] uppercase font-bold">Status</span>
                                <span className="font-semibold text-emerald-600">Bundled & Active</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* General Special Requests / Customer Note */}
                    {(() => {
                      const details = selectedOrder.details as any;
                      const note = details?.specialRequests || details?.optionalNote || details?.note;
                      if (!note) return null;
                      return (
                        <div className="pt-3 mt-3 border-t border-slate-200">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wide">Customer Notes / Special Requests</span>
                          <div className="mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] text-slate-600 italic leading-relaxed">
                            "{note}"
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Right receipts/payment details graphic */}
                  <div className="border-l border-dashed border-slate-200 pl-6 flex flex-col justify-between text-left">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">Transaction Receipt</span>
                        <div className="inline-flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[11px] font-bold border border-emerald-100">
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Payment Confirmed</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-semibold">Reference ID</span>
                          <span className="font-mono text-slate-700 select-all tracking-wide">{selectedOrder.id}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-semibold">Gateway / Status</span>
                          <span className="font-medium text-slate-700">{selectedOrder.paymentStatus || 'Paid (9Pay Secure)'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-semibold">Authorized Date</span>
                          <span className="font-medium text-slate-700">
                            {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }) : 'N/A'}
                          </span>
                        </div>
                      </div>


                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-200/60 w-full text-xs">
                      <div className="flex justify-between items-center bg-slate-100 rounded-xl p-3">
                        <span className="text-slate-500 font-medium">Authorized Fee Paid:</span>
                        <strong className="text-slate-900 font-extrabold font-display text-sm">{formatCharge((selectedOrder.details as any).totalFee, selectedOrder)}</strong>
                      </div>
                    </div>
                  </div>

                </div>
              </div>





              {/* Instant WhatsApp / Zalo contact support helper card */}
              <div className="bg-white border border-slate-150 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-0.5 text-center sm:text-left">
                  <h6 className="text-[12px] font-bold text-slate-800 uppercase tracking-wide">Status or details incorrect?</h6>
                  <p className="text-[11px] text-slate-500">Contact Digivisa instantly via WhatsApp or Zalo 24/7 to adjust passport information, flight times or vehicle details.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => safeOpen('https://wa.me/84999088888', '_blank')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-150 hover:bg-emerald-100 cursor-pointer transition-all active:scale-95"
                  >
                    WhatsApp Chat
                  </button>
                  <button 
                    onClick={() => safeOpen('https://zalo.me/84999088888', '_blank')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-sky-700 bg-sky-50 border border-sky-150 hover:bg-sky-100 cursor-pointer transition-all active:scale-95"
                  >
                    Zalo Chat
                  </button>
                </div>
              </div>

            </motion.div>
          ) : (
            <div className="bg-slate-50 rounded-3xl border-2 border-dashed border-slate-250 p-12 text-center text-slate-400 flex flex-col items-center justify-center min-h-[500px]">
              <ClipboardCheck className="h-16 w-16 text-slate-300 stroke-[1.2] mb-4 animate-pulse" />
              <h3 className="font-display font-bold text-slate-800 text-lg">Detailed Voucher View</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                Select any active order or visa code on the tracking card pane to view digital receipt vouchers, printing options, airport coordinates, and to mock active progression status timelines.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Icon helper since lucide-react uses different names or to avoid missing import
function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
