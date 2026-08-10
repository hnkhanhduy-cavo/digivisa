import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building, Users, MessageSquare, Send, CheckCircle, Clock, 
  Car, Plane, FileText, Check, AlertCircle, ArrowRight, 
  ExternalLink, Sparkles, User, HelpCircle, UserCheck, ShieldAlert,
  Search, Calendar, CreditCard, X, ArrowUpDown, ArrowDown, ArrowUp,
  Copy, Download
} from 'lucide-react';
import { Order, Currency, CURRENCY_SYMBOLS, EXCHANGE_RATES } from '../types';
import { getVietnamPricing } from '../utils/pricing';
import OMSAlertsBoard from './OMSAlertsBoard';
import OMSAgencyComms from './OMSAgencyComms';
import { safeStorage, safeOpen } from '../utils/storage';
import { getSplitOrders } from '../utils/orderUtils';
import { Language } from '../utils/translations';
import { formatPhoneE164 } from '../utils/validation';
import { auth } from '../utils/firebase';

interface OMSProps {
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  currency: Currency;
  language?: Language;
  onUpdateOrder?: (orderId: string, fields: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
}

// Separate partners specialized in exactly ONE service
const PARTNERS = {
  Visa: [
    { id: 'p_visa_1', name: 'Vietnam Legal Transit Co. Ltd', contact: 'Ms. Huong Nguyen', rating: '4.9', activeOrders: 14 },
    { id: 'p_visa_2', name: 'Noi Bai Direct Entry Escrows', contact: 'Mr. Tran Le', rating: '4.8', activeOrders: 8 },
  ],
  FastTrack: [
    { id: 'p_ft_1', name: 'Noi Bai VIP Airport Concierge Group', contact: 'Mr. Kevin Pham', rating: '4.95', activeOrders: 23 },
    { id: 'p_ft_2', name: 'Tan Son Nhat Gateway Elite Escorts', contact: 'Ms. Vy Nguyen', rating: '4.7', activeOrders: 5 },
  ],
  AirportPickup: [
    { id: 'p_ap_1', name: 'Luxury Fleet Hanoi Transport JSC', contact: 'Mr. David Hoang', rating: '4.9', activeOrders: 31 },
    { id: 'p_ap_2', name: 'HCMC Premium Chauffeured Logistics', contact: 'Mr. Nam Cao', rating: '4.6', activeOrders: 12 },
  ]
};

// Global simulated aerospace feed database for flight tracking bot agent
const FLIGHT_DATABASE: Record<string, {
  airline: string;
  aircraft: string;
  origin: string;
  dest: string;
  status: 'In Air' | 'Scheduled' | 'Landed' | 'Delayed';
  departure: string;
  arrival: string;
  progress: number;
  altitude: string;
  speed: string;
  terminal: string;
  gate: string;
  weather: string;
}> = {
  'UA869': {
    airline: 'United Airlines',
    aircraft: 'Boeing 787-9 Dreamliner',
    origin: 'San Francisco (SFO)',
    dest: 'Ho Chi Minh City (SGN)',
    status: 'In Air',
    departure: '23:30 PDT',
    arrival: '05:55 (+1) ICT',
    progress: 82,
    altitude: '38,000 ft',
    speed: '530 mph (852 km/h)',
    terminal: 'International Terminal 2',
    gate: 'Gate 22A',
    weather: 'Sunny, 28°C'
  },
  'JL751': {
    airline: 'Japan Airlines',
    aircraft: 'Boeing 777-300ER',
    origin: 'Tokyo Narita (NRT)',
    dest: 'Hanoi (HAN)',
    status: 'In Air',
    departure: '18:10 JST',
    arrival: '22:15 ICT',
    progress: 45,
    altitude: '36,000 ft',
    speed: '515 mph (828 km/h)',
    terminal: 'International Terminal 2',
    gate: 'Gate 112',
    weather: 'Light Rain, 22°C'
  },
  'SQ172': {
    airline: 'Singapore Airlines',
    aircraft: 'Airbus A350-900',
    origin: 'Singapore Changi (SIN)',
    dest: 'Da Nang (DAD)',
    status: 'Landed',
    departure: '09:15 SGT',
    arrival: '11:05 ICT',
    progress: 100,
    altitude: '0 ft (Grounded)',
    speed: 'Taxiing',
    terminal: 'Terminal 2',
    gate: 'Gate 6',
    weather: 'Partly Cloudy, 31°C'
  },
  'EK392': {
    airline: 'Emirates',
    aircraft: 'Boeing 777-300ER',
    origin: 'Dubai Intl (DXB)',
    dest: 'Ho Chi Minh City (SGN)',
    status: 'In Air',
    departure: '09:40 GST',
    arrival: '19:35 ICT',
    progress: 60,
    altitude: '39,000 ft',
    speed: '542 mph (872 km/h)',
    terminal: 'International Terminal 2',
    gate: 'Gate 18',
    weather: 'Humid, 29°C'
  },
  'SQ176': {
    airline: 'Singapore Airlines',
    aircraft: 'Boeing 787-10',
    origin: 'Singapore Changi (SIN)',
    dest: 'Ho Chi Minh City (SGN)',
    status: 'In Air',
    departure: '17:50 SGT',
    arrival: '19:05 ICT',
    progress: 75,
    altitude: '34,000 ft',
    speed: '505 mph (812 km/h)',
    terminal: 'International Terminal 2',
    gate: 'Gate 15',
    weather: 'Intermittent Rain, 27°C'
  },
  'VN542': {
    airline: 'Vietnam Airlines',
    aircraft: 'Airbus A350-900',
    origin: 'London Heathrow (LHR)',
    dest: 'Hanoi (HAN)',
    status: 'Scheduled',
    departure: '11:10 BST',
    arrival: '04:30 (+1) ICT',
    progress: 0,
    altitude: '0 ft (Gate)',
    speed: '0 mph',
    terminal: 'Terminal 2',
    gate: 'Gate 28',
    weather: 'Overcast, 21°C'
  },
  'QF083': {
    airline: 'Qantas Airways',
    aircraft: 'Airbus A330-200',
    origin: 'Sydney Kingsford (SYD)',
    dest: 'Ho Chi Minh City (SGN)',
    status: 'In Air',
    departure: '10:00 AEST',
    arrival: '16:15 ICT',
    progress: 30,
    altitude: '37,000 ft',
    speed: '510 mph (820 km/h)',
    terminal: 'International Terminal 2',
    gate: 'Gate 20',
    weather: 'Clear Sky, 30°C'
  },
  'AI346': {
    airline: 'Air India',
    aircraft: 'Airbus A320neo',
    origin: 'Delhi Intl (DEL)',
    dest: 'Ho Chi Minh City (SGN)',
    status: 'Delayed',
    departure: '14:20 IST',
    arrival: '20:30 ICT',
    progress: 10,
    altitude: '32,005 ft',
    speed: '495 mph (796 km/h)',
    terminal: 'International Terminal 2',
    gate: 'Gate 12',
    weather: 'Very Warm, 32°C'
  }
};



/**
 * Single source of truth for exporting order details (Text, TXT file, CSV, Clipboard).
 * Consolidates customer info extraction and returns standard field pairs by service type.
 */
function buildOrderExportFields(order: any): Array<{ label: string; value: string }> {
  if (!order) return [];

  const d = (order.details as any) || {};

  // Generic field lookup helper with fallbacks
  const getF = (obj: any, keys: string[], def: string = 'Chưa có') => {
    if (!obj) return def;
    for (const k of keys) {
      if (
        obj[k] !== undefined &&
        obj[k] !== null &&
        String(obj[k]).trim() !== '' &&
        String(obj[k]).trim() !== 'undefined' &&
        String(obj[k]).trim() !== 'null' &&
        String(obj[k]).trim() !== 'N/A'
      ) {
        return String(obj[k]).trim();
      }
    }
    return def;
  };

  // Determine effective service type (handles combo secondary legs)
  const isSecLeg = order.id ? order.id.endsWith('_secondary') : false;
  const effectiveType = isSecLeg
    ? (order.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack')
    : (order.type || 'Visa');

  // Extract customer name
  const custName = (() => {
    const direct = getF(d, ['passengerName', 'fullName', 'name', 'clientName', 'customerName', 'contactName'], '');
    if (direct) return direct.toUpperCase();
    const fn = getF(d, ['firstName', 'givenName', 'first_name'], '');
    const ln = getF(d, ['lastName', 'familyName', 'surname', 'last_name'], '');
    if (fn || ln) return `${fn} ${ln}`.trim().toUpperCase();
    const root = getF(order, ['passengerName', 'fullName', 'name', 'userName'], '');
    if (root) return root.toUpperCase();
    return 'CHƯA CÓ';
  })();

  const custPhone = getF(d, ['phone', 'phoneNumber', 'contactPhone', 'passengerPhone', 'mobile', 'tel', 'phoneNo'], getF(order, ['phone', 'phoneNumber'], 'Chưa có'));
  const custEmail = getF(d, ['email', 'contactEmail', 'passengerEmail', 'userEmail', 'mail'], getF(order, ['email', 'userEmail'], 'Chưa có'));
  const paymentStatus = order.paymentStatus || 'Chưa có';

  if (effectiveType === 'Visa') {
    return [
      { label: 'Mã đơn', value: order.id || 'Chưa có' },
      { label: 'Loại dịch vụ', value: 'Visa' },
      { label: 'Họ tên khách', value: custName },
      { label: 'Số hộ chiếu', value: getF(d, ['passportNumber', 'passportNo', 'passportCode', 'passport'], getF(order, ['passportNumber', 'passportNo'], 'Chưa có')) },
      { label: 'Ngày hết hạn hộ chiếu', value: getF(d, ['passportExpiry', 'expiryDate'], 'Chưa có') },
      { label: 'Ngày sinh', value: getF(d, ['dateOfBirth', 'dob'], 'Chưa có') },
      { label: 'Quốc tịch', value: getF(d, ['nationality', 'country'], 'Chưa có') },
      { label: 'Loại visa', value: getF(d, ['visaType', 'type'], 'Single eVisa') },
      { label: 'Gói xử lý', value: d.resultsOption === 'same_day' ? 'Xử lý Khẩn Trong Ngày' : getF(d, ['processingSpeed', 'speed'], 'Tiêu chuẩn') },
      { label: 'Ngày nhập cảnh dự kiến', value: getF(d, ['arrivalDate', 'entryDate'], 'Chưa có') },
      { label: 'SĐT', value: custPhone },
      { label: 'Email', value: custEmail },
      { label: 'Thanh toán', value: paymentStatus },
    ];
  }

  if (effectiveType === 'FastTrack') {
    return [
      { label: 'Mã đơn', value: order.id || 'Chưa có' },
      { label: 'Loại dịch vụ', value: 'Fast Track' },
      { label: 'Họ tên khách', value: custName },
      { label: 'Số hiệu chuyến bay', value: getF(d, ['flightNumber', 'flightNo'], 'Chưa có') },
      { label: 'Hãng bay', value: getF(d, ['airline', 'airlineName'], 'Chưa có') },
      { label: 'Ngày hạ cánh', value: getF(d, ['arrivalDate', 'flightDate', 'date'], 'Chưa có') },
      { label: 'Giờ hạ cánh', value: getF(d, ['arrivalTime', 'flightTime', 'time'], 'Chưa có') },
      { label: 'Sân bay', value: getF(d, ['airport', 'airportCode'], 'SGN - Tân Sơn Nhất') },
      { label: 'Nhà ga', value: getF(d, ['terminal', 'terminalNo'], 'Chưa có') },
      { label: 'Số khách', value: getF(d, ['passengerCount', 'passengers', 'guests'], '1 người') },
      { label: 'Gói dịch vụ', value: getF(d, ['serviceTier', 'fastTrackOption', 'tier'], 'Standard Fast-Track Escort') },
      { label: 'SĐT', value: custPhone },
      { label: 'Email', value: custEmail },
      { label: 'Yêu cầu đặc biệt', value: getF(d, ['specialRequests', 'notes', 'remark', 'optionalNote'], 'Chưa có') },
      { label: 'Thanh toán', value: paymentStatus },
    ];
  }

  // AirportPickup (Đưa đón)
  return [
    { label: 'Mã đơn', value: order.id || 'Chưa có' },
    { label: 'Loại dịch vụ', value: 'Đưa đón' },
    { label: 'Họ tên khách', value: custName },
    { label: 'Số hiệu chuyến bay', value: getF(d, ['flightNumber', 'flightNo'], 'Chưa có') },
    { label: 'Ngày đón', value: getF(d, ['pickupDate', 'arrivalDate', 'date'], 'Chưa có') },
    { label: 'Giờ đón', value: getF(d, ['pickupTime', 'arrivalTime', 'time'], 'Chưa có') },
    { label: 'Sân bay', value: getF(d, ['airport', 'airportCode'], 'SGN - Tân Sơn Nhất') },
    { label: 'Nhà ga', value: getF(d, ['terminal', 'terminalNo'], 'Chưa có') },
    { label: 'Địa chỉ đón', value: getF(d, ['pickupAddress', 'departureAddress', 'address'], 'Chưa có') },
    { label: 'Địa chỉ trả', value: getF(d, ['destinationAddress', 'dropoffAddress', 'address'], 'Chưa có') },
    { label: 'Loại xe', value: getF(d, ['vehicleType', 'carOption', 'carType'], 'Comfort SUV (5-7 Chỗ)') },
    { label: 'Số hành lý', value: getF(d, ['luggageCount', 'luggage'], 'Chưa có') },
    { label: 'Số khách', value: getF(d, ['passengerCount', 'passengers'], '1 người') },
    { label: 'SĐT', value: custPhone },
    { label: 'Email', value: custEmail },
    { label: 'Yêu cầu đặc biệt', value: getF(d, ['specialRequests', 'notes', 'remark', 'optionalNote'], 'Chưa có') },
    { label: 'Thanh toán', value: paymentStatus },
  ];
}

import { getServiceStatusOptions, getStatusLabel, getSubStatusLabel, getSubStatusOptions, normalizeStatusForTimeline, getTimelineStepsForOrder } from '../utils/orderStatus';

export default function OMS({ orders, setOrders, currency, language = 'EN', onUpdateOrder }: OMSProps) {
  // Filter only paid orders for OMS
  const paidOrders = React.useMemo(() => {
    return (orders || []).filter(o => o.paymentStatus && String(o.paymentStatus).startsWith('Paid'));
  }, [orders]);

  // Master navigation subpage: fulfillment queue vs. urgent alerts board vs. agency comms sync
  const [omsSubPage, setOmsSubPage] = useState<'fulfillment' | 'alerts_board' | 'agency_comms'>('fulfillment');

  // Tabs representing separate partner spaces
  const [partnerServiceTab, setPartnerServiceTab] = useState<'All' | 'Visa' | 'FastTrack' | 'AirportPickup' | 'VAT'>('All');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'created_desc' | 'created_asc' | 'service_desc' | 'service_asc'>('created_desc');
  const [hoveredStepName, setHoveredStepName] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; filename: string } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewImage(null);
      }
    };
    if (previewImage) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);
  // Derived map for partner assignment directly from server orders list
  const assignedPartners = React.useMemo(() => {
    const map: Record<string, string> = {};
    (paidOrders || []).forEach((o: any) => {
      if (o.assignedPartnerId) {
        map[o.id] = o.assignedPartnerId;
      }
      if (o.assignedPartnerIdSecondary) {
        map[o.id + '_secondary'] = o.assignedPartnerIdSecondary;
      }
    });
    return map;
  }, [paidOrders]);

  // Derived discussions / internal ops notes from orders list
  const discussions = React.useMemo(() => {
    const map: Record<string, Array<{ sender: 'digivisa' | 'partner' | 'system', text: string, timestamp: string, by?: string, leg?: 'primary' | 'secondary' }>> = {};

    (orders || []).forEach(o => {
      const baseId = o.id;
      const primaryKey = baseId;
      const secondaryKey = `${baseId}_secondary`;

      map[primaryKey] = [];
      map[secondaryKey] = [];

      // Add system creation note if order is paid
      if (o.paymentStatus && String(o.paymentStatus).startsWith('Paid')) {
        map[primaryKey].push({
          sender: 'system',
          text: `Đơn hàng #${baseId} đã thanh toán thành công và chuyển vào quy trình xử lý.`,
          timestamp: o.createdAt || new Date().toISOString()
        });
      }

      // Populate from opsNotes array
      const opsNotes = (o as any).opsNotes || [];
      opsNotes.forEach((n: any) => {
        const key = n.leg === 'secondary' ? secondaryKey : primaryKey;
        if (!map[key]) map[key] = [];
        map[key].push({
          sender: n.by ? 'digivisa' : 'system',
          text: n.text,
          timestamp: n.at || new Date().toISOString(),
          by: n.by,
          leg: n.leg
        });
      });
    });

    return map;
  }, [orders]);

  const [chatInput, setChatInput] = useState('');



  // Helper getters for consolidated tabular layout
  const getCustomerName = (order: Order) => {
    const details = order.details as any;
    if (!details) return 'N/A';
    if (order.type === 'Visa') {
      return `${details.firstName || ''} ${details.lastName || ''}`.trim() || 'No Name';
    }
    return details.contactName || details.passengerName || 'No Name';
  };

  const getCustomerPhone = (order: Order) => {
    const details = order.details as any;
    if (!details) return 'N/A';
    const raw = order.type === 'Visa' ? details.phone : (details.contactPhone || details.passengerPhone);
    return raw ? formatPhoneE164(raw) : 'N/A';
  };

  const getServiceDate = (order: Order) => {
    const details = order.details as any;
    if (!details) return 'N/A';
    if (order.type === 'Visa') {
      return details.arrivalDate || 'N/A';
    }
    return details.arrivalDate || details.pickupDate || 'N/A';
  };

  const getServiceDetailsInfo = (order: Order) => {
    const details = order.details as any;
    if (!details) return 'N/A';
    if (order.type === 'Visa') {
      const dest = details.destinationCountry || 'Vietnam';
      const vType = details.visaType || 'Single';
      if (dest !== 'Vietnam') {
        if (vType === 'Tourist (90 Days)' || vType === 'Multiple eVisa' || vType === 'Multiple') return 'Multiple';
        return 'Single';
      }
      return vType;
    } else if (order.type === 'FastTrack') {
      const pkg = details.packageType;
      let mappedPkg = 'Fast Track Standard';
      if (pkg === 'VIP Meet & Assist' || pkg === 'Fast Track Standard') mappedPkg = 'Fast Track Standard';
      else if (pkg === 'Premium Fast Track' || pkg === 'Fast Track Business') mappedPkg = 'Fast Track Business';
      else if (pkg === 'Elite Lounges Gate-to-Gate' || pkg === 'Fast Track Vip' || pkg === 'Fast Track VIP') mappedPkg = 'Fast Track Vip';
      else if (pkg) mappedPkg = pkg;
      return `${mappedPkg} (${details.serviceDirection || 'Arrival'})`;
    } else {
      return `${details.vehicleType || '4 Seats'} car (${details.direction || 'Arrival'})`;
    }
  };

  // Filter orders by active service tab & search input
  const tabOrders = getSplitOrders(paidOrders).filter(o => {
    const matchesTab = partnerServiceTab === 'All' 
      ? true 
      : partnerServiceTab === 'VAT'
        ? (o.details as any).wantsInvoice === true
        : o.type === partnerServiceTab;
    if (!matchesTab) return false;
    
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.trim().toLowerCase();
    const details = (o.details || {}) as any;
    const leadName = o.type === 'Visa' 
      ? `${details.firstName || ''} ${details.lastName || ''}`.toLowerCase() 
      : (details.contactName || details.passengerName || '').toLowerCase();

    const qDigits = query.replace(/\D/g, '');
    let matchesPhone = false;
    if (qDigits.length >= 3) {
      const phoneList = [
        details.contactPhone,
        details.passengerPhone,
        details.phone
      ];
      const normQ = qDigits.startsWith('84') ? '0' + qDigits.slice(2) : qDigits;
      for (const ph of phoneList) {
        if (ph && typeof ph === 'string' && ph.toLowerCase() !== 'n/a') {
          const phDigits = ph.replace(/\D/g, '');
          if (phDigits.length > 0) {
            if (phDigits.includes(qDigits)) {
              matchesPhone = true;
              break;
            }
            const normPh = phDigits.startsWith('84') ? '0' + phDigits.slice(2) : phDigits;
            if (normPh.includes(normQ)) {
              matchesPhone = true;
              break;
            }
          }
        }
      }
    }

    return o.id.toLowerCase().includes(query) || 
           leadName.includes(query) ||
           matchesPhone ||
           (details.contactEmail || details.passengerEmail || details.email || '').toLowerCase().includes(query);
  });

  // Format creation timestamp helper
  const formatCreatedAt = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Sort orders based on selected sort order
  const sortedTabOrders = [...tabOrders].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

    if (sortOrder === 'created_desc') {
      return (timeB || 0) - (timeA || 0);
    }
    if (sortOrder === 'created_asc') {
      return (timeA || 0) - (timeB || 0);
    }
    if (sortOrder === 'service_desc') {
      const dateA = new Date(getServiceDate(a) || 0).getTime() || 0;
      const dateB = new Date(getServiceDate(b) || 0).getTime() || 0;
      return dateB - dateA;
    }
    if (sortOrder === 'service_asc') {
      const dateA = new Date(getServiceDate(a) || 0).getTime() || 0;
      const dateB = new Date(getServiceDate(b) || 0).getTime() || 0;
      return dateA - dateB;
    }
    return 0;
  });

  // Helper formats
  const formatMoney = (usdAmount: any, order?: Order) => {
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

  const getStatusBadgeStyle = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('agency review')) return 'bg-amber-50 text-amber-850 border-amber-200/80 font-bold';
    if (s.includes('passenger greet')) return 'bg-blue-50 text-blue-800 border-blue-200/80 font-bold';
    if (s.includes('confirmed')) return 'bg-blue-50 text-blue-800 border-blue-200 font-semibold';
    if (s.includes('embassy')) return 'bg-violet-50 text-violet-800 border-violet-200';
    if (s.includes('processing')) return 'bg-indigo-50/70 text-indigo-800 border-indigo-200/60';
    if (s.includes('assigned')) return 'bg-sky-50/70 text-sky-800 border-sky-200';
    if (s.includes('flying')) return 'bg-teal-50 text-teal-800 border-teal-200/60';
    if (s.includes('delay')) return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
    if (s.includes('on time')) return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold';
    if (s.includes('completed') || s.includes('approved')) return 'bg-emerald-50 text-emerald-850 border-emerald-250/60 font-bold';
    if (s.includes('pending')) return 'bg-amber-50/70 text-amber-800 border-amber-200';
    if (s.includes('resubmission')) return 'bg-rose-50 text-rose-700 border-rose-300 font-extrabold';
    if (s.includes('transit')) return 'bg-blue-50/70 text-blue-805 border-blue-200';
    if (s.includes('cancelled')) return 'bg-rose-50 text-rose-800 border-rose-200 font-extrabold';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const handleDispatch = async (orderId: string, partnerId: string) => {
    const isSec = orderId.endsWith('_secondary');
    const baseId = isSec ? orderId.replace('_secondary', '') : orderId;

    const splitOrders = getSplitOrders(paidOrders);
    const targetOrder = splitOrders.find(o => o.id === orderId);
    if (!targetOrder) return;
    const orderType = targetOrder.type;
    const realOrder = paidOrders.find(o => o.id === baseId);

    const partnerObj = PARTNERS[orderType]?.find(p => p.id === partnerId);
    const partnerName = partnerObj?.name || 'Partner';
    const nowIso = new Date().toISOString();
    const staffEmail = auth.currentUser?.email || 'staff';

    const existingNotes = (realOrder as any)?.opsNotes || [];
    const dispatchNote = {
      text: `System update: Order dispatched to partner ${partnerName}.`,
      by: '',
      at: nowIso,
      leg: (isSec ? 'secondary' : 'primary') as 'primary' | 'secondary'
    };

    if (isSec) {
      const payload: any = {
        assignedPartnerIdSecondary: partnerId,
        assignedPartnerNameSecondary: partnerName,
        assignedPartnerAtSecondary: nowIso,
        assignedPartnerBySecondary: staffEmail,
        opsNotes: [...existingNotes, dispatchNote],
      };
      if (realOrder && (realOrder.secondaryStatus === 'Confirmed' || !realOrder.secondaryStatus)) {
        payload.secondaryStatus = 'Staff Assigned';
      }
      await onUpdateOrder?.(baseId, payload);
    } else {
      const payload: any = {
        assignedPartnerId: partnerId,
        assignedPartnerName: partnerName,
        assignedPartnerAt: nowIso,
        assignedPartnerBy: staffEmail,
        opsNotes: [...existingNotes, dispatchNote],
      };
      if (realOrder && realOrder.status === 'Confirmed') {
        payload.status = realOrder.type === 'Visa' ? 'Agency Review' : 'Staff Assigned';
      }
      await onUpdateOrder?.(baseId, payload);
    }
  };

  const handleSecondaryDispatch = async (orderId: string, partnerId: string) => {
    const targetOrder = paidOrders.find(o => o.id === orderId);
    if (!targetOrder) return;
    const secondaryType = targetOrder.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack';
    const partnerObj = PARTNERS[secondaryType]?.find(p => p.id === partnerId);
    const partnerName = partnerObj?.name || 'Secondary Partner';
    const nowIso = new Date().toISOString();
    const staffEmail = auth.currentUser?.email || 'staff';

    const existingNotes = (targetOrder as any)?.opsNotes || [];
    const secDispatchNote = {
      text: `System update: Combo service leg dispatched to secondary partner ${partnerName}.`,
      by: '',
      at: nowIso,
      leg: 'secondary' as const
    };

    const payload: any = {
      assignedPartnerIdSecondary: partnerId,
      assignedPartnerNameSecondary: partnerName,
      assignedPartnerAtSecondary: nowIso,
      assignedPartnerBySecondary: staffEmail,
      opsNotes: [...existingNotes, secDispatchNote],
    };
    if (targetOrder.secondaryStatus === 'Confirmed' || !targetOrder.secondaryStatus) {
      payload.secondaryStatus = 'Staff Assigned';
    }

    await onUpdateOrder?.(orderId, payload);
  };

  const handleUnassign = async (targetKey: string) => {
    const isSec = targetKey.endsWith('_secondary');
    const baseId = isSec ? targetKey.replace('_secondary', '') : targetKey;

    const isEn = language === 'EN';
    const confirmMsg = isEn 
      ? 'Are you sure you want to unassign this partner?' 
      : 'Bạn có chắc chắn muốn huỷ phân công đối tác này?';

    if (!window.confirm(confirmMsg)) return;

    if (isSec) {
      await onUpdateOrder?.(baseId, {
        assignedPartnerIdSecondary: null,
        assignedPartnerNameSecondary: null,
        assignedPartnerAtSecondary: null,
        assignedPartnerBySecondary: null
      });
    } else {
      await onUpdateOrder?.(baseId, {
        assignedPartnerId: null,
        assignedPartnerName: null,
        assignedPartnerAt: null,
        assignedPartnerBy: null
      });
    }
  };

  const setAssignedPartners = (action: any) => {
    let newObj: Record<string, string> = {};
    if (typeof action === 'function') {
      newObj = action(assignedPartners);
    } else {
      newObj = action;
    }

    const isEn = language === 'EN';

    Object.keys(newObj).forEach(key => {
      const pId = newObj[key];
      if (pId && assignedPartners[key] !== pId) {
        if (assignedPartners[key]) {
          alert(isEn 
            ? 'This order already has a partner. Unassign before reassigning.'
            : 'Đơn này đã có đối tác. Hãy huỷ phân công trước khi giao cho bên khác.'
          );
          return;
        }

        if (key.endsWith('_secondary')) {
          handleSecondaryDispatch(key.replace('_secondary', ''), pId);
        } else {
          handleDispatch(key, pId);
        }
      }
    });
  };

  const handlePostMessage = async (orderId: string) => {
    if (!chatInput.trim()) return;
    const isSec = orderId.endsWith('_secondary');
    const baseId = isSec ? orderId.replace('_secondary', '') : orderId;
    const parentOrder = (orders || []).find(o => o.id === baseId);
    const existingNotes = (parentOrder as any)?.opsNotes || [];

    const newNote = {
      text: chatInput.trim(),
      by: auth.currentUser?.email || 'Operations',
      at: new Date().toISOString(),
      leg: (isSec ? 'secondary' : 'primary') as 'primary' | 'secondary'
    };

    const updatedOpsNotes = [...existingNotes, newNote];
    setChatInput('');

    if (onUpdateOrder) {
      await onUpdateOrder(baseId, { opsNotes: updatedOpsNotes });
    }
  };

  const handleQueryFlightStatus = (orderId: string, flightNo: string) => {
    const isSec = orderId.endsWith('_secondary');
    const baseId = isSec ? orderId.replace('_secondary', '') : orderId;
    const parentOrder = (orders || []).find(o => o.id === baseId);
    const existingNotes = (parentOrder as any)?.opsNotes || [];

    const scanNote = {
      text: `🤖 [AI Flight Tracker] RUNNING: Initiating satellite telemetry link on Flight ${flightNo.toUpperCase()}...`,
      by: '',
      at: new Date().toISOString(),
      leg: (isSec ? 'secondary' : 'primary') as 'primary' | 'secondary'
    };

    onUpdateOrder?.(baseId, { opsNotes: [...existingNotes, scanNote] });

    // Mock delay then post telemetry result system note
    setTimeout(() => {
      const standardCode = flightNo.toUpperCase().trim();
      const details = FLIGHT_DATABASE[standardCode] || {
        airline: 'Commercial Carrier',
        aircraft: 'Passenger Jet',
        origin: 'International Airport',
        dest: 'Vietnam Arrival Gate',
        status: 'In Air' as const,
        departure: 'On Schedule Time',
        arrival: 'Estimated landing boards',
        progress: 60,
        altitude: '35,000 ft',
        speed: '510 mph (820 km/h)',
        terminal: 'Terminal 2',
        gate: 'Gate TBA',
        weather: 'Fair, 29°C'
      };

      const latestParent = (orders || []).find(o => o.id === baseId);
      const latestNotes = (latestParent as any)?.opsNotes || [...existingNotes, scanNote];

      const resultNote = {
        text: `🤖 [AI Flight Tracker] RESULT: ${standardCode} (${details.airline}). Status: ${details.status}, Arrival: ${details.arrival}, Terminal/Gate: ${details.terminal}/${details.gate}`,
        by: '',
        at: new Date().toISOString(),
        leg: (isSec ? 'secondary' : 'primary') as 'primary' | 'secondary'
      };

      onUpdateOrder?.(baseId, { opsNotes: [...latestNotes, resultNote] });
    }, 1500);
  };

  const toggleChecklist = (orderId: string, itemKey: string) => {
    const isSec = orderId.endsWith('_secondary');
    const baseId = isSec ? orderId.replace('_secondary', '') : orderId;
    const baseOrder = (orders || paidOrders || []).find((o) => o.id === baseId);
    if (!baseOrder) return;

    const currentChecklist = (isSec ? baseOrder.checklistSecondary : baseOrder.checklist) || {};
    const updatedChecklist = {
      ...currentChecklist,
      [itemKey]: !currentChecklist[itemKey]
    };

    const fieldKey = isSec ? 'checklistSecondary' : 'checklist';
    onUpdateOrder?.(baseId, { [fieldKey]: updatedChecklist });
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    let statusToSet = newStatus;
    if (newStatus === 'Delay / On Time') {
      statusToSet = 'On Time';
    }
    const isSec = orderId.endsWith('_secondary');
    const baseId = isSec ? orderId.replace('_secondary', '') : orderId;

    if (isSec) {
      await onUpdateOrder?.(baseId, { secondaryStatus: statusToSet });
    } else {
      let subStatus: string | null = null;
      const targetOrder = orders.find(o => o.id === baseId);
      if (targetOrder && targetOrder.type === 'Visa') {
        if (statusToSet === 'Processing') {
          subStatus = targetOrder.subStatus || 'Standard processing';
        } else if (statusToSet === 'Completed') {
          subStatus = targetOrder.subStatus || 'Approved';
        } else {
          subStatus = null;
        }
      }
      await onUpdateOrder?.(baseId, {
        status: statusToSet,
        subStatus
      });
    }
  };

  const updateOrderSubStatus = async (orderId: string, subStatus: string) => {
    const isSec = orderId.endsWith('_secondary');
    const baseId = isSec ? orderId.replace('_secondary', '') : orderId;

    if (isSec) {
      await onUpdateOrder?.(baseId, { secondarySubStatus: subStatus });
    } else {
      await onUpdateOrder?.(baseId, { subStatus });
    }
  };

  const getTimelineSteps = (type: 'Visa' | 'FastTrack' | 'AirportPickup', currentStatus: string, order?: Order) => {
    const timelineSteps = getTimelineStepsForOrder(type);
    const flowStepIds = timelineSteps.map((s) => s.id);

    const normalizedCurrentStatus = normalizeStatusForTimeline(currentStatus, type);
    const isException = !flowStepIds.includes(normalizedCurrentStatus);
    let steps = [...flowStepIds];
    let currentIndex = flowStepIds.indexOf(normalizedCurrentStatus);

    if (isException) {
      steps.push(currentStatus);
      currentIndex = steps.length - 1;
    }

    return { steps, currentIndex, isException };
  };

  const renderHorizontalProgressTrack = (order: Order) => {
    const { steps, currentIndex, isException } = getTimelineSteps(order.type as any, order.status, order);
    
    // Percentage to fill the connecting bar
    const ratio = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 0;

    return (
      <div className="flex flex-col space-y-4 bg-slate-50/60 rounded-2xl border border-slate-200 p-4 shadow-sm select-none">
        <div className="flex justify-between items-center text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Fulfillment Progress Tracker
          </span>
          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
            isException 
              ? 'text-rose-700 bg-rose-50 border-rose-200' 
              : 'text-indigo-700 bg-indigo-50 border-indigo-100/50'
          }`}>
            {isException ? 'Exception State' : `Step ${currentIndex + 1} of ${steps.length}`}
          </span>
        </div>

        {/* Status display label with seamless hover feedback */}
        <div className="h-10 flex flex-col justify-center bg-white rounded-xl border border-slate-100 px-3 py-1.5 shadow-sm">
          {hoveredStepName ? (
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-bold text-indigo-505 uppercase tracking-wider">Milestone:</span>
              <span className="text-xs font-extrabold text-slate-800">{hoveredStepName}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Current Status:</span>
              <span className={`text-xs font-extrabold flex items-center gap-1.5 ${
                order.status === 'Cancelled' || order.status === 'Declined'
                  ? 'text-rose-600'
                  : 'text-slate-900'
              }`}>
                {order.status === 'Cancelled' ? (
                  <AlertCircle className="h-3.5 w-3.5 text-rose-500 inline shrink-0" />
                ) : order.status === 'Declined' ? (
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-500 inline shrink-0" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-indigo-505 inline shrink-0" />
                )}
                <span className="flex items-center gap-1.5 flex-wrap">
                  <span>{normalizeStatusForTimeline(order.status, order.type)}</span>
                  {order.type === 'Visa' && order.subStatus && (
                    <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                      order.subStatus === 'Awaiting Paperwork'
                        ? 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse'
                        : order.subStatus === 'Approved'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : order.subStatus === 'Declined'
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                    }`}>
                      {order.subStatus === 'Awaiting Paperwork' ? 'Additional Documents Required' : order.subStatus === 'Standard processing' ? 'Standard Under Review' : order.subStatus === 'Approved' ? 'Approved & Issued' : 'Declined / Rejected'}
                    </span>
                  )}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Horizontal Track Area */}
        <div className="relative w-full py-1">
          <div className="relative flex items-center justify-between w-full px-4 h-7">
            {/* Background Gray Line (Center of Circle 1 [left-30px] to center of Last Circle [right-30px]) */}
            <div className="absolute left-[30px] right-[30px] top-1/2 -translate-y-1/2 h-1 bg-slate-200 rounded-full z-0" />
            
            {/* Colored Filled Connection Line */}
            <div className="absolute left-[30px] right-[30px] top-1/2 -translate-y-1/2 h-1 z-0 overflow-hidden rounded-full pointer-events-none">
              <div 
                className={`h-full transition-all duration-300 rounded-full ${
                  isException ? 'bg-rose-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${ratio}%` }}
              />
            </div>

            {steps.map((stepName, idx) => {
              const isCompleted = idx < currentIndex;
              const isActive = idx === currentIndex;
              const isFuture = idx > currentIndex;

              // Generate customized styles for each node type
              let circleClass = '';
              let innerContent = null;

              if (isException && isActive) {
                circleClass = 'bg-rose-500 border-2 border-rose-100 ring-4 ring-rose-500/20 text-white';
                innerContent = <AlertCircle className="h-3 w-3 shrink-0" />;
              } else if (isCompleted) {
                circleClass = 'bg-emerald-500 text-white ring-2 ring-emerald-500/20';
                innerContent = <Check className="h-3 w-3 shrink-0" strokeWidth={3} />;
              } else if (isActive) {
                circleClass = 'bg-indigo-600 border-2 border-indigo-100 ring-4 ring-indigo-500/30 text-white font-black';
                innerContent = <span className="text-[10px] leading-none shrink-0">{idx + 1}</span>;
              } else {
                circleClass = 'bg-white border-2 border-slate-300 text-slate-500';
                innerContent = <span className="text-[10px] leading-none shrink-0">{idx + 1}</span>;
              }

              return (
                <div 
                  key={stepName}
                  onMouseEnter={() => setHoveredStepName(stepName)}
                  onMouseLeave={() => setHoveredStepName(null)}
                  className="relative flex items-center justify-center cursor-pointer group z-10"
                >
                  {/* Node Interactive Circle */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${circleClass}`}>
                    {innerContent}
                  </div>

                  {/* Micro tooltip label for individual steps */}
                  <span className="absolute top-8 opacity-0 group-hover:opacity-100 transition-all bg-slate-950 text-white text-[9.5px] font-bold px-2.5 py-1 rounded-xl shadow-md whitespace-nowrap z-50 pointer-events-none scale-90 translate-y-1 group-hover:translate-y-0 group-hover:scale-100 duration-150 border border-slate-800">
                    {stepName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const selectedOrder = getSplitOrders(paidOrders).find(o => o.id === selectedOrderId);
  const selectedOrderPartner = selectedOrder ? PARTNERS[selectedOrder.type].find(p => p.id === assignedPartners[selectedOrder.id]) : null;
  const selectedOrderDiscussion = selectedOrder ? (discussions[selectedOrder.id] || []) : [];
  const selectedOrderChecklist = (() => {
    if (!selectedOrder) return {};
    const isSec = selectedOrder.id.endsWith('_secondary');
    const baseId = isSec ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;
    const baseOrder = (orders || paidOrders || []).find((o) => o.id === baseId) || selectedOrder;
    return (isSec ? baseOrder.checklistSecondary : baseOrder.checklist) || {};
  })();

  // Render appropriate checklist template based on service type
  const renderPartnerChecklist = (order: Order) => {
    const isSec = order.id.endsWith('_secondary');
    const baseId = isSec ? order.id.replace('_secondary', '') : order.id;
    const baseOrder = (orders || paidOrders || []).find((o) => o.id === baseId) || order;
    const orderChecklist = (isSec ? baseOrder.checklistSecondary : baseOrder.checklist) || {};

    if (order.type === 'Visa') {
      const details = order.details as any;
      const checkedCount = [
        orderChecklist['scanVerified'],
        orderChecklist['tierVerified'],
        orderChecklist['escrowAllocated']
      ].filter(Boolean).length;

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center pt-1">
              <CheckCircle className="h-4 w-4 text-indigo-500 mr-2" />
              Verification Guard Checklist
            </h4>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono border transition-all ${
              checkedCount === 3 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : checkedCount > 0 
                  ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' 
                  : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}>
              {checkedCount}/3 Verified
            </span>
          </div>
          <p className="text-[11px] text-slate-505">Coordinate and check off required tasks with legal immigration partner files:</p>
          <div className="space-y-2">
            <label className="flex items-start p-2.5 bg-slate-50 border border-slate-150 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-all">
              <input 
                type="checkbox" 
                checked={!!orderChecklist['scanVerified']} 
                onChange={() => toggleChecklist(order.id, 'scanVerified')}
                className="h-4 w-4 rounded text-indigo-600 border-slate-300 mr-3 mt-0.5 cursor-pointer"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-800">Passport Biometrics Verified</p>
                <p className="text-[10px] text-slate-500">OCR details match government travel record templates</p>
                {details.passportScan && (
                  <span className="inline-block mt-1 font-mono text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100">
                    📂 {details.passportScan}
                  </span>
                )}
              </div>
            </label>

            <label className="flex items-start p-2.5 bg-slate-50 border border-slate-150 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-all">
              <input 
                type="checkbox" 
                checked={!!orderChecklist['tierVerified']} 
                onChange={() => toggleChecklist(order.id, 'tierVerified')}
                className="h-4 w-4 rounded text-indigo-600 border-slate-300 mr-3 mt-0.5 cursor-pointer"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-800">Processing Speed Matched</p>
                <p className="text-[10px] text-slate-500">Tier is synchronized on queues with partner (Speed Level: {details.processingSpeed || 'Standard'})</p>
              </div>
            </label>

            <label className="flex items-start p-2.5 bg-slate-50 border border-slate-150 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-all">
              <input 
                type="checkbox" 
                checked={!!orderChecklist['escrowAllocated']} 
                onChange={() => toggleChecklist(order.id, 'escrowAllocated')}
                className="h-4 w-4 rounded text-indigo-600 border-slate-300 mr-3 mt-0.5 cursor-pointer"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-800">Stamp Escrow Settled</p>
                <p className="text-[10px] text-slate-500">Government fees & stamp pre-authorizations are registered under partner billing account</p>
              </div>
            </label>
          </div>
        </div>
      );
    } else if (order.type === 'FastTrack') {
      const details = order.details as any;
      const checkedCount = [
        orderChecklist['liaisonRostered'],
        orderChecklist['passengerManifestMatched'],
        orderChecklist['wheelchairCheck']
      ].filter(Boolean).length;

      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center">
              <CheckCircle className="h-4 w-4 text-purple-500 mr-2" />
              VIP Fast Track Gate-Meet Checklist
            </h4>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono border transition-all ${
              checkedCount === 3 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : checkedCount > 0 
                  ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' 
                  : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}>
              {checkedCount}/3 Handled
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Coordinate meet timelines with airport airside concierge staff:</p>
          <div className="space-y-2">
            <label className="flex items-start p-2.5 bg-slate-50 border border-slate-150 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-all">
              <input 
                type="checkbox" 
                checked={!!orderChecklist['liaisonRostered']} 
                onChange={() => toggleChecklist(order.id, 'liaisonRostered')}
                className="h-4 w-4 rounded text-purple-600 border-slate-300 mr-3 mt-0.5 cursor-pointer"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-800">Personal Liaison Escort Rostered</p>
                <p className="text-[10px] text-slate-500">Vetted airport concierge allocated for Flight {details.flightNumber} landing {details.arrivalTime}</p>
              </div>
            </label>

            <label className="flex items-start p-2.5 bg-slate-50 border border-slate-150 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-all">
              <input 
                type="checkbox" 
                checked={!!orderChecklist['passengerManifestMatched']} 
                onChange={() => toggleChecklist(order.id, 'passengerManifestMatched')}
                className="h-4 w-4 rounded text-purple-600 border-slate-300 mr-3 mt-0.5 cursor-pointer"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-800">Manifest Passenger Matching</p>
                <p className="text-[10px] text-slate-500">Verified size: &nbsp;<strong>{details.numberOfPassengers} Pax</strong> &nbsp;|&nbsp; Lead Name: &nbsp;{details.contactName}</p>
              </div>
            </label>

            <label className="flex items-start p-2.5 bg-slate-50 border border-slate-150 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-all">
              <input 
                type="checkbox" 
                checked={!!orderChecklist['wheelchairCheck']} 
                onChange={() => toggleChecklist(order.id, 'wheelchairCheck')}
                className="h-4 w-4 rounded text-purple-600 border-slate-300 mr-3 mt-0.5 cursor-pointer"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-800">Special Handling Accommodated</p>
                <p className="text-[10px] text-slate-500">Special notes: &nbsp;<span className="italic">{details.specialRequests || 'None'}</span></p>
              </div>
            </label>

            {/* Check if visa/TRC copy was attached to Fast Track */}
            {details.visaAttachment && (
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-indigo-700 block uppercase">Visa / TRC Copy (Scanned)</span>
                <p className="text-xs text-slate-500 leading-relaxed">The customer uploaded the following Visa or TRC document file:</p>
                <span className="inline-block font-mono text-[10px] bg-white text-indigo-600 px-2.5 py-1 rounded border border-indigo-200 mt-1">
                  📄 {details.visaAttachment}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    } else {
      const details = order.details as any;
      const checkedCount = [
        orderChecklist['vehicleCategoryMatched'],
        orderChecklist['flightRosterTracked'],
        orderChecklist['leadContactDetailsReady']
      ].filter(Boolean).length;

      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center">
              <CheckCircle className="h-4 w-4 text-emerald-500 mr-2" />
              Limo & Fleet Dispatch Checklist
            </h4>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono border transition-all ${
              checkedCount === 3 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : checkedCount > 0 
                  ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' 
                  : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}>
              {checkedCount}/3 Dispatched
            </span>
          </div>
          <p className="text-[11px] text-slate-505">Verify chauffeur and terminal transport specifications:</p>
          <div className="space-y-2">
            <label className="flex items-start p-2.5 bg-slate-50 border border-slate-150 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-all">
              <input 
                type="checkbox" 
                checked={!!orderChecklist['vehicleCategoryMatched']} 
                onChange={() => toggleChecklist(order.id, 'vehicleCategoryMatched')}
                className="h-4 w-4 rounded text-emerald-600 border-slate-300 mr-3 mt-0.5 cursor-pointer"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-800">Fleet Class Assigned & Dispatched</p>
                <p className="text-[10px] text-slate-500">
                  Vehicle Category booked: &nbsp;<strong>{details.vehicleType}</strong> 
                  &nbsp;({details.luggageCount !== undefined ? `passenger is traveling with ${details.luggageCount} suitcases` : 'no luggage count registered'})
                </p>
              </div>
            </label>

            <label className="flex items-start p-2.5 bg-slate-50 border border-slate-150 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-all">
              <input 
                type="checkbox" 
                checked={!!orderChecklist['flightRosterTracked']} 
                onChange={() => toggleChecklist(order.id, 'flightRosterTracked')}
                className="h-4 w-4 rounded text-emerald-600 border-slate-300 mr-3 mt-0.5 cursor-pointer"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-800">Flight Radar Schedule Snapped</p>
                <p className="text-[10px] text-slate-500">Tracking flight: &nbsp;<span className="font-mono bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded font-black">{details.flightNumber}</span> &nbsp;|&nbsp; Scheduled: &nbsp;{details.pickupDate} @ {details.pickupTime}</p>
              </div>
            </label>

            <label className="flex items-start p-2.5 bg-slate-50 border border-slate-150 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-all">
              <input 
                type="checkbox" 
                checked={!!orderChecklist['leadContactDetailsReady']} 
                onChange={() => toggleChecklist(order.id, 'leadContactDetailsReady')}
                className="h-4 w-4 rounded text-emerald-600 border-slate-300 mr-3 mt-0.5 cursor-pointer"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-800">Lead Contact Info Verified</p>
                <p className="text-[10px] text-slate-500">Name: &nbsp;<strong>{details.passengerName}</strong> &nbsp;|&nbsp; Mobile Connection check: &nbsp;{details.passengerPhone}</p>
              </div>
            </label>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-8" id="oms-panel">
      
      {/* OMS Dashboard Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-teal-500/10 mix-blend-color-dodge opacity-40 pointers-events-none" />
        
        <div className="space-y-2 relative z-10">
          <div className="flex items-center space-x-2">
            <span className="bg-indigo-500 text-white text-[9px] tracking-widest uppercase font-black px-2.5 py-0.5 rounded-full">
              Staff Portal
            </span>
            <span className="text-slate-400 font-mono text-xs">Platform Admin</span>
          </div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight">
            Order Management System & Partner Hub
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm max-w-2xl">
            Triage newly registered inbound orders, assign specialized regional travel fulfillment partners, verify biometrics attachments, and coordinate operational issues.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 shrink-0 text-center relative z-10 min-w-[150px]">
          <span className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">Incoming Orders Ledger</span>
          <span className="text-3xl font-extrabold text-white block">{getSplitOrders(paidOrders).length}</span>
          <span className="text-[10px] text-[#A78BFA] font-medium block mt-1">Ready for Partner Dispatch</span>
        </div>
      </div>

      {/* OMS SUBPAGE MASTER TABS */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl max-w-2xl shadow-sm border border-slate-200">
        <button
          onClick={() => setOmsSubPage('fulfillment')}
          className={`flex-1 py-2.5 px-4 font-display font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer ${
            omsSubPage === 'fulfillment'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-202'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="h-4 w-4 text-indigo-600" />
          <span>Fulfillment Worklist & Chats</span>
        </button>
        <button
          onClick={() => {
            setOmsSubPage('agency_comms');
            setSelectedOrderId(null);
          }}
          className={`flex-1 py-2.5 px-4 font-display font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer relative ${
            omsSubPage === 'agency_comms'
              ? 'bg-[#1E293B] text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="h-4 w-4 text-emerald-450" />
          <span>Agency Zalo/WA Sync</span>
          <span className="hidden sm:inline-block px-1 py-0.2 bg-emerald-500 text-[8px] font-black text-slate-950 rounded uppercase">
            NEW
          </span>
        </button>
        <button
          onClick={() => {
            setOmsSubPage('alerts_board');
            setSelectedOrderId(null);
          }}
          className={`flex-1 py-2.5 px-4 font-display font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer relative ${
            omsSubPage === 'alerts_board'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="h-4 w-4 text-emerald-400" />
          <span>Day Ops & Schedule Alerts</span>
          
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white animate-ping" />
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white" />
        </button>
      </div>

      {omsSubPage === 'fulfillment' ? (
        <div className="flex flex-col space-y-6">

        
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Triaging Gateways</span>
            <h2 className="font-display font-bold text-slate-800 text-lg">Partner Dispatches & Status Tracking</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search by ID, name, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 w-full sm:w-60 bg-slate-55 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:bg-white transition-all"
              />
            </div>

            {/* Service selector tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl self-start flex-wrap gap-0.5">
              <button
                onClick={() => {
                  setPartnerServiceTab('All');
                  setSelectedOrderId(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  partnerServiceTab === 'All'
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-205/60'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                All ({getSplitOrders(paidOrders).length})
              </button>

              <button
                onClick={() => {
                  setPartnerServiceTab('Visa');
                  setSelectedOrderId(null);
                }}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  partnerServiceTab === 'Visa'
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-205/80'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                <Plane className="h-3 w-3 mr-1" />
                <span>Visa ({getSplitOrders(paidOrders).filter(o => o.type === 'Visa').length})</span>
              </button>

              <button
                onClick={() => {
                  setPartnerServiceTab('FastTrack');
                  setSelectedOrderId(null);
                }}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  partnerServiceTab === 'FastTrack'
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-205/80'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                <Sparkles className="h-3 w-3 mr-1 text-purple-500" />
                <span>FastTrack ({getSplitOrders(paidOrders).filter(o => o.type === 'FastTrack').length})</span>
              </button>

              <button
                onClick={() => {
                  setPartnerServiceTab('AirportPickup');
                  setSelectedOrderId(null);
                }}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  partnerServiceTab === 'AirportPickup'
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-205/80'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                <Car className="h-3 w-3 mr-1 text-emerald-500" />
                <span>Car/Bus ({getSplitOrders(paidOrders).filter(o => o.type === 'AirportPickup').length})</span>
              </button>

              <button
                onClick={() => {
                  setPartnerServiceTab('VAT');
                  setSelectedOrderId(null);
                }}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  partnerServiceTab === 'VAT'
                    ? 'bg-red-50 text-red-700 shadow-sm border border-red-200/80'
                    : 'text-slate-500 hover:text-[#DC2626] hover:bg-red-50/40'
                }`}
              >
                <FileText className="h-3 w-3 mr-1 text-red-500 animate-pulse" />
                <span>VAT Control ({getSplitOrders(paidOrders).filter(o => (o.details as any).wantsInvoice === true).length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Panel: Master Service Table ledger (Takes 2/3 space for wide data displays) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-150 p-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Master Dispatch Ledger</span>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase">Operational Service & Progress Table ({tabOrders.length} Records)</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 pl-1.5">Sort:</span>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
                    className="bg-white border border-slate-200 text-slate-800 text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="created_desc">Created At (Newest Descending ↓)</option>
                    <option value="created_asc">Created At (Oldest Ascending ↑)</option>
                    <option value="service_desc">Service Date (Latest ↓)</option>
                    <option value="service_asc">Service Date (Earliest ↑)</option>
                  </select>
                </div>
                <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded font-black hidden lg:inline">
                  Click Row to Coordinate
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    {partnerServiceTab === 'VAT' ? (
                      <tr className="bg-red-50/50 border-b border-red-150 text-[10px] font-bold uppercase tracking-wider text-red-700 select-none">
                        <th className="py-3 px-4 text-red-800">Inbound ID</th>
                        <th 
                          className="py-3 px-4 text-red-800 cursor-pointer hover:text-red-950 transition-colors"
                          onClick={() => setSortOrder(prev => prev === 'created_desc' ? 'created_asc' : 'created_desc')}
                          title="Click to sort by Created At"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Created At</span>
                            {sortOrder === 'created_desc' && <ArrowDown className="h-3 w-3 text-red-600 font-bold" />}
                            {sortOrder === 'created_asc' && <ArrowUp className="h-3 w-3 text-red-600 font-bold" />}
                            {!sortOrder.startsWith('created') && <ArrowUpDown className="h-3 w-3 text-red-400" />}
                          </div>
                        </th>
                        <th className="py-3 px-4 text-red-800">Corporate Entity / Tax Profile</th>
                        <th className="py-3 px-4 text-red-800">Workflow Status</th>
                      </tr>
                    ) : (
                      <tr className="bg-slate-50/75 border-b border-slate-150 text-[10px] font-bold uppercase tracking-wider text-slate-500 select-none">
                        <th className="py-3 px-4">Order ID</th>
                        <th 
                          className="py-3 px-4 cursor-pointer hover:text-indigo-600 transition-colors"
                          onClick={() => setSortOrder(prev => prev === 'created_desc' ? 'created_asc' : 'created_desc')}
                          title="Click to sort by Created At"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Created At</span>
                            {sortOrder === 'created_desc' && <ArrowDown className="h-3 w-3 text-indigo-600 font-bold" />}
                            {sortOrder === 'created_asc' && <ArrowUp className="h-3 w-3 text-indigo-600 font-bold" />}
                            {!sortOrder.startsWith('created') && <ArrowUpDown className="h-3 w-3 text-slate-400" />}
                          </div>
                        </th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Partner In Charge</th>
                        <th className="py-3 px-4">Payment</th>
                        <th className="py-3 px-4">Progress</th>
                        <th className="py-3 px-4">Amount</th>
                        <th 
                          className="py-3 px-4 cursor-pointer hover:text-indigo-600 transition-colors"
                          onClick={() => setSortOrder(prev => prev === 'service_desc' ? 'service_asc' : 'service_desc')}
                          title="Click to sort by Service Date"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>Service Date</span>
                            {sortOrder === 'service_desc' && <ArrowDown className="h-3 w-3 text-indigo-600 font-bold" />}
                            {sortOrder === 'service_asc' && <ArrowUp className="h-3 w-3 text-indigo-600 font-bold" />}
                            {!sortOrder.startsWith('service') && <ArrowUpDown className="h-3 w-3 text-slate-400" />}
                          </div>
                        </th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {sortedTabOrders.length === 0 ? (
                      <tr>
                        <td colSpan={partnerServiceTab === 'VAT' ? 4 : 8} className="py-12 text-center text-slate-400 font-medium">
                          <p>No orders matched your current filters or query.</p>
                          <p className="text-[10px] text-zinc-400 mt-1">Submit new bookings on the passenger forms tab!</p>
                        </td>
                      </tr>
                    ) : (
                      sortedTabOrders.map((order) => {
                        const isSelected = order.id === selectedOrderId;
                        const assignedPartnerId = assignedPartners[order.id];
                        const partnerAssignedName = PARTNERS[order.type].find(p => p.id === assignedPartnerId)?.name;
                        
                        const customerName = getCustomerName(order);
                        const customerPhone = getCustomerPhone(order);
                        const serviceDate = getServiceDate(order);
                        const serviceDetail = getServiceDetailsInfo(order);

                        if (partnerServiceTab === 'VAT') {
                          const details = order.details as any;
                          const baseId = order.id.replace('_secondary', '');
                          const baseOrder = (orders || paidOrders || []).find((o) => o.id === baseId) || order;
                          const invStatus = baseOrder.invoiceStatus || 'Draft';
                          return (
                            <tr
                              key={order.id}
                              onClick={() => setSelectedOrderId(order.id)}
                              className={`hover:bg-red-50/15 transition-all cursor-pointer ${
                                isSelected ? 'bg-red-50/30 border-l-2 border-red-550 font-medium' : ''
                              }`}
                            >
                              {/* Order ID */}
                              <td className="py-3.5 px-4 font-sans">
                                <div className="flex flex-col space-y-1">
                                  <span className="font-mono font-bold text-slate-950 flex items-center gap-1.5">
                                    {order.id}
                                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                                  </span>
                                  <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded w-max uppercase bg-slate-100 text-slate-700 border border-slate-200`}>
                                    {order.type}
                                  </span>
                                </div>
                              </td>

                              {/* Created At */}
                              <td className="py-3.5 px-4 font-sans whitespace-nowrap">
                                <span className="font-mono text-[11px] font-bold text-slate-700">
                                  {formatCreatedAt(order.createdAt)}
                                </span>
                              </td>

                              {/* Company Entity */}
                              <td className="py-3.5 px-4 font-sans">
                                <div className="flex flex-col space-y-0.5 max-w-[200px]">
                                  <span className="font-bold text-[#1E293B] truncate">{details.companyName || 'Corporate Client'}</span>
                                  <span className="text-[10.5px] text-[#DC2626] font-mono leading-tight truncate">MST: {details.taxCode || 'Declined'}</span>
                                  <span className="text-[9.5px] text-slate-450 truncate">{details.companyEmail || 'billing@n-a.com'}</span>
                                </div>
                              </td>

                              {/* Invoicing Status select */}
                              <td className="py-3.5 px-4 font-sans" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={invStatus}
                                  onChange={(e) => {
                                    onUpdateOrder?.(baseId, { invoiceStatus: e.target.value as any });
                                  }}
                                  className={`text-[10px] font-black rounded-lg px-2.5 py-1.5 border focus:outline-none focus:ring-2 focus:ring-red-400/20 cursor-pointer ${
                                    invStatus === 'Draft'
                                      ? 'bg-slate-50 text-slate-800 border-slate-205'
                                      : invStatus === 'Sent to Customer'
                                        ? 'bg-blue-50 text-blue-805 border-blue-200'
                                        : invStatus === 'Issued & Tax Stamped'
                                          ? 'bg-emerald-50 text-emerald-805 border-emerald-250'
                                          : 'bg-indigo-50 text-indigo-805 border-indigo-200'
                                  }`}
                                >
                                  <option value="Draft">1. Draft (Saved)</option>
                                  <option value="Sent to Customer">2. Sent to Customer</option>
                                  <option value="Issued & Tax Stamped">3. Issued & Tax Stamped</option>
                                  <option value="Archived">4. Archived</option>
                                </select>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr
                            key={order.id}
                            onClick={() => setSelectedOrderId(order.id)}
                            className={`hover:bg-slate-50/80 transition-all cursor-pointer ${
                              isSelected ? 'bg-indigo-50/20 font-medium border-l-2 border-indigo-550' : ''
                            }`}
                          >
                            {/* Order ID */}
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col space-y-1">
                                <span className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                                  {order.id}
                                  {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />}
                                </span>
                                {order.type === 'AirportPickup' ? (
                                  (() => {
                                    const dir = (order.details as any)?.direction || 'Arrival';
                                    const isArrival = dir === 'Arrival';
                                    return (
                                      <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded w-max uppercase ${
                                        isArrival 
                                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                          : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                      }`}>
                                        <Car className="h-2.5 w-2.5 shrink-0" />
                                        <span>Car/Bus ({dir})</span>
                                      </span>
                                    );
                                  })()
                                ) : order.type === 'FastTrack' ? (
                                  (() => {
                                    const dir = (order.details as any)?.serviceDirection || (order.details as any)?.direction || 'Arrival';
                                    const isArrival = dir === 'Arrival';
                                    return (
                                      <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded w-max uppercase ${
                                        isArrival 
                                          ? 'bg-purple-50 text-purple-800 border border-purple-200' 
                                          : 'bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200'
                                      }`}>
                                        <Sparkles className="h-2.5 w-2.5 shrink-0" />
                                        <span>Fasttrack ({dir})</span>
                                      </span>
                                    );
                                  })()
                                ) : (
                                  <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded w-max uppercase ${
                                    order.type === 'Visa' 
                                      ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                                      : 'bg-purple-50 text-purple-800 border border-purple-200'
                                  }`}>
                                    <Plane className="h-2.5 w-2.5 shrink-0" />
                                    <span>{order.type}</span>
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-500 font-semibold font-sans">
                                  {serviceDetail}
                                </span>
                              </div>
                            </td>

                            {/* Created At */}
                            <td className="py-3.5 px-4 font-sans whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-mono font-bold text-slate-800 text-[11px]">
                                  {formatCreatedAt(order.createdAt)}
                                </span>
                                <span className="text-[9.5px] text-slate-400 font-medium">
                                  {order.createdAt && !isNaN(new Date(order.createdAt).getTime())
                                    ? new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                    : 'N/A'}
                                </span>
                              </div>
                            </td>

                            {/* Customer */}
                            <td className="py-3.5 px-4 font-sans">
                              <div className="flex flex-col space-y-0.5 max-w-[155px]">
                                <div className="flex items-center gap-1.5 flex-wrap col-span-2">
                                  <span className="font-bold text-[#1E293B] truncate">{customerName}</span>
                                  {(order.details as any).wantsInvoice && (
                                    <span className="px-1 py-0.2 text-[8px] border border-red-200 text-red-600 bg-red-50/50 rounded font-black tracking-wide uppercase font-sans shrink-0 animate-pulse">
                                      VAT
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono leading-tight truncate">{customerPhone}</span>
                              </div>
                            </td>

                            {/* Partner in charge */}
                            <td className="py-3.5 px-4">
                              {(() => {
                                const isOrderCombo = !order.isSplitLeg && ((order.type === 'FastTrack' && (order.details as any).addAirportPickup) ||
                                                     (order.type === 'AirportPickup' && (order.details as any).addFastTrack));
                                const secondaryPartnerType = order.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack';
                                const secondaryPartnerAssignedId = assignedPartners[order.id + '_secondary'];
                                const secondaryPartnerAssignedName = PARTNERS[secondaryPartnerType].find(p => p.id === secondaryPartnerAssignedId)?.name;

                                return (
                                  <div className="flex flex-col gap-1.5">
                                    {/* Primary */}
                                    <div>
                                      {partnerAssignedName ? (
                                        <div className="flex flex-col font-sans">
                                          <span className="font-bold text-indigo-600 flex items-center text-[10px] truncate max-w-[150px]" title={`Primary: ${partnerAssignedName}`}>
                                            <Building className="h-3 w-3 mr-1 text-indigo-500 shrink-0" />
                                            {partnerAssignedName.split(' ')[0]}... ({order.type === 'FastTrack' ? 'Primary FT' : order.type === 'Visa' ? 'Primary Visa' : 'Primary Car'})
                                          </span>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedOrderId(order.id);
                                          }}
                                          className="text-[9px] font-black text-amber-800 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded border border-amber-250 flex items-center gap-1 shrink-0 transition-all cursor-pointer w-max"
                                        >
                                          <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                                          Needs {order.type === 'FastTrack' ? 'FT' : order.type === 'Visa' ? 'Visa' : 'Car'}
                                        </button>
                                      )}
                                    </div>

                                    {/* Secondary Combo */}
                                    {isOrderCombo && (
                                      <div className="border-t border-slate-100 pt-1">
                                        {secondaryPartnerAssignedName ? (
                                          <div className="flex flex-col font-sans">
                                            <span className="font-semibold text-purple-700 flex items-center text-[10px] truncate max-w-[150px]" title={`Secondary: ${secondaryPartnerAssignedName}`}>
                                              <Building className="h-3 w-3 mr-1 text-purple-500 shrink-0" />
                                              {secondaryPartnerAssignedName.split(' ')[0]}... ({secondaryPartnerType === 'FastTrack' ? 'Combo FT' : 'Combo Car'})
                                            </span>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedOrderId(order.id);
                                            }}
                                            className="text-[9px] font-black text-purple-800 bg-purple-50 hover:bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200 flex items-center gap-1 shrink-0 transition-all cursor-pointer w-max animate-pulse"
                                          >
                                            <AlertCircle className="h-2.5 w-2.5 shrink-0 animate-bounce" />
                                            Needs {secondaryPartnerType === 'FastTrack' ? 'FT' : 'Car'} Combo
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Payment */}
                            <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                              <span className={`inline-block text-[10px] font-bold rounded-lg px-2.5 py-1.5 border font-sans ${
                                order.paymentStatus?.startsWith('Paid')
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-250'
                                  : order.paymentStatus === 'Refunded'
                                    ? 'bg-rose-50 text-rose-805 border-rose-200'
                                    : 'bg-amber-50 text-amber-805 border-amber-250'
                              }`}>
                                {order.paymentStatus?.startsWith('Paid') ? '✅ ' + order.paymentStatus :
                                 order.paymentStatus === 'Refunded' ? '↩️ Refunded' :
                                 '⏳ Pending'}
                              </span>
                            </td>

                            {/* Progress */}
                            <td className="py-3.5 px-4 font-sans" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-col gap-1 w-full max-w-[170px]">
                                {(() => {
                                  const normalizedStatus = normalizeStatusForTimeline(order.status, order.type);
                                  return (
                                    <>
                                      <div className={`border text-[10px] font-bold rounded-lg px-2.5 py-1 text-center font-sans shadow-xs flex items-center justify-between gap-1 ${getStatusBadgeStyle(normalizedStatus)}`}>
                                        <span className="truncate">{normalizedStatus}</span>
                                        <span className="text-[9px] opacity-65 shrink-0" title="Read only - synced live from Agency Zalo / WA Sync">🔒</span>
                                      </div>

                                      {order.type === 'Visa' && order.subStatus && (
                                        <div className={`text-[9px] font-extrabold rounded-md px-2 py-0.5 text-center border ${
                                          order.subStatus === 'Awaiting Paperwork' || order.subStatus === 'More documents required'
                                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                                            : order.subStatus === 'Approved'
                                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                              : order.subStatus === 'Declined'
                                                ? 'bg-rose-100 text-rose-900 border-rose-300'
                                                : 'bg-indigo-100 text-indigo-900 border-indigo-200'
                                        }`}>
                                          {order.subStatus === 'Awaiting Paperwork' || order.subStatus === 'More documents required'
                                            ? '⚠️ More Docs Required'
                                            : order.subStatus === 'Standard Review' || order.subStatus === 'Standard processing'
                                              ? 'Standard Review'
                                              : order.subStatus === 'Approved'
                                                ? 'Approved & Issued'
                                                : order.subStatus === 'Declined'
                                                  ? 'Declined / Rejected'
                                                  : order.subStatus}
                                        </div>
                                      )}

                                      <span className="text-[8.5px] text-indigo-600 font-bold text-center uppercase tracking-wide block mt-0.5">
                                        🌐 Zalo/WA Synced
                                      </span>
                                    </>
                                  );
                                })()}
                              </div>
                            </td>

                            {/* Amount */}
                            <td className="py-3.5 px-4 font-bold text-slate-900 font-mono whitespace-nowrap">
                              {order.id.endsWith('_secondary') && (order.details?.totalFee === undefined || order.details?.totalFee === null) ? (
                                <span className="text-[11px] text-slate-400 italic font-normal font-sans">
                                  {language === 'EN' ? 'Included in the combo package' : 'Đã bao gồm trong gói combo'}
                                </span>
                              ) : (
                                formatMoney(order.details.totalFee, order)
                              )}
                            </td>

                            {/* Service Date */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 whitespace-nowrap">
                                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>{serviceDate}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Panel: Active Operational Workspace Area (Takes 1/3 space) */}
          <div className="lg:col-span-1">
            {selectedOrder ? (
              <motion.div 
                layoutId={`oms-detail-${selectedOrder.id}`}
                className="bg-white rounded-3xl border border-slate-150 shadow-md p-5 space-y-6"
              >
                {/* Visual Order Meta Header */}
                <div className="border-b border-slate-100 pb-4 space-y-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-indigo-500 font-bold block uppercase tracking-wider">
                      Operational Clearance Board
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-display font-black text-slate-900 font-mono tracking-tight">
                        {selectedOrder.id}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase font-mono bg-slate-900 text-white shrink-0">
                        {selectedOrder.type === 'AirportPickup' 
                          ? `Car/Bus (${(selectedOrder.details as any)?.direction || 'Arrival'})`
                          : selectedOrder.type === 'FastTrack'
                            ? `Fasttrack (${(selectedOrder.details as any)?.serviceDirection || (selectedOrder.details as any)?.direction || 'Arrival'})`
                            : selectedOrder.type}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderId(selectedOrder.id);
                      setOmsSubPage('agency_comms');
                    }}
                    className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-indigo-200/80 shadow-sm"
                  >
                    <span>{language === 'EN' ? 'Open in Order Management ➜' : 'Mở trong Order Management ➜'}</span>
                  </button>
                </div>

                  {/* Status controls */}
                  {partnerServiceTab === 'VAT' ? (() => {
                    const selBaseId = selectedOrder.id.replace('_secondary', '');
                    const selBaseOrder = (orders || paidOrders || []).find((o) => o.id === selBaseId) || selectedOrder;
                    const selInvStatus = selBaseOrder.invoiceStatus || 'Draft';

                    return (
                      <div className="flex flex-col gap-1.5 w-full bg-amber-50/50 border border-amber-200 p-3.5 rounded-2xl">
                        <span className="text-[10px] text-amber-800 font-extrabold uppercase tracking-wider block">
                          VAT Invoice Workflow Status
                        </span>
                        <select
                          value={selInvStatus}
                          onChange={(e) => {
                            onUpdateOrder?.(selBaseId, { invoiceStatus: e.target.value as any });
                          }}
                          className={`text-xs font-bold rounded-xl px-2.5 py-2 border focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer w-full font-sans transition-all ${
                            selInvStatus === 'Draft'
                              ? 'bg-slate-50 text-slate-800 border-slate-200'
                              : selInvStatus === 'Sent to Customer'
                                ? 'bg-blue-50 text-blue-850 border-blue-200'
                                : selInvStatus === 'Issued & Tax Stamped'
                                  ? 'bg-emerald-50 text-emerald-850 border-emerald-200'
                                  : 'bg-slate-550 text-slate-800 border-slate-200'
                          }`}
                        >
                          <option value="Draft">1. Draft (Saved)</option>
                          <option value="Sent to Customer">2. Sent to Customer</option>
                          <option value="Issued & Tax Stamped">3. Issued & Tax Stamped</option>
                          <option value="Archived">4. Archived</option>
                        </select>
                      </div>
                    );
                  })() : (
                    <div className="flex flex-col gap-2 w-full">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gateway Status Controller</span>
                      
                      <div className="flex flex-col gap-2 w-full font-sans">
                        {/* Main Status Display (Read-Only) */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Primary Status:</label>
                          <div className="w-full text-xs font-bold rounded-xl px-3 py-2 border border-indigo-200 bg-indigo-50/50 text-indigo-900 flex items-center justify-between">
                            <span>{getStatusLabel(selectedOrder.status, language as any)}</span>
                            <span className="text-[10px] font-mono opacity-70">({selectedOrder.status})</span>
                          </div>
                        </div>

                        {/* Sub-Status Display (Read-Only) */}
                        {selectedOrder.subStatus && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Sub-Status:</label>
                            <div className="w-full text-xs font-semibold rounded-xl px-3 py-2 border border-slate-200 bg-slate-50 text-slate-700">
                              {getSubStatusLabel(selectedOrder.subStatus, language as any)} ({selectedOrder.subStatus})
                            </div>
                          </div>
                        )}

                        <p className="text-[10px] text-slate-400 font-medium italic mt-0.5">
                          {language === 'EN'
                            ? 'Update status in the Order Management tab.'
                            : 'Cập nhật trạng thái tại tab Order Management.'}
                        </p>

                        {/* Payment Status (Read-Only) */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Status:</label>
                          <div className={`w-full text-xs font-bold rounded-xl px-3 py-2 border flex items-center justify-between ${
                            selectedOrder.paymentStatus?.startsWith('Paid')
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : selectedOrder.paymentStatus === 'Refunded'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            <span>
                              {selectedOrder.paymentStatus?.startsWith('Paid') ? '✅ Paid (Completed)' :
                               selectedOrder.paymentStatus === 'Refunded' ? '↩️ Refunded' :
                               '⏳ Pending Payment'}
                            </span>
                            <span className="text-[9px] font-extrabold uppercase bg-white/70 px-1.5 py-0.5 rounded border border-current opacity-75">
                              Auto Sync
                            </span>
                          </div>
                          <p className="text-[9.5px] text-slate-400 font-medium italic leading-tight">
                            {language === 'EN'
                              ? 'Payment status is set automatically by 9Pay and cannot be edited here.'
                              : 'Trạng thái thanh toán do hệ thống 9Pay tự cập nhật, không sửa tay được.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Horizontal Progress Track */}
                {partnerServiceTab !== 'VAT' && renderHorizontalProgressTrack(selectedOrder)}

                {/* Vertical Stack: Details & Checklist vs Chat with Partner */}
                {partnerServiceTab !== 'VAT' && (
                  <div className="grid grid-cols-1 gap-6 items-start">
                  
                  {/* Left Column: Specs & Dispatch Assignment & Checklist */}
                  <div className="space-y-6">
                    
                    {/* SERVICE TEAM DISPATCH & DOSSIER EXPORT BOARD */}
                    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 text-white space-y-3 shadow-lg font-sans">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Send className="h-4 w-4 text-indigo-400" />
                          <span className="text-xs font-black uppercase tracking-wider text-indigo-300">
                            🚀 SERVICE TEAM DISPATCH & DOSSIER EXPORT
                          </span>
                        </div>
                        <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950 border border-emerald-500/40 px-2 py-0.5 rounded-full uppercase">
                          READY TO DISPATCH
                        </span>
                      </div>

                      <p className="text-[10.5px] text-slate-300 leading-relaxed">
                        Gói thông tin khách hàng thành định dạng chuẩn để gửi nhanh qua Zalo, WhatsApp, Telegram hoặc tải tệp dữ liệu về máy cho đội dịch vụ xử lý tiếp.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        {/* 1. Copy formatted text */}
                        <button
                          type="button"
                          onClick={() => {
                            const fields = buildOrderExportFields(selectedOrder);
                            const isSecLeg = selectedOrder.id?.endsWith('_secondary');
                            const effectiveType = isSecLeg
                              ? (selectedOrder.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack')
                              : selectedOrder.type;

                            let headerTitle = `📋 ĐƠN DỊCH VỤ E-VISA: #${selectedOrder.id}`;
                            if (effectiveType === 'FastTrack') {
                              headerTitle = `✈️ LỆNH ĐÓN SÂN BAY FAST-TRACK: #${selectedOrder.id}`;
                            } else if (effectiveType === 'AirportPickup') {
                              headerTitle = `🚘 LỆNH ĐIỀU XE ĐƯA ĐÓN SÂN BAY: #${selectedOrder.id}`;
                            }

                            const formattedMsg = [
                              '==========================================',
                              headerTitle,
                              '==========================================',
                              ...fields.map((f) => `${f.label}: ${f.value}`),
                              '=========================================='
                            ].join('\n');

                            const nameField = fields.find((f) => f.label === 'Họ tên khách');
                            const phoneField = fields.find((f) => f.label === 'SĐT');
                            const emailField = fields.find((f) => f.label === 'Email');

                            navigator.clipboard.writeText(formattedMsg);
                            alert(`✅ Đã sao chép tin nhắn chuẩn [${effectiveType.toUpperCase()}]!\nHọ tên: ${nameField?.value || 'Chưa có'}\nSĐT: ${phoneField?.value || 'Chưa có'}\nEmail: ${emailField?.value || 'Chưa có'}`);
                          }}
                          className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>📋 Sao chép Lệnh {selectedOrder.id?.endsWith('_secondary') ? (selectedOrder.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack') : selectedOrder.type}</span>
                        </button>

                        {/* 2. Download TXT Document */}
                        <button
                          type="button"
                          onClick={() => {
                            const fields = buildOrderExportFields(selectedOrder);
                            const isSecLeg = selectedOrder.id?.endsWith('_secondary');
                            const effectiveType = isSecLeg
                              ? (selectedOrder.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack')
                              : selectedOrder.type;

                            let headerTitle = `📋 ĐƠN DỊCH VỤ E-VISA: #${selectedOrder.id}`;
                            let fileNamePrefix = 'don_visa';
                            if (effectiveType === 'FastTrack') {
                              headerTitle = `✈️ LỆNH ĐÓN SÂN BAY FAST-TRACK: #${selectedOrder.id}`;
                              fileNamePrefix = 'lenh_don_fasttrack';
                            } else if (effectiveType === 'AirportPickup') {
                              headerTitle = `🚘 LỆNH ĐIỀU XE ĐƯA ĐÓN SÂN BAY: #${selectedOrder.id}`;
                              fileNamePrefix = 'lenh_dieu_xe';
                            }

                            const txtContent = [
                              '==========================================',
                              headerTitle,
                              '==========================================',
                              ...fields.map((f) => `${f.label}: ${f.value}`),
                              '=========================================='
                            ].join('\n');

                            const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${fileNamePrefix}_${selectedOrder.id}.txt`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 border border-slate-700 transition-all cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>📄 Tải File Văn Bản (.TXT)</span>
                        </button>

                        {/* 3. Download CSV / Excel */}
                        <button
                          type="button"
                          onClick={() => {
                            const fields = buildOrderExportFields(selectedOrder);
                            const isSecLeg = selectedOrder.id?.endsWith('_secondary');
                            const effectiveType = isSecLeg
                              ? (selectedOrder.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack')
                              : selectedOrder.type;

                            const headers = fields.map((f) => f.label);
                            const values = fields.map((f) => f.value);

                            const escapeCsv = (val: string) => {
                              const s = String(val);
                              if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                                return `"${s.replace(/"/g, '""')}"`;
                              }
                              return `"${s}"`;
                            };

                            const csvContent = "\uFEFF" + headers.map(escapeCsv).join(",") + "\n" + values.map(escapeCsv).join(",");
                            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `danh_sach_${effectiveType.toLowerCase()}_${selectedOrder.id}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 border border-slate-700 transition-all cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>📊 Tải Bảng Tính (.CSV/Excel)</span>
                        </button>

                        {/* 4. Download Image / Print ticket (Visa service ONLY) */}
                        {((selectedOrder.id?.endsWith('_secondary') ? (selectedOrder.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack') : selectedOrder.type) === 'Visa') && (
                          <button
                            type="button"
                            onClick={() => {
                              const pScan = (selectedOrder.details as any)?.passportScanDataUrl;
                              if (pScan) {
                                const a = document.createElement('a');
                                a.href = pScan;
                                a.download = `passport_${selectedOrder.id}.jpg`;
                                a.click();
                              } else {
                                window.print();
                              }
                            }}
                            className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 border border-slate-700 transition-all cursor-pointer"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>{(selectedOrder.details as any)?.passportScanDataUrl ? '📷 Tải ảnh Hộ Chiếu' : '🖨️ In Phiếu Xử Lý'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Combo Order Leg Switcher Button */}
                    {(() => {
                      const isSecLeg = selectedOrder.id?.endsWith('_secondary');
                      const baseId = isSecLeg ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;
                      const baseOrder = (paidOrders || orders || []).find((o) => o.id === baseId) || selectedOrder;
                      const isCombo = isSecLeg || ((baseOrder.type === 'FastTrack' && (baseOrder.details as any)?.addAirportPickup) ||
                                      (baseOrder.type === 'AirportPickup' && (baseOrder.details as any)?.addFastTrack) ||
                                      Boolean((paidOrders || orders || []).find((o) => o.id === baseId + '_secondary')));

                      if (!isCombo) return null;

                      const formatServiceName = (type: string) => {
                        if (type === 'FastTrack') return 'Fast Track';
                        if (type === 'AirportPickup') return language === 'EN' ? 'Airport Pickup' : 'Đưa đón sân bay';
                        return type;
                      };

                      if (isSecLeg) {
                        const primaryType = baseOrder.type;
                        const targetName = formatServiceName(primaryType);
                        return (
                          <button
                            type="button"
                            onClick={() => setSelectedOrderId(baseId)}
                            className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-800 text-xs font-extrabold rounded-xl border border-purple-200 transition-colors cursor-pointer flex items-center justify-between shadow-xs font-sans"
                          >
                            <span>
                              {language === 'EN'
                                ? `⬅ Switch to primary leg (${targetName})`
                                : `⬅ Chuyển về chặng chính (${targetName})`}
                            </span>
                            <span className="font-mono text-[10px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded border border-purple-200">
                              {baseId}
                            </span>
                          </button>
                        );
                      } else {
                        const secondaryType = selectedOrder.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack';
                        const targetName = formatServiceName(secondaryType);
                        const targetId = baseId + '_secondary';
                        return (
                          <button
                            type="button"
                            onClick={() => setSelectedOrderId(targetId)}
                            className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-800 text-xs font-extrabold rounded-xl border border-purple-200 transition-colors cursor-pointer flex items-center justify-between shadow-xs font-sans"
                          >
                            <span>
                              {language === 'EN'
                                ? `Switch to secondary leg (${targetName}) ➜`
                                : `Chuyển sang chặng phụ (${targetName}) ➜`}
                            </span>
                            <span className="font-mono text-[10px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded border border-purple-200">
                              {targetId}
                            </span>
                          </button>
                        );
                      }
                    })()}

                    {/* Specialized Partner dispatch section */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-250/60 space-y-3.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                          Fulfillment Coordinator
                        </span>
                        {(() => {
                          const isOrderCombo = !selectedOrder.isSplitLeg && ((selectedOrder.type === 'FastTrack' && (selectedOrder.details as any).addAirportPickup) ||
                                               (selectedOrder.type === 'AirportPickup' && (selectedOrder.details as any).addFastTrack));
                          return (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${isOrderCombo ? 'text-purple-700 bg-purple-50 border-purple-200' : 'text-indigo-600 bg-indigo-50 border-indigo-100'}`}>
                              {isOrderCombo ? 'Partners specialized: Combo Duo' : 'Partners specialized: Exactly 1'}
                            </span>
                          );
                        })()}
                      </div>

                      {(() => {
                        const isOrderCombo = !selectedOrder.isSplitLeg && ((selectedOrder.type === 'FastTrack' && (selectedOrder.details as any).addAirportPickup) ||
                                             (selectedOrder.type === 'AirportPickup' && (selectedOrder.details as any).addFastTrack));
                        const secondaryPartnerType = selectedOrder.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack';
                        const secondaryPartnerAssignedId = assignedPartners[selectedOrder.id + '_secondary'];
                        const secondaryPartnerDetails = secondaryPartnerType ? PARTNERS[secondaryPartnerType].find(p => p.id === secondaryPartnerAssignedId) : null;

                        const isSec = selectedOrder.id.endsWith('_secondary');
                        const baseId = selectedOrder.parentId || selectedOrder.id.replace('_secondary', '');
                        const parentOrder = (paidOrders || []).find(o => o.id === baseId) || selectedOrder;
                        const waUrl = isSec ? (parentOrder as any)?.whatsappGroupUrlSecondary : (parentOrder as any)?.whatsappGroupUrl;
                        const zaUrl = isSec ? (parentOrder as any)?.zaloGroupUrlSecondary : (parentOrder as any)?.zaloGroupUrl;

                        return (
                          <div className="space-y-4">
                            {/* Group Chat Access Buttons (WhatsApp & Zalo) */}
                            <div className="grid grid-cols-2 gap-2 font-sans">
                              <button
                                type="button"
                                disabled={!waUrl}
                                title={
                                  !waUrl
                                    ? (language === 'EN' ? 'No group link yet. Add it in the Order Management tab.' : 'Chưa có link nhóm. Nhập ở tab Order Management.')
                                    : (language === 'EN' ? 'Open WhatsApp group' : 'Mở nhóm WhatsApp')
                                }
                                onClick={() => {
                                  if (waUrl) safeOpen(waUrl, '_blank');
                                }}
                                className={`py-2 px-2.5 text-[10.5px] font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                                  waUrl
                                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer shadow-xs'
                                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                }`}
                              >
                                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                <span className="truncate">{language === 'EN' ? 'Open WhatsApp group' : 'Mở nhóm WhatsApp'}</span>
                              </button>

                              <button
                                type="button"
                                disabled={!zaUrl}
                                title={
                                  !zaUrl
                                    ? (language === 'EN' ? 'No group link yet. Add it in the Order Management tab.' : 'Chưa có link nhóm. Nhập ở tab Order Management.')
                                    : (language === 'EN' ? 'Open Zalo group' : 'Mở nhóm Zalo')
                                }
                                onClick={() => {
                                  if (zaUrl) safeOpen(zaUrl, '_blank');
                                }}
                                className={`py-2 px-2.5 text-[10.5px] font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                                  zaUrl
                                    ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 cursor-pointer shadow-xs'
                                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                }`}
                              >
                                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                                <span className="truncate">{language === 'EN' ? 'Open Zalo group' : 'Mở nhóm Zalo'}</span>
                              </button>
                            </div>
                            {/* Primary Partner Sector */}
                            <div className={`${isOrderCombo ? 'border-b border-dashed border-slate-200 pb-3' : ''}`}>
                              {isOrderCombo && (
                                <span className="text-[9.5px] font-bold text-indigo-700 uppercase tracking-wider block mb-2 font-sans">
                                  [Primary Fulfillment] {selectedOrder.type === 'FastTrack' ? 'Fast-Track Airport Liaison' : 'VIP Chauffeur Pickup'}
                                </span>
                              )}
                              {selectedOrderPartner ? (
                                <div className="space-y-1.5 font-sans">
                                  <div className="bg-white border p-3 rounded-xl shadow-sm border-slate-200">
                                    <div className="flex justify-between items-start">
                                      <span className="text-[11px] font-black text-[#1E293B] flex items-center">
                                        <Building className="h-3.5 w-3.5 text-indigo-600 mr-1.5" />
                                        {selectedOrderPartner.name}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleUnassign(selectedOrder.id)}
                                        className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 transition-colors cursor-pointer shrink-0"
                                      >
                                        {language === 'EN' ? 'Unassign' : 'Huỷ phân công'}
                                      </button>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-slate-500 font-medium mt-1">
                                      <span>Liaison: &nbsp;{selectedOrderPartner.contact}</span>
                                      <span className="text-amber-605 font-bold">★ {selectedOrderPartner.rating} Rating</span>
                                    </div>
                                    {((selectedOrder as any).assignedPartnerBy || (selectedOrder as any).assignedPartnerAt) && (
                                      <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                                        {language === 'EN' 
                                          ? `Assigned by ${(selectedOrder as any).assignedPartnerBy || 'staff'}${(selectedOrder as any).assignedPartnerAt ? ` at ${new Date((selectedOrder as any).assignedPartnerAt).toLocaleString()}` : ''}`
                                          : `Đã giao bởi ${(selectedOrder as any).assignedPartnerBy || 'nhân viên'}${(selectedOrder as any).assignedPartnerAt ? ` lúc ${new Date((selectedOrder as any).assignedPartnerAt).toLocaleString()}` : ''}`}
                                      </div>
                                    )}
                                  </div>
                                  {!isOrderCombo && (
                                    <div className="flex items-center gap-1.5 pt-1 text-[10px] text-slate-400 font-mono">
                                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                                      <span>Operational channel active & syncing messaging logs</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 font-medium py-1 font-sans">
                                  {language === 'EN' ? 'No partner assigned' : 'Chưa giao đối tác'}
                                </p>
                              )}
                            </div>

                            {/* Secondary Combo Partner Sector */}
                            {isOrderCombo && (
                              <div className="space-y-2 animate-fade-in">
                                <span className="text-[9.5px] font-bold text-purple-700 uppercase tracking-wider block font-sans">
                                  [Combo Fulfillment] {secondaryPartnerType === 'FastTrack' ? 'Fast-Track Airport Liaison' : 'VIP Chauffeur Pickup'}
                                </span>
                                {secondaryPartnerDetails ? (
                                  <div className="space-y-1 font-sans">
                                    <div className="bg-white border p-3 rounded-xl shadow-sm border-purple-200">
                                      <div className="flex justify-between items-start">
                                        <span className="text-[11px] font-black text-purple-900 flex items-center">
                                          <Building className="h-3.5 w-3.5 text-purple-600 mr-1.5" />
                                          {secondaryPartnerDetails.name}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleUnassign(selectedOrder.id + '_secondary')}
                                          className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 transition-colors cursor-pointer shrink-0"
                                        >
                                          {language === 'EN' ? 'Unassign' : 'Huỷ phân công'}
                                        </button>
                                      </div>
                                      <div className="flex justify-between text-[11px] text-slate-500 font-medium mt-1">
                                        <span>Liaison: &nbsp;{secondaryPartnerDetails.contact}</span>
                                        <span className="text-purple-600 font-bold">★ {secondaryPartnerDetails.rating} Rating</span>
                                      </div>
                                      {((selectedOrder as any).assignedPartnerBySecondary || (selectedOrder as any).assignedPartnerAtSecondary) && (
                                        <div className="mt-2 pt-2 border-t border-purple-100 text-[10px] text-slate-500">
                                          {language === 'EN' 
                                            ? `Assigned by ${(selectedOrder as any).assignedPartnerBySecondary || 'staff'}${(selectedOrder as any).assignedPartnerAtSecondary ? ` at ${new Date((selectedOrder as any).assignedPartnerAtSecondary).toLocaleString()}` : ''}`
                                            : `Đã giao bởi ${(selectedOrder as any).assignedPartnerBySecondary || 'nhân viên'}${(selectedOrder as any).assignedPartnerAtSecondary ? ` lúc ${new Date((selectedOrder as any).assignedPartnerAtSecondary).toLocaleString()}` : ''}`}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 pt-1 text-[10px] text-slate-400 font-mono">
                                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-ping" />
                                      <span>Combo gateway online: coordination channel linked</span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400 font-medium py-1 font-sans">
                                    {language === 'EN' ? 'No partner assigned' : 'Chưa giao đối tác'}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* APPLICANT UPLOADED DOCUMENTS & PHOTOS */}
                    {selectedOrder.type === 'Visa' && (
                      <div className="bg-indigo-50/40 border border-indigo-200 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
                          <span className="text-xs font-extrabold text-indigo-900 tracking-wider">📷 ATTACHED APPLICANT BIOMETRICS & PASSPORT</span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3 pt-1 font-sans">
                          {/* Passport scan preview */}
                          <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                            <span className="text-[10px] font-bold text-slate-500 block uppercase">Passport Info Page</span>
                            {(selectedOrder.details as any).passportScanDataUrl ? (
                              <div className="space-y-1.5">
                                <img
                                  src={(selectedOrder.details as any).passportScanDataUrl}
                                  alt="Passport Scan"
                                  className="w-full h-48 object-contain bg-slate-900/5 rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setPreviewImage({
                                    url: (selectedOrder.details as any).passportScanDataUrl,
                                    filename: (selectedOrder.details as any).passportScan || `passport-${selectedOrder.id}.jpg`
                                  })}
                                  title={language === 'EN' ? 'Click to view full image' : 'Bấm để xem ảnh phóng to'}
                                />
                              </div>
                            ) : (
                              <div className="p-3 bg-slate-50 rounded-lg text-center border border-dashed border-slate-200">
                                <p className="text-[10px] text-slate-400 font-mono">{(selectedOrder.details as any).passportScan || 'No Passport Image'}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* RED VAT INVOICE BILLING RECORD MATCH */}
                    {(selectedOrder.details as any).wantsInvoice && (
                      <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                          <span className="text-xs font-extrabold text-amber-900 tracking-wider">🏢 RED VAT INVOICE RECIPIENT PROFILE</span>
                        </div>
                        <p className="text-[10px] text-slate-505 leading-relaxed font-sans">
                          Official RED VAT Invoice tax record billing requested. Local legal partners must issue this document to the recipient below:
                        </p>
                        
                        <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-2 font-sans font-medium text-slate-800">
                          <div>
                            <span className="text-[9px] text-[#64748B] block uppercase tracking-wider">Registered Tax Entity</span>
                            <span className="font-bold text-[#1E293B]">{(selectedOrder.details as any).companyName}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[9px] text-[#64748B] block uppercase tracking-wider">Tax ID / MST</span>
                              <span className="font-mono font-bold">{(selectedOrder.details as any).taxCode}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-[#64748B] block uppercase tracking-wider font-sans">Billing Dispatch Email</span>
                              <span className="truncate block">{(selectedOrder.details as any).companyEmail || 'No Address Assigned'}</span>
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] text-[#64748B] block uppercase tracking-wider">Registered Address</span>
                            <span className="text-slate-600 text-[11px] leading-tight block">{(selectedOrder.details as any).companyAddress}</span>
                          </div>
                        </div>
                      </div>
                    )}



                  </div>

                  {/* Right Column: Communications Thread Board with Partner */}
                  <div className="p-4 bg-slate-50/80 border border-slate-150 rounded-2xl space-y-4 flex flex-col justify-between min-h-[460px]">
                    
                    <div className="space-y-3.5 flex-1 flex flex-col">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="h-4.5 w-4.5 text-indigo-500 shrink-0" />
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">Internal Ops Notes Thread</span>
                            <span className="text-[9px] text-slate-450 block">Internal staff notes (Customer/Partner cannot see)</span>
                          </div>
                        </div>
                        <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100 font-bold uppercase">
                          Internal Only
                        </span>
                      </div>

                      {/* Msg Logs scroll container */}
                      <div className="space-y-2.5 max-h-[300px] overflow-y-auto flex-1 pr-1 font-sans text-xs">
                        {selectedOrderDiscussion.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2 my-auto">
                            <HelpCircle className="h-8 w-8 text-slate-300 animate-pulse" />
                            <p className="text-xs text-slate-500">Communication board is standby.</p>
                            <p className="text-[9px] text-slate-400">Dispatch this booking to a vetted partner to initiate secure operations conversations.</p>
                          </div>
                        ) : (
                          selectedOrderDiscussion.map((message, idx) => {
                            if (message.sender === 'system') {
                              if (message.text.startsWith('🤖 [AI Flight Tracker] RESULT:')) {
                                try {
                                  const jsonStr = message.text.replace('🤖 [AI Flight Tracker] RESULT:', '').trim();
                                  const info = JSON.parse(jsonStr);
                                  return (
                                    <div key={idx} className="bg-slate-905 bg-[#0F172A] text-slate-100 rounded-2xl border border-slate-800 shadow-xl overflow-hidden my-3 p-4 font-sans space-y-3 relative select-none" id={`flight-radar-${info.flightNo}`}>
                                      {/* Radar pulse effect */}
                                      <div className="absolute top-2.5 right-2.5 flex items-center space-x-1.5">
                                        <span className="relative flex h-2 w-2">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        <span className="text-[8px] font-mono font-bold tracking-widest text-emerald-400 uppercase">SAT-LOCK ACTIVE</span>
                                      </div>

                                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                        <div>
                                          <span className="text-[9px] font-mono text-indigo-400 block tracking-wider uppercase font-semibold">{info.airline}</span>
                                          <h4 className="text-sm font-black text-white flex items-center tracking-tight font-mono">
                                            <Plane className="h-3.5 w-3.5 mr-1 text-indigo-400 rotate-45 shrink-0" />
                                            {info.flightNo}
                                          </h4>
                                        </div>
                                        <span className={`text-[8.5px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase ${
                                          info.status === 'Landed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-550/20' :
                                          info.status === 'In Air' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-550/20 animate-pulse' :
                                          info.status === 'Delayed' ? 'bg-rose-500/10 text-rose-400 border-rose-550/20 animate-pulse' :
                                          'bg-blue-500/10 text-blue-400 border-blue-550/20'
                                        }`}>
                                          {info.status === 'In Air' ? '✈️ In Flight' : info.status}
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                                        <div className="space-y-0.5">
                                          <span className="text-[8.5px] text-[#94A3B8] uppercase font-black block tracking-wider">Origin</span>
                                          <span className="font-bold text-white block truncate">{info.origin}</span>
                                          <span className="text-[9px] text-[#A1A1AA] block font-mono">Dep: {info.departure}</span>
                                        </div>
                                        <div className="space-y-0.5 text-right font-sans">
                                          <span className="text-[8.5px] text-[#94A3B8] uppercase font-black block tracking-wider text-right">Destination</span>
                                          <span className="font-bold text-teal-400 block truncate">{info.dest}</span>
                                          <span className="text-[9px] text-emerald-400 block font-mono">Arr: {info.arrival}</span>
                                        </div>
                                      </div>

                                      {/* Progress Bar */}
                                      <div className="space-y-1 font-sans">
                                        <div className="flex justify-between text-[8px] font-mono text-[#94A3B8] leading-none">
                                          <span>Tracking Progress</span>
                                          <span>{info.progress}%</span>
                                        </div>
                                        <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                                          <div 
                                            className="bg-gradient-to-r from-indigo-500 to-teal-400 h-full rounded-full transition-all duration-1000" 
                                            style={{ width: `${info.progress}%` }} 
                                          />
                                        </div>
                                      </div>

                                      {/* Telemetry info grid */}
                                      <div className="grid grid-cols-3 gap-1 p-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-[8.5px]">
                                        <div className="text-center">
                                          <span className="text-slate-500 block uppercase font-semibold text-[7.5px]">ALTITUDE</span>
                                          <span className="text-slate-200 font-bold">{info.altitude}</span>
                                        </div>
                                        <div className="text-center border-x border-slate-850">
                                          <span className="text-slate-500 block uppercase font-semibold text-[7.5px]">AIRSPEED</span>
                                          <span className="text-slate-200 font-bold">{info.speed.split(' (')[0]}</span>
                                        </div>
                                        <div className="text-center">
                                          <span className="text-slate-500 block uppercase font-semibold text-[7.5px]">GATE LOCK</span>
                                          <span className="text-slate-200 font-bold">{info.gate}</span>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between text-[9px] text-[#94A3B8] pt-1.5 font-mono leading-none border-t border-slate-800/60 font-sans">
                                        <span className="flex items-center gap-1">
                                          🌤️ Weather: {info.weather}
                                        </span>
                                        <span className="text-[7.5px] text-slate-500">{message.timestamp}</span>
                                      </div>
                                    </div>
                                  );
                                } catch (e) {
                                  // Fallback to standard rendering below
                                }
                              }

                              return (
                                <div key={idx} className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-[10px] text-slate-500 text-center italic font-mono">
                                  ⚡ {message.text} 
                                  <span className="block text-[8px] text-slate-405 mt-0.5 font-sans not-italic">{message.timestamp}</span>
                                </div>
                              );
                            }

                            const isPartner = message.sender === 'partner';
                            return (
                              <div 
                                key={idx} 
                                className={`flex flex-col max-w-[85%] ${isPartner ? 'self-start mr-auto' : 'self-end ml-auto'}`}
                              >
                                <span className={`text-[9px] font-bold mb-0.5 ${isPartner ? 'text-indigo-600' : 'text-slate-600 text-right'}`}>
                                  {isPartner ? `[Partner] ${selectedOrderPartner?.name.split(' ')[0]}` : '[Me] Digivisa Desk'}
                                </span>
                                
                                <div className={`p-3 rounded-2xl leading-relaxed text-xs ${
                                  isPartner 
                                    ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-none' 
                                    : 'bg-indigo-600 text-white rounded-tr-none shadow-sm shadow-indigo-600/10'
                                }`}>
                                  {message.text}
                                </div>
                                <span className={`text-[8.5px] text-slate-400 mt-1 ${isPartner ? '' : 'text-right'}`}>
                                  {message.timestamp}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Operational Resubmission Triggers */}
                    {selectedOrder.type === 'Visa' && selectedOrderPartner && (
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                          ⚠️ Document Resubmission Triggers
                        </span>
                        <div className="flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const isSec = selectedOrder.id.endsWith('_secondary');
                              const baseId = isSec ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;
                              const parentOrder = (orders || []).find(o => o.id === baseId);
                              const existingNotes = (parentOrder as any)?.opsNotes || [];

                              updateOrderStatus(selectedOrder.id, 'Needs Resubmission');
                              const newNote = {
                                text: `System note: Document quality check failed. Passport scan is partly blurred. Customer notified to resubmit high-resolution photo.`,
                                by: '',
                                at: new Date().toISOString(),
                                leg: (isSec ? 'secondary' : 'primary') as 'primary' | 'secondary'
                              };

                              onUpdateOrder?.(baseId, { opsNotes: [...existingNotes, newNote] });
                            }}
                            className="w-full text-left p-1.5 text-[10.5px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-250 rounded-lg cursor-pointer transition-all flex items-center justify-between"
                          >
                            <span>1. System Trigger: Incomplete Passport Scan</span>
                            <span className="text-[9px] bg-amber-200 px-1 py-0.2 rounded font-black">TRIGGER</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              const isSec = selectedOrder.id.endsWith('_secondary');
                              const baseId = isSec ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;
                              const parentOrder = (orders || []).find(o => o.id === baseId);
                              const existingNotes = (parentOrder as any)?.opsNotes || [];

                              updateOrderStatus(selectedOrder.id, 'Needs Resubmission');
                              const newNote = {
                                text: `System note: Embassy officer feedback: Biometric photo background does not meet contrast standards. Customer notified to resubmit 4x6 photo.`,
                                by: '',
                                at: new Date().toISOString(),
                                leg: (isSec ? 'secondary' : 'primary') as 'primary' | 'secondary'
                              };

                              onUpdateOrder?.(baseId, { opsNotes: [...existingNotes, newNote] });
                            }}
                            className="w-full text-left p-1.5 text-[10.5px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-250 rounded-lg cursor-pointer transition-all flex items-center justify-between"
                          >
                            <span>2. System Trigger: Embassy Photo Correction</span>
                            <span className="text-[9px] bg-rose-200 px-1 py-0.2 rounded font-black">TRIGGER</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Flight Radar & Tracking Bot Trigger Panel */}
                    {selectedOrderPartner && (
                      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                            ✈️ AI Flight Status Tracker Agent
                          </span>
                          <span className="text-[8.5px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-bold uppercase">
                            ADS-B Radar Live
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 font-sans">
                          {(() => {
                            const flightNo = (selectedOrder.details as any)?.flightNumber;
                            if (flightNo) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleQueryFlightStatus(selectedOrder.id, flightNo)}
                                  className="text-[10px] font-bold text-white bg-slate-900 hover:bg-indigo-950 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer hover:shadow shadow-sm active:scale-95 text-center decoration-none border-none"
                                >
                                  <Plane className="h-3.5 w-3.5 text-indigo-400 shrink-0 rotate-45" />
                                  Ping Flight Status Bot ({flightNo.toUpperCase()})
                                </button>
                              );
                            } else {
                              return (
                                <div className="flex items-center gap-1.5 w-full flex-wrap">
                                  <span className="text-[9px] text-[#64748B] italic">No declared flight. Quick trace:</span>
                                  {['SQ176', 'VN542', 'UA869', 'EK392'].map(fCode => (
                                    <button
                                      key={fCode}
                                      type="button"
                                      onClick={() => handleQueryFlightStatus(selectedOrder.id, fCode)}
                                      className="text-[9.5px] font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-all cursor-pointer border border-[#E0E7FF]"
                                    >
                                      {fCode}
                                    </button>
                                  ))}
                                </div>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Chat messaging input */}
                    <div className="pt-3 border-t border-slate-200/60 flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder={selectedOrderPartner ? "Type instruction or coordinate with partner..." : "Triage to partner to write..."}
                        disabled={!selectedOrderPartner}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handlePostMessage(selectedOrder.id);
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500/15 focus:outline-none transition-all disabled:opacity-50 disabled:bg-slate-100"
                      />
                      <button
                        onClick={() => handlePostMessage(selectedOrder.id)}
                        disabled={!selectedOrderPartner || !chatInput.trim()}
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-300 text-white rounded-xl transition-colors shrink-0 cursor-pointer"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>

                  </div>

                </div>
                )}

              </motion.div>
            ) : (
              <div className="bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-250 p-12 text-center text-slate-400 flex flex-col items-center justify-center min-h-[500px]">
                <Building className="h-16 w-16 text-slate-300 stroke-[1.2] mb-4 animate-pulse" />
                <h3 className="font-display font-bold text-slate-800 text-lg">Operational Dashboard</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                  Select any incoming client booking from the specialized left-hand list. You will be able to dispatch transit carriers, coordinate with airport escorts or legal teams, and chat inside operational pipelines.
                </p>
              </div>
            )}
          </div>

        </div>

      </div>
      ) : omsSubPage === 'agency_comms' ? (
        <OMSAgencyComms
          orders={paidOrders}
          setOrders={setOrders}
          discussions={discussions}
          currency={currency}
          assignedPartners={assignedPartners}
          setAssignedPartners={setAssignedPartners}
          PARTNERS={PARTNERS}
          initialSelectedOrderId={selectedOrderId}
          language={language}
          onUpdateOrder={onUpdateOrder}
          onSelectOrder={(orderId, tab) => {
            setPartnerServiceTab(tab);
            setSelectedOrderId(orderId);
            setOmsSubPage('fulfillment');
          }}
        />
      ) : (
        <OMSAlertsBoard
          orders={paidOrders}
          setOrders={setOrders}
          currency={currency}
          assignedPartners={assignedPartners}
          PARTNERS={PARTNERS}
          onOpenInManagement={(orderId) => {
            setSelectedOrderId(orderId);
            setOmsSubPage('agency_comms');
          }}
          language={language}
        />
      )}

      {/* Passport Image Preview Modal Popup */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-[90vw] max-h-[90vh] bg-slate-900 rounded-2xl p-4 flex flex-col items-center gap-3 border border-slate-700 shadow-2xl overflow-hidden font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between gap-4 text-white pb-2 border-b border-slate-800">
              <span className="text-xs font-bold font-mono text-slate-300 truncate max-w-[60vw]">
                {previewImage.filename}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewImage.url}
                  download={previewImage.filename}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{language === 'EN' ? 'Download image' : 'Tải ảnh về'}</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1 border border-slate-700 transition-all cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>{language === 'EN' ? 'Close' : 'Đóng'}</span>
                </button>
              </div>
            </div>
            
            <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto p-2">
              <img
                src={previewImage.url}
                alt="Passport Preview"
                className="max-h-[75vh] max-w-[85vw] object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
