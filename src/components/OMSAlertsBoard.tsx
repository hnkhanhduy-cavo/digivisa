import React, { useState } from 'react';
import { 
  Calendar, Clock, AlertTriangle, UserCheck, Bell, Compass, FileText, 
  CheckCircle, MessageSquare, Send, RefreshCw, Layers, ShieldAlert,
  ArrowRight, ExternalLink, Sparkles, Car, Plane, Users, RotateCcw
} from 'lucide-react';
import { Order, Currency, CURRENCY_SYMBOLS, EXCHANGE_RATES } from '../types';

interface OMSAlertsBoardProps {
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  currency: Currency;
  assignedPartners: Record<string, string>;
  PARTNERS: Record<string, Array<{ id: string; name: string; contact: string; rating: string; activeOrders: number }>>;
  onOpenInManagement?: (orderId: string) => void;
  language?: string;
}

export default function OMSAlertsBoard({
  orders,
  setOrders,
  currency,
  assignedPartners,
  PARTNERS,
  onOpenInManagement,
  language = 'VI',
}: OMSAlertsBoardProps) {
  // Let the user mock different system simulation dates to observe the reactive operational queue
  const [simDate, setSimDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<'All' | 'Visa' | 'FastTrack' | 'AirportPickup'>('All');

  // Custom interactive mini calendar state
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth()); // 0-indexed
  const [showCalendarPopover, setShowCalendarPopover] = useState<boolean>(false);

  React.useEffect(() => {
    if (simDate) {
      const parts = simDate.split('-');
      if (parts.length === 3) {
        const y = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        if (!isNaN(y) && !isNaN(m)) {
          setCurrentYear(y);
          setCurrentMonth(m);
        }
      }
    }
  }, [simDate]);

  // Format currency helpers
  const formatMoney = (usdAmount: any, order?: Order) => {
    const val = typeof usdAmount === 'number' ? usdAmount : (parseFloat(usdAmount) || 0);
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

  const getServiceDateStr = (order: Order) => {
    const details = order.details as any;
    if (!details) return '';
    return details.arrivalDate || details.pickupDate || '';
  };

  const getPassengerName = (order: Order) => {
    const details = order.details as any;
    if (!details) return 'N/A';
    if (order.type === 'Visa') {
      return `${details.firstName || ''} ${details.lastName || ''}`.trim() || 'No Name';
    }
    return details.contactName || details.passengerName || 'No Name';
  };

  // Helper to get real today date string YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Helper to add days to a YYYY-MM-DD date string
  const addDaysToDate = (dateStr: string, days: number): string => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        d.setDate(d.getDate() + days);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    } catch (e) {
      // fallback
    }
    return dateStr;
  };

  const formatDateSub = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch (e) {}
    return dateStr;
  };

  const realToday = getTodayStr();
  const realTomorrow = addDaysToDate(realToday, 1);

  const activeSimDate = simDate;
  const tomorrowSimDate = addDaysToDate(simDate, 1);

  // ----------------------------------------------------
  // ALERT LOGIC GENERATION
  // ----------------------------------------------------
  interface AlertItem {
    id: string; // Unique string
    order: Order;
    type: 'critical' | 'warning' | 'info';
    category: string;
    message: string;
  }

  const generatedAlerts: AlertItem[] = [];

  orders.forEach((order) => {
    const details = order.details as any;
    if (!details) return;

    const serviceDate = getServiceDateStr(order);
    const isPaid = order.paymentStatus && order.paymentStatus.startsWith('Paid');
    const partnerId = assignedPartners[order.id];

    // Compute relative days
    let daysUntilService: number | null = null;
    if (serviceDate) {
      const parts = serviceDate.split('-');
      const simParts = activeSimDate.split('-');
      if (parts.length === 3 && simParts.length === 3) {
        const schedTime = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
        const baseTime = new Date(Number(simParts[0]), Number(simParts[1]) - 1, Number(simParts[2])).getTime();
        daysUntilService = Math.round((schedTime - baseTime) / (1000 * 60 * 60 * 24));
      }
    }

    // 1. Alert: Arrival <= 2 days but Visa is not finalized/Approved
    if (order.type === 'Visa' && daysUntilService !== null && daysUntilService <= 2 && daysUntilService >= -5) {
      if (order.status !== 'Approved' && order.status !== 'Approved & Issued') {
        generatedAlerts.push({
          id: `visa_overdue_${order.id}`,
          order,
          type: 'critical',
          category: '🚨 Overdue Visa Clearance',
          message: `${getPassengerName(order)} is scheduled to land ${daysUntilService === 0 ? 'Today' : daysUntilService === 1 ? 'Tomorrow' : `in ${daysUntilService} days`} (${serviceDate}), but visa status is still "${order.status}".`
        });
      }
    }

    // 2. Alert: Airport Pickup Scheduled is within 2 days but driver not assigned
    if (order.type === 'AirportPickup' && isPaid && daysUntilService !== null && daysUntilService <= 2 && daysUntilService >= -5) {
      if (order.status === 'Confirmed' || order.status === 'Staff Assigned') {
        generatedAlerts.push({
          id: `pickup_no_driver_${order.id}`,
          order,
          type: 'critical',
          category: '🚘 Driver Dispatch Overdue',
          message: `${getPassengerName(order)} transit pickup is scheduled for ${daysUntilService === 0 ? 'Today' : daysUntilService === 1 ? 'Tomorrow' : `in ${daysUntilService} days`} has no designated vehicle dispatch profile.`
        });
      }
    }

    // 3. Alert: Fast Track Scheduled soon but missing flight or landing specs
    if (order.type === 'FastTrack' && isPaid && daysUntilService !== null && daysUntilService <= 2 && daysUntilService >= -5) {
      if (order.status === 'Pending Landing Info' || !details.flightNumber || details.flightNumber === 'N/A') {
        generatedAlerts.push({
          id: `ft_missing_flight_${order.id}`,
          order,
          type: 'critical',
          category: '✈️ Missing Flight Manifest',
          message: `FastTrack greeting for ${getPassengerName(order)} is marked soon but flight landing code is missing.`
        });
      }
    }

    // 4. Alert: Paid order but NO partner assigned yet
    if (isPaid && !partnerId) {
      generatedAlerts.push({
        id: `unassigned_partner_${order.id}`,
        order,
        type: 'warning',
        category: '👤 Unassigned Partner',
        message: `Order ${order.id} for ${getPassengerName(order)} is paid but has not been dispatched to any specialized ground partners.`
      });
    }

    // 4b. Alert: Operational Ground Service (< 24h) but NO designated Staff/Driver Assigned
    if ((order.type === 'FastTrack' || order.type === 'AirportPickup') && daysUntilService !== null && daysUntilService <= 1 && daysUntilService >= -1) {
      const isMissingStaff = order.status === 'Confirmed' || 
                             order.status === 'Staff Assigned' || 
                             order.status === 'Awaiting Dispatch' || 
                             order.status === 'Pending Landing Info' ||
                             order.status === 'Awaiting Flight Landing' ||
                             (!order.staffName && order.status !== 'Completed' && order.status !== 'Service Completed' && order.status !== 'Journey Completed');
      if (isMissingStaff) {
        generatedAlerts.push({
          id: `missing_staff_24h_${order.id}`,
          order,
          type: 'critical',
          category: '🚨 Missing Staff Assignment (<24h)',
          message: `Ground operations for ${getPassengerName(order)} (${order.type}) scheduled on ${serviceDate || 'today'} has NOT received any designated field agent or driver assignment. Immediate dispatch required!`
        });
      }
    }

    // 5. Alert: SuperExpress urgency tier but still in preliminary review / needs resubmission
    if (details.processingSpeed === 'SuperExpress' && (order.status === 'Pending Review' || order.status === 'Pending Documents' || order.status === 'Needs Resubmission')) {
      generatedAlerts.push({
        id: `superexpress_review_${order.id}`,
        order,
        type: 'warning',
        category: '⚡ Extreme VIP Speed Alert',
        message: `${getPassengerName(order)} ordered SuperExpress 4-hour clearance but application is stagnant or needs document resubmission.`
      });
    }

    // 6. Alert: Invoice explicitly requested, order paid, but invoice state is still Draft or Sent (needs Issued & Tax Stamped)
    if (details.wantsInvoice && isPaid) {
      const invState = order.invoiceStatus || 'Draft';
      if (invState === 'Draft') {
        generatedAlerts.push({
          id: `invoice_unresolved_${order.id}`,
          order,
          type: 'warning',
          category: '🧾 Tax Billing Unreconciled',
          message: `Customer requested direct RED VAT Invoice for ${order.id}, but no stamp has been locked.`
        });
      }
    }
  });

  // Calculate Today's and Tomorrow's schedules lists
  const todaysSchedule = orders.filter(o => getServiceDateStr(o) === activeSimDate);
  const tomorrowsSchedule = orders.filter(o => getServiceDateStr(o) === tomorrowSimDate);

  // Overdue listings (scheduled arrival is past the sim date, but service is not completed/approved)
  const overdueSchedule = orders.filter(o => {
    const serviceDate = getServiceDateStr(o);
    if (!serviceDate) return false;
    
    // Check if service date is less than active simDate
    const parts = serviceDate.split('-');
    const simParts = activeSimDate.split('-');
    if (parts.length === 3 && simParts.length === 3) {
      const schedTime = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
      const baseTime = new Date(Number(simParts[0]), Number(simParts[1]) - 1, Number(simParts[2])).getTime();
      const isPast = schedTime < baseTime;
      const incomplete = o.status !== 'Completed' && o.status !== 'Approved' && o.status !== 'Approved & Issued' && o.status !== 'Service Completed' && o.status !== 'Journey Completed' && o.status !== 'Cancelled';
      return isPast && incomplete;
    }
    return false;
  });

  // Dynamic filter arrays
  const filteredAlerts = selectedServiceFilter === 'All'
    ? generatedAlerts
    : generatedAlerts.filter(a => a.order.type === selectedServiceFilter);

  const filteredTodaysSchedule = selectedServiceFilter === 'All'
    ? todaysSchedule
    : todaysSchedule.filter(o => o.type === selectedServiceFilter);

  const filteredTomorrowsSchedule = selectedServiceFilter === 'All'
    ? tomorrowsSchedule
    : tomorrowsSchedule.filter(o => o.type === selectedServiceFilter);

  const filteredOverdueSchedule = selectedServiceFilter === 'All'
    ? overdueSchedule
    : overdueSchedule.filter(o => o.type === selectedServiceFilter);

  return (
    <div className="space-y-8" id="oms-alerts-board">
      
      {/* Simulation Controls Info Alert */}
      <div className="bg-gradient-to-r from-slate-800 to-indigo-950 p-5 rounded-2xl border border-slate-700/60 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Calibration Diagnostics</span>
          <h3 className="text-white font-bold text-sm">Operational Timeline & Realtime Calendar</h3>
        </div>
        <div className="flex flex-col sm:flex-row bg-slate-900 border border-slate-700 p-1.5 rounded-xl gap-2 items-stretch sm:items-center">
          <div className="flex gap-1">
            {[
              { date: realToday, label: 'Today', sub: formatDateSub(realToday) },
              { date: realTomorrow, label: 'Tomorrow', sub: formatDateSub(realTomorrow) }
            ].map((d) => {
              const isSelected = simDate === d.date;
              return (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setSimDate(d.date)}
                  className={`py-1.5 px-3 text-xs font-bold rounded-lg cursor-pointer transition-all flex flex-col items-center leading-tight ${
                    isSelected 
                      ? 'bg-indigo-600 text-white shadow ring-2 ring-indigo-400/30 font-black' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{d.label}</span>
                  <span className="text-[9px] opacity-75 font-mono">{d.sub}</span>
                </button>
              );
            })}
          </div>
          
          {/* Custom Date Tracker Calendar */}
          <div className="flex items-center border-t sm:border-t-0 sm:border-l border-slate-850 pt-1.5 sm:pt-0 sm:pl-2 gap-1.5 relative">
            <span className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider hidden sm:inline flex items-center gap-1">
              <Calendar className="h-3 w-3 text-indigo-400 inline" /> Calendar:
            </span>
            
            <div className="relative flex items-center">
              <input
                type="date"
                value={simDate}
                onClick={(e) => {
                  e.preventDefault();
                  setShowCalendarPopover(prev => !prev);
                  try {
                    (e.target as any).showPicker?.();
                  } catch (err) {}
                }}
                onChange={(e) => {
                  if (e.target.value) {
                    setSimDate(e.target.value);
                  }
                }}
                className="bg-slate-950 text-white text-xs border border-slate-700 rounded-lg py-1 pl-3 pr-8 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer max-w-[140px] font-mono text-center relative z-10"
              />
              <button
                type="button"
                onClick={() => setShowCalendarPopover(prev => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer z-20"
                title="Open tracking calendar"
              >
                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
              </button>

              {/* Mini calendar dropdown popover */}
              {showCalendarPopover && (
                <>
                  {/* Backdrop click listener to close popover */}
                  <div 
                    className="fixed inset-0 z-40 cursor-default" 
                    onClick={() => setShowCalendarPopover(false)} 
                  />
                  
                  <div className="absolute right-0 top-full mt-2 bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-2xl z-50 w-72 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          if (currentMonth === 0) {
                            setCurrentMonth(11);
                            setCurrentYear(y => y - 1);
                          } else {
                            setCurrentMonth(m => m - 1);
                          }
                        }}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                        title="Previous Month"
                      >
                        &larr;
                      </button>
                      <span className="text-xs font-black text-white uppercase tracking-wider font-mono">
                        {new Date(currentYear, currentMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (currentMonth === 11) {
                            setCurrentMonth(0);
                            setCurrentYear(y => y + 1);
                          } else {
                            setCurrentMonth(m => m + 1);
                          }
                        }}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                        title="Next Month"
                      >
                        &rarr;
                      </button>
                    </div>

                    {/* Quick Jump Buttons inside popover */}
                    <div className="grid grid-cols-2 gap-1 mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSimDate(realToday);
                          setShowCalendarPopover(false);
                        }}
                        className={`py-1 text-[10px] font-bold rounded-md border transition-all ${
                          simDate === realToday
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 font-black'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        Today (realtime)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSimDate(realTomorrow);
                          setShowCalendarPopover(false);
                        }}
                        className={`py-1 text-[10px] font-bold rounded-md border transition-all ${
                          simDate === realTomorrow
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 font-black'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        Tomorrow
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((wd) => (
                        <div key={wd} className="text-[10px] font-black text-slate-500 uppercase tracking-widest py-0.5">{wd}</div>
                      ))}
                      {Array(new Date(currentYear, currentMonth, 1).getDay()).fill(null).map((_, idx) => (
                        <div key={`blank-${idx}`} className="w-7 h-7" />
                      ))}
                      {Array.from({ length: new Date(currentYear, currentMonth + 1, 0).getDate() }, (_, i) => i + 1).map((day) => {
                        const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isSelected = simDate === dayStr;
                        const realToday = getTodayStr();
                        const isYesterday = dayStr === addDaysToDate(realToday, -1);
                        const isToday = dayStr === realToday;
                        const isTomorrow = dayStr === addDaysToDate(realToday, 1);

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              setSimDate(dayStr);
                              setShowCalendarPopover(false);
                            }}
                            className={`w-7 h-7 text-xs font-bold rounded-lg transition-all flex items-center justify-center cursor-pointer relative ${
                              isSelected
                                ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-600/30'
                                : isToday
                                  ? 'bg-indigo-900/60 text-indigo-200 border border-indigo-500/40 font-bold'
                                  : isYesterday
                                    ? 'bg-amber-950/40 text-amber-200 border border-amber-500/30'
                                    : isTomorrow
                                      ? 'bg-purple-950/40 text-purple-200 border border-purple-500/30'
                                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          setSimDate(getTodayStr());
                          setShowCalendarPopover(false);
                        }}
                        className="text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer flex items-center gap-1"
                      >
                        <Clock className="h-3 w-3 inline" /> Realtime Now
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSimDate(getTodayStr());
                          setShowCalendarPopover(false);
                        }}
                        className="text-slate-400 hover:text-white font-medium cursor-pointer"
                      >
                        Reset (Today)
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metric summary boxes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="oms-alerts-metrics">
        
        {/* Card 1: Total service order today */}
        <button
          type="button"
          onClick={() => setSelectedServiceFilter('All')}
          className={`group p-4 rounded-2xl text-left border-2 transition-all duration-200 relative overflow-hidden focus:outline-none cursor-pointer hover:shadow-md ${
            selectedServiceFilter === 'All'
              ? 'bg-slate-900 border-slate-950 text-white shadow-lg'
              : 'bg-white border-slate-200 hover:border-slate-350 text-slate-850 shadow-sm'
          }`}
        >
          {/* Subtle background decoration */}
          <div className="absolute right-0 bottom-0 opacity-[0.03] text-slate-900 dark:text-white translate-x-4 translate-y-4">
            <Users className="h-24 w-24" />
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] uppercase tracking-wider font-extrabold ${
              selectedServiceFilter === 'All' ? 'text-indigo-300' : 'text-slate-400'
            }`}>
              Today's Orders
            </span>
            <div className={`p-1.5 rounded-xl transition-colors ${
              selectedServiceFilter === 'All' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 group-hover:bg-slate-100'
            }`}>
              <Users className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-3xl font-extrabold block tracking-tight leading-none">
              {todaysSchedule.length}
            </span>
            <span className={`text-[10px] font-medium block ${
              selectedServiceFilter === 'All' ? 'text-slate-300' : 'text-slate-500'
            }`}>
              Total service order today
            </span>
          </div>

          {/* Active selection dot or pill */}
          <div className="mt-2.5 pt-2 border-t border-slate-100/10 flex items-center justify-between text-[9px] font-mono">
            <span className={selectedServiceFilter === 'All' ? 'text-indigo-200 font-bold' : 'text-indigo-600 font-semibold'}>
              {orders.length} overall
            </span>
            {selectedServiceFilter === 'All' && (
              <span className="bg-indigo-500/20 text-indigo-200 font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider scale-90">
                All Active
              </span>
            )}
          </div>
        </button>

        {/* Card 2: Total Visa service */}
        <button
          type="button"
          onClick={() => setSelectedServiceFilter(prev => prev === 'Visa' ? 'All' : 'Visa')}
          className={`group p-4 rounded-2xl text-left border-2 transition-all duration-200 relative overflow-hidden focus:outline-none cursor-pointer hover:shadow-md ${
            selectedServiceFilter === 'Visa'
              ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-md ring-2 ring-amber-500/15'
              : 'bg-white border-slate-200 hover:border-slate-350 text-slate-850 shadow-sm'
          }`}
        >
          {/* Subtle background decoration */}
          <div className="absolute right-0 bottom-0 opacity-[0.03] text-amber-600 translate-x-4 translate-y-4">
            <Plane className="h-24 w-24 rotate-45" />
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] uppercase tracking-wider font-extrabold ${
              selectedServiceFilter === 'Visa' ? 'text-amber-800' : 'text-slate-400'
            }`}>
              Visa Services
            </span>
            <div className={`p-1.5 rounded-xl transition-colors ${
              selectedServiceFilter === 'Visa' ? 'bg-amber-500 text-white shadow' : 'bg-amber-50 text-amber-600 group-hover:bg-amber-100'
            }`}>
              <Plane className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-3xl font-extrabold block tracking-tight leading-none text-slate-900">
              {todaysSchedule.filter(o => o.type === 'Visa').length}
            </span>
            <span className="text-[10px] font-medium text-slate-500 block leading-tight">
              Total Visa service
            </span>
          </div>

          {/* Active selection dot or pill */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] font-mono">
            <span className="text-amber-800 font-bold">
              {orders.filter(o => o.type === 'Visa').length} overall
            </span>
            <span className={`px-1.5 py-0.2 rounded-full uppercase tracking-wider font-extrabold ${
              selectedServiceFilter === 'Visa' 
                ? 'bg-amber-500 text-white scale-90' 
                : 'bg-amber-50 text-amber-700 group-hover:bg-amber-100 text-[8px]'
            }`}>
              {selectedServiceFilter === 'Visa' ? 'FILTERED' : 'FILTER'}
            </span>
          </div>
        </button>

        {/* Card 3: Total Fast track service */}
        <button
          type="button"
          onClick={() => setSelectedServiceFilter(prev => prev === 'FastTrack' ? 'All' : 'FastTrack')}
          className={`group p-4 rounded-2xl text-left border-2 transition-all duration-200 relative overflow-hidden focus:outline-none cursor-pointer hover:shadow-md ${
            selectedServiceFilter === 'FastTrack'
              ? 'bg-purple-50 border-purple-500 text-purple-950 shadow-md ring-2 ring-purple-500/15'
              : 'bg-white border-slate-200 hover:border-slate-350 text-slate-850 shadow-sm'
          }`}
        >
          {/* Subtle background decoration */}
          <div className="absolute right-0 bottom-0 opacity-[0.03] text-purple-650 translate-x-4 translate-y-4">
            <Sparkles className="h-24 w-24" />
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] uppercase tracking-wider font-extrabold ${
              selectedServiceFilter === 'FastTrack' ? 'text-purple-800' : 'text-slate-400'
            }`}>
              Fast Track
            </span>
            <div className={`p-1.5 rounded-xl transition-colors ${
              selectedServiceFilter === 'FastTrack' ? 'bg-purple-500 text-white shadow' : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100'
            }`}>
              <Sparkles className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-3xl font-extrabold block tracking-tight leading-none text-slate-900">
              {todaysSchedule.filter(o => o.type === 'FastTrack').length}
            </span>
            <span className="text-[10px] font-medium text-slate-500 block leading-tight">
              Total Fast track service
            </span>
          </div>

          {/* Active selection dot or pill */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] font-mono">
            <span className="text-purple-800 font-bold">
              {orders.filter(o => o.type === 'FastTrack').length} overall
            </span>
            <span className={`px-1.5 py-0.2 rounded-full uppercase tracking-wider font-extrabold ${
              selectedServiceFilter === 'FastTrack' 
                ? 'bg-purple-500 text-white scale-90' 
                : 'bg-purple-50 text-purple-700 group-hover:bg-purple-100 text-[8px]'
            }`}>
              {selectedServiceFilter === 'FastTrack' ? 'FILTERED' : 'FILTER'}
            </span>
          </div>
        </button>

        {/* Card 4: Total Airport Transfer service */}
        <button
          type="button"
          onClick={() => setSelectedServiceFilter(prev => prev === 'AirportPickup' ? 'All' : 'AirportPickup')}
          className={`group p-4 rounded-2xl text-left border-2 transition-all duration-200 relative overflow-hidden focus:outline-none cursor-pointer hover:shadow-md ${
            selectedServiceFilter === 'AirportPickup'
              ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-md ring-2 ring-emerald-500/15'
              : 'bg-white border-slate-200 hover:border-slate-350 text-slate-850 shadow-sm'
          }`}
        >
          {/* Subtle background decoration */}
          <div className="absolute right-0 bottom-0 opacity-[0.03] text-emerald-600 translate-x-4 translate-y-4">
            <Car className="h-24 w-24" />
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] uppercase tracking-wider font-extrabold ${
              selectedServiceFilter === 'AirportPickup' ? 'text-emerald-800' : 'text-slate-400'
            }`}>
              Airport Transfers
            </span>
            <div className={`p-1.5 rounded-xl transition-colors ${
              selectedServiceFilter === 'AirportPickup' ? 'bg-emerald-500 text-white shadow' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'
            }`}>
              <Car className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-3xl font-extrabold block tracking-tight leading-none text-slate-900">
              {todaysSchedule.filter(o => o.type === 'AirportPickup').length}
            </span>
            <span className="text-[10px] font-medium text-slate-500 block leading-tight">
              Total Airport Transfer service
            </span>
          </div>

          {/* Active selection dot or pill */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] font-mono">
            <span className="text-emerald-800 font-bold">
              {orders.filter(o => o.type === 'AirportPickup').length} overall
            </span>
            <span className={`px-1.5 py-0.2 rounded-full uppercase tracking-wider font-extrabold ${
              selectedServiceFilter === 'AirportPickup' 
                ? 'bg-emerald-500 text-white scale-90' 
                : 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100 text-[8px]'
            }`}>
              {selectedServiceFilter === 'AirportPickup' ? 'FILTERED' : 'FILTER'}
            </span>
          </div>
        </button>

      </div>

      {/* MAIN TWO-COLUMN SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: CRITICAL ACTION CENTRE (8/12) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-800 text-sm">
                    ⚠️ Critical Action Centre & Flight Risk Warnings
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Auto-flagging service orders within <span className="text-red-600 font-extrabold">24 hours</span> missing field staff or vehicle dispatch.
                  </p>
                </div>
              </div>
              <span className="bg-red-50 text-red-700 font-bold text-[10px] px-2 py-0.5 rounded-full uppercase border border-red-200/50 shrink-0">
                {filteredAlerts.length} Issues Active
              </span>
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-bold text-slate-700">All Operations Clear!</p>
                <p className="text-[11px] text-slate-400">Zero immediate warnings flagged for sim date: {activeSimDate}</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {filteredAlerts.map((alert) => {
                  const isCritical = alert.type === 'critical';
                  return (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-xl border text-xs leading-normal transition-all space-y-3 ${
                        isCritical 
                          ? 'border-red-200 bg-red-50/15 shadow-sm' 
                          : 'border-amber-250 bg-amber-50/15'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider ${
                          isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {alert.category}
                        </span>
                        
                        <div className="flex items-center space-x-2 font-mono text-[9.5px]">
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold">
                            {alert.order.id}
                          </span>
                          <span className="text-slate-400">
                            {alert.order.type === 'FastTrack'
                              ? `Fasttrack (${(alert.order.details as any)?.serviceDirection || (alert.order.details as any)?.direction || 'Arrival'})`
                              : alert.order.type === 'AirportPickup'
                                ? `Car/Bus (${(alert.order.details as any)?.direction || 'Arrival'})`
                                : alert.order.type}
                          </span>
                        </div>
                      </div>

                      <p className="text-slate-700 font-medium">
                        {alert.message}
                      </p>

                      <div className="pt-2 border-t border-slate-100/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 font-medium">
                          <span className="font-bold text-slate-600">Payment: </span>
                          <span>{alert.order.paymentStatus}</span>
                          <span className="text-slate-300">|</span>
                          <span className="font-bold text-slate-600">Base Stat: </span>
                          <span>{alert.order.status}</span>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {onOpenInManagement && (
                            <button
                              type="button"
                              onClick={() => {
                                const baseOrderId = alert.order.id.replace('_secondary', '');
                                onOpenInManagement(baseOrderId);
                              }}
                              className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[10px] px-2.5 py-1 rounded-lg border border-purple-200 transition-colors cursor-pointer"
                            >
                              {language === 'EN' ? 'Open in Order Management ➜' : 'Mở trong Order Management ➜'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* OVERDUE LISTINGS IF ANY (WARNING SIGN DECORATIVE & OPERATIONAL) */}
          {filteredOverdueSchedule.length > 0 && (
            <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200/55 space-y-3 text-xs shadow-sm">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[10px] font-extrabold text-amber-800 tracking-wider uppercase flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  ⚠️ Overdue Services Pending Completion ({filteredOverdueSchedule.length})
                </span>
                <span className="text-[9.5px] text-slate-500 italic">Traveler arrival dates have already passed</span>
              </div>
              
              <div className="divide-y divide-amber-200/40 space-y-2">
                {filteredOverdueSchedule.map((order) => {
                  const sDate = getServiceDateStr(order);
                  return (
                    <div key={order.id} className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] first:pt-0">
                      <div>
                        <strong className="text-slate-800">{getPassengerName(order)}</strong>
                        <span className="text-slate-400 mx-1.5">|</span>
                        <span className="font-mono text-indigo-700 font-bold inline-block mr-2">{order.id}</span>
                        <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.2 rounded font-black tracking-wider">
                          PAST DUE ({sDate})
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-slate-550 font-bold">Status: "{order.status}"</span>
                        <button
                          type="button"
                          onClick={() => {
                            const completedStatus = 'Completed';
                            setOrders(orders.map(o => o.id === order.id ? { ...o, status: completedStatus } : o));
                          }}
                          className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[9.5px] font-bold cursor-pointer"
                        >
                          Mark Settled Today
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: CHRONOLOGY BOARD (4/12) */}
        <div className="lg:col-span-4 space-y-4">

          {/* TODAY'S PASSENGER FLIGHT ARRIVAL RUN SHEET (REALTIME) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
              <div className="pb-2 border-b border-indigo-50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-emerald-500 shrink-0" />
                  ⚡ Today's Dispatch Board (Simulated)
                </span>
                <span className="bg-indigo-50 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                  {activeSimDate}
                </span>
              </div>

              {filteredTodaysSchedule.length === 0 ? (
                <div className="py-6 text-center text-slate-400 space-y-1">
                  <Users className="h-5 w-5 text-slate-300 mx-auto" />
                  <p className="text-[10px] font-bold text-slate-500">No scheduled activities today</p>
                  <p className="text-[9px]">Check other simulated date scales</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTodaysSchedule.map((order) => {
                    const details = order.details as any;
                    const partnerAssigned = assignedPartners[order.id];
                    return (
                      <div key={order.id} className="p-3 bg-slate-50/60 rounded-lg border border-slate-100 text-xs text-slate-700 space-y-2">
                        <div className="flex justify-between items-center">
                          <strong className="text-slate-800 text-[11px] font-bold">{getPassengerName(order)}</strong>
                          <span className="font-mono text-[10px] font-semibold text-indigo-700">{order.id}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-1 text-[10px] font-medium text-slate-500">
                          <div>
                            <span>Service: </span>
                            <span className="text-indigo-650 font-bold">
                              {order.type === 'FastTrack'
                                ? `Fasttrack (${(order.details as any)?.serviceDirection || (order.details as any)?.direction || 'Arrival'})`
                                : order.type === 'AirportPickup'
                                  ? `Car/Bus (${(order.details as any)?.direction || 'Arrival'})`
                                  : order.type}
                            </span>
                          </div>
                          <div>
                            <span>Flight/Time: </span>
                            <strong className="text-slate-800">{details.flightNumber || 'N/A'}{details.arrivalTime ? ` @ ${details.arrivalTime}` : ''}</strong>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[10.5px]">
                          <span className="text-slate-400">
                            Partner: <span className="font-bold text-slate-600">
                              {partnerAssigned ? PARTNERS[order.type]?.find(p => p.id === partnerAssigned)?.name : 'Unassigned'}
                            </span>
                          </span>
                          
                          <span className="bg-emerald-50 text-emerald-800 font-bold rounded px-1.5 text-[9px] uppercase">
                            {order.status}
                          </span>
                        </div>

                        {/* Immediate quick complete if arriving today */}
                        {order.status !== 'Completed' && order.status !== 'Approved & Issued' && order.status !== 'Service Completed' && order.status !== 'JourneyCompleted' && (
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                const doneState = 'Completed';
                                setOrders(orders.map(o => o.id === order.id ? { ...o, status: doneState } : o));
                              }}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[9px] tracking-wide uppercase px-2 py-0.5 rounded cursor-pointer transition-all"
                            >
                              Mark Clearance Done!
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          {/* TOMORROW'S PREVIEW BOARD */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
              <div className="pb-2 border-b border-indigo-50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-purple-500 shrink-0" />
                  🗓️ Tomorrow's Dispatch Board
                </span>
                <span className="bg-purple-50 text-purple-700 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                  {tomorrowSimDate}
                </span>
              </div>

              {filteredTomorrowsSchedule.length === 0 ? (
                <div className="py-6 text-center text-slate-400 space-y-1">
                  <Users className="h-5 w-5 text-slate-300 mx-auto" />
                  <p className="text-[10px] font-bold text-slate-500">No arrivals scheduled tomorrow</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTomorrowsSchedule.map((order) => {
                    const details = order.details as any;
                    const partnerAssigned = assignedPartners[order.id];
                    return (
                      <div key={order.id} className="p-3 bg-purple-50/30 rounded-lg border border-purple-100/60 text-xs text-slate-700 space-y-2">
                        <div className="flex justify-between items-center">
                          <strong className="text-slate-800 text-[11px] font-bold">{getPassengerName(order)}</strong>
                          <span className="font-mono text-[10px] font-semibold text-purple-700">{order.id}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-1 text-[10px] font-medium text-slate-500">
                          <div>
                            <span>Service: </span>
                            <span className="text-purple-650 font-bold">
                              {order.type === 'FastTrack'
                                ? `Fasttrack (${(order.details as any)?.serviceDirection || (order.details as any)?.direction || 'Arrival'})`
                                : order.type === 'AirportPickup'
                                  ? `Car/Bus (${(order.details as any)?.direction || 'Arrival'})`
                                  : order.type}
                            </span>
                          </div>
                          <div>
                            <span>Flight/Time: </span>
                            <strong className="text-slate-800">{details.flightNumber || 'N/A'}{details.arrivalTime ? ` @ ${details.arrivalTime}` : ''}</strong>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-purple-100/50 text-[10.5px]">
                          <span className="text-slate-400">
                            Partner: <span className="font-bold text-slate-600">
                              {partnerAssigned ? PARTNERS[order.type]?.find(p => p.id === partnerAssigned)?.name : 'Unassigned'}
                            </span>
                          </span>
                          
                          <span className="bg-purple-100 text-purple-800 font-bold rounded px-1.5 text-[9px] uppercase">
                            {order.status}
                          </span>
                        </div>

                        {/* Immediate quick complete if arriving tomorrow */}
                        {order.status !== 'Completed' && order.status !== 'Approved & Issued' && order.status !== 'Service Completed' && order.status !== 'JourneyCompleted' && (
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                const doneState = 'Completed';
                                setOrders(orders.map(o => o.id === order.id ? { ...o, status: doneState } : o));
                              }}
                              className="bg-purple-600 hover:bg-purple-700 text-white font-black text-[9px] tracking-wide uppercase px-2 py-0.5 rounded cursor-pointer transition-all font-sans"
                            >
                              Mark Clearance Done!
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


        </div>

      </div>
      
    </div>
  );
}
