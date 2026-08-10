import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Send, CheckCircle, Clock, Sparkles, Check, 
  Smartphone, Share2, Clipboard, ArrowRight, UserCheck, AlertCircle, 
  RefreshCw, Layers, FileText, PhoneCall, CheckSquare, Search, Filter,
  ExternalLink, User, Compass, HelpCircle, ClipboardCheck, ArrowUpRight,
  ChevronRight, ChevronDown, Building, ShieldAlert, CheckSquare2, X
} from 'lucide-react';
import { Order, Currency, CURRENCY_SYMBOLS, OrderEditLogEntry } from '../types';
import { safeStorage, safeOpen } from '../utils/storage';
import { getSplitOrders } from '../utils/orderUtils';
import { formatPhoneE164, isValidInternationalPhone, isValidFlightNumber, isValidEmail, parsePhoneAndChannel, isValidPassportNumber } from '../utils/validation';
import { auth } from '../utils/firebase';
import { getServiceStatusOptions, getSubStatusOptions, getSubStatusLabel, getStatusLabel } from '../utils/orderStatus';
import EditableOrderField from './EditableOrderField';

interface OMSAgencyCommsProps {
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  discussions: Record<string, Array<{ sender: 'digivisa' | 'partner' | 'system', text: string, timestamp: string }>>;
  currency: Currency;
  assignedPartners: Record<string, string>;
  setAssignedPartners?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  PARTNERS: Record<string, Array<{ id: string; name: string; contact: string; rating: string; activeOrders: number }>>;
  onSelectOrder: (orderId: string, tab: 'All' | 'Visa' | 'FastTrack' | 'AirportPickup') => void;
  initialSelectedOrderId?: string | null;
  language?: string;
  onUpdateOrder?: (orderId: string, fields: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
}

const getCustomerName = (order: Order) => {
  const details = order.details as any;
  if (!details) return 'N/A';
  if (order.type === 'Visa') {
    return `${details.firstName || ''} ${details.lastName || ''}`.trim() || 'No Name';
  }
  return details.contactName || details.passengerName || 'No Name';
};

const getCustomerContact = (order: Order) => {
  const details = order.details as any;
  if (!details) return { email: 'N/A', phone: 'N/A' };
  if (order.type === 'Visa') {
    const parsed = parsePhoneAndChannel(details.phone, details.contactPref);
    return { email: details.email || 'N/A', phone: parsed.phone ? formatPhoneE164(parsed.phone) : 'N/A' };
  }
  const rawPhone = details.contactPhone || details.passengerPhone;
  const parsed = parsePhoneAndChannel(rawPhone, details.contactPref);
  return { 
    email: details.contactEmail || details.passengerEmail || 'N/A', 
    phone: parsed.phone ? formatPhoneE164(parsed.phone) : 'N/A' 
  };
};

const getDisplayVisaType = (details: any): string => {
  if (!details) return 'N/A';
  const dest = details.destinationCountry || 'Vietnam';
  const raw = details.visaType || 'N/A';
  if (dest !== 'Vietnam') {
    if (raw === 'Tourist (90 Days)' || raw === 'Multiple eVisa' || raw === 'Multiple') return 'Multiple';
    return 'Single';
  }
  return raw;
};

function StaffPhotoAvatar({ 
  src, 
  alt, 
  sizeClass = "h-12 w-12", 
  onPreview 
}: { 
  src?: string | null; 
  alt?: string; 
  sizeClass?: string; 
  onPreview?: (url: string) => void;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div className={`${sizeClass} rounded-full bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center shrink-0`}>
        <User className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || 'Staff Portrait'}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      onClick={() => onPreview?.(src)}
      className={`${sizeClass} rounded-full border border-slate-200 object-cover shrink-0 ${
        onPreview ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
      }`}
    />
  );
}

export default function OMSAgencyComms({
  orders,
  setOrders,
  discussions,
  currency,
  assignedPartners,
  setAssignedPartners,
  PARTNERS,
  onSelectOrder,
  initialSelectedOrderId,
  language = 'EN',
  onUpdateOrder
}: OMSAgencyCommsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Visa' | 'FastTrack' | 'AirportPickup'>('All');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(initialSelectedOrderId || '');
  
  // Custom manual discussion note state
  const [liaisonNote, setLiaisonNote] = useState('');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [dossierTransferSuccess, setDossierTransferSuccess] = useState<string | null>(null);

  // Group Chat Link state for staff
  const [waGroupInput, setWaGroupInput] = useState('');
  const [zaGroupInput, setZaGroupInput] = useState('');
  const [groupLinkError, setGroupLinkError] = useState('');
  const [groupLinkSuccess, setGroupLinkSuccess] = useState('');
  const [isSavingGroupLinks, setIsSavingGroupLinks] = useState(false);


  const getDossierText = (order: Order, serviceType: string): string => {
    if (!order) return '';
    const name = getCustomerName(order);
    const details = order.details as any;
    
    let result = `====================================\n`;
    result += `📋 OFFICIAL CUSTOMER DOSSIER - DIGIVISA\n`;
    result += `====================================\n`;
    result += `• Booking ID: ${order.id}\n`;
    result += `• Passenger Name: ${name}\n`;
    result += `• Primary Email: ${getCustomerContact(order).email}\n`;
    result += `• Contact Phone: ${getCustomerContact(order).phone}\n`;
    result += `• Allocated Service: ${serviceType}\n`;
    
    if (serviceType === 'Visa') {
      result += `• Destination Country: ${details.destinationCountry || 'Vietnam'}\n`;
      result += `• Passport Number: ${details.passportNumber || 'N/A'}\n`;
      result += `• Passport Expiry: ${details.passportExpiry || 'N/A'}\n`;
      result += `• Nationality: ${details.nationality || 'N/A'}\n`;
      result += `• Date of Birth: ${details.dateOfBirth || 'N/A'}\n`;
      result += `• Visa Classification: ${getDisplayVisaType(details)}\n`;
      result += `• Processing Priority: ${details.processingSpeed || 'Standard'}\n`;
      result += `• Target Arrival Date: ${details.arrivalDate || 'N/A'}\n`;
      result += `• Passport Scan Document: ${details.passportScan || 'N/A'}\n`;
    } else if (serviceType === 'FastTrack') {
      result += `• Service Direction: ${details.serviceDirection || 'Arrival'}\n`;
      result += `• Flight Number: ${details.flightNumber || 'N/A'}\n`;
      result += `• Landing Schedule: ${details.arrivalDate || 'N/A'} at ${details.arrivalTime || 'N/A'}\n`;
      result += `• VIP Package Class: ${details.packageType || 'Fast Track Standard'}\n`;
      if (details.hasEsim) {
        result += `• Includes Airport eSIM Option: Yes\n`;
      }
      if (details.addAirportPickup) {
        result += `• Dual Service (Pickup destination): ${details.pickupDestination || 'N/A'}\n`;
      }
      result += `• Liaison Special Requests: ${details.specialRequests || 'None'}\n`;
    } else { // AirportPickup
      result += `• Pickup Schedule: ${details.pickupDate || 'N/A'} at ${details.pickupTime || 'N/A'}\n`;
      result += `• Direction: ${details.direction || 'Arrival'}\n`;
      result += `• Fleet Vehicle Required: ${details.vehicleType || '4 seats'}\n`;
      if (details.direction !== 'Departure') {
        result += `• Flight Number: ${details.flightNumber || 'N/A'}\n`;
      }
      result += `• Destination Address: ${details.destinationAddress || 'N/A'}\n`;
      result += `• Pickup Address: ${details.pickupAddress || 'Airport'}\n`;
      result += `• Chauffeur Special Memos: ${details.optionalNote || 'None'}\n`;
    }
    
    result += `====================================\n`;
    result += `Please process this booking accordingly. Notify our operations dispatcher if any document validation issues occur. Thank you.`;
    return result;
  };



  // Filtered order list
  const filteredOrders = getSplitOrders(orders).filter(o => {
    if (!o || !o.id) return false;
    const matchesType = filterType === 'All' || o.type === filterType;
    if (!matchesType) return false;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    // 1. Match Order ID
    if ((o.id || '').toLowerCase().includes(q)) return true;

    // 2. Match Customer Name
    const custName = getCustomerName(o).toLowerCase();
    if (custName !== 'n/a' && custName.includes(q)) return true;

    // 3. Match Email
    const details = (o.details || {}) as any;
    const contact = getCustomerContact(o);
    const emailList = [
      contact.email,
      details.email,
      details.contactEmail,
      details.passengerEmail
    ];
    for (const em of emailList) {
      if (em && typeof em === 'string' && em.toLowerCase() !== 'n/a' && em.toLowerCase().includes(q)) {
        return true;
      }
    }

    // 4. Match Phone Number (requires at least 3 digits, single-direction comparison, plus 0/84 normalization)
    const qDigits = q.replace(/\D/g, '');
    if (qDigits.length >= 3) {
      const phoneList = [
        contact.phone,
        details.phone,
        details.contactPhone,
        details.passengerPhone
      ];
      const normQ = qDigits.startsWith('84') ? '0' + qDigits.slice(2) : qDigits;
      for (const ph of phoneList) {
        if (ph && typeof ph === 'string' && ph.toLowerCase() !== 'n/a') {
          const phDigits = ph.replace(/\D/g, '');
          if (phDigits.length > 0) {
            if (phDigits.includes(qDigits)) {
              return true;
            }
            const normPh = phDigits.startsWith('84') ? '0' + phDigits.slice(2) : phDigits;
            if (normPh.includes(normQ)) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }).sort((a, b) => {
    const getOrderTime = (o: Order) => {
      if (!o || !o.createdAt) return 0;
      const t = new Date(o.createdAt).getTime();
      return isNaN(t) ? 0 : t;
    };

    const timeA = getOrderTime(a);
    const timeB = getOrderTime(b);

    if (timeB !== timeA) {
      return timeB - timeA;
    }

    // Tie-breaker when creation times are equal:
    // 1. Group by base order ID first so legs of the same order stay together
    const baseIdA = (a.id || '').replace('_secondary', '');
    const baseIdB = (b.id || '').replace('_secondary', '');
    if (baseIdA !== baseIdB) {
      return baseIdA.localeCompare(baseIdB);
    }

    // 2. For legs of the exact same combo order, primary leg comes before secondary leg
    const aIsSec = (a.id || '').endsWith('_secondary');
    const bIsSec = (b.id || '').endsWith('_secondary');
    if (aIsSec !== bIsSec) {
      return aIsSec ? 1 : -1;
    }

    return 0;
  });

  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [isEditLogOpen, setIsEditLogOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewPhotoUrl(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedOrder = getSplitOrders(orders).find(o => o.id === selectedOrderId) || getSplitOrders(orders)[0];

  const handleSaveField = async (
    fieldPath: string,
    newValue: string,
    logLabel: string
  ): Promise<{ success: boolean; error?: string }> => {
    const baseId = selectedOrder.id.replace('_secondary', '');
    const baseOrder = orders.find((o) => o.id === baseId) || selectedOrder;

    const subKey = fieldPath.startsWith('details.') ? fieldPath.replace('details.', '') : fieldPath;
    const oldValue = ((((baseOrder.details as any)?.[subKey] ?? (baseOrder as any)?.[subKey]) || '') as string).trim();

    const oldEditLog: OrderEditLogEntry[] = (baseOrder as any).editLog || [];

    const newLogEntry: OrderEditLogEntry = {
      field: fieldPath,
      label: logLabel,
      oldValue: oldValue || 'N/A',
      newValue: newValue,
      by: auth.currentUser?.email || 'staff',
      at: new Date().toISOString(),
      reason: ''
    };

    const payload: Record<string, any> = {
      [fieldPath]: newValue,
      editLog: [...oldEditLog, newLogEntry]
    };

    // If saving a phone field for a legacy order without details.contactPref, extract and preserve the old channel if present
    if (
      (subKey === 'contactPhone' || subKey === 'passengerPhone' || subKey === 'phone') &&
      !(baseOrder.details as any)?.contactPref
    ) {
      const parsedOld = parsePhoneAndChannel(oldValue);
      if (parsedOld.channel) {
        payload['details.contactPref'] = parsedOld.channel;
      }
    }

    const res = await onUpdateOrder?.(baseId, payload);
    return res || { success: true };
  };

  const [staffInputs, setStaffInputs] = useState<{
    staffName: string;
    staffPhone: string;
    staffLocation: string;
    staffPhoto: string;
    licensePlate: string;
    carPhoto: string;
  }>({
    staffName: '',
    staffPhone: '',
    staffLocation: '',
    staffPhoto: '',
    licensePlate: '',
    carPhoto: '',
  });
  const [staffPhoneError, setStaffPhoneError] = useState<string | null>(null);

  // Sync local draft inputs whenever selectedOrder changes
  useEffect(() => {
    if (selectedOrder) {
      const isSec = selectedOrder.id.endsWith('_secondary');
      const o = selectedOrder as any;
      setStaffInputs({
        staffName: isSec ? (o.secondaryStaffName || '') : (selectedOrder.staffName || ''),
        staffPhone: isSec ? (o.secondaryStaffPhone || '') : (selectedOrder.staffPhone || ''),
        staffLocation: isSec ? (o.secondaryStaffLocation || '') : (selectedOrder.staffLocation || ''),
        staffPhoto: isSec ? (o.secondaryStaffPhoto || '') : (selectedOrder.staffPhoto || ''),
        licensePlate: isSec ? (o.secondaryLicensePlate || '') : (selectedOrder.licensePlate || ''),
        carPhoto: isSec ? (o.secondaryCarPhoto || '') : (selectedOrder.carPhoto || ''),
      });
      setStaffPhoneError(null);
    }
  }, [
    selectedOrder?.id,
    selectedOrder?.staffName,
    selectedOrder?.staffPhone,
    selectedOrder?.staffLocation,
    selectedOrder?.staffPhoto,
    selectedOrder?.licensePlate,
    selectedOrder?.carPhoto,
    (selectedOrder as any)?.secondaryStaffName,
    (selectedOrder as any)?.secondaryStaffPhone,
    (selectedOrder as any)?.secondaryStaffLocation,
    (selectedOrder as any)?.secondaryStaffPhoto,
    (selectedOrder as any)?.secondaryLicensePlate,
    (selectedOrder as any)?.secondaryCarPhoto,
  ]);

  const isSecLeg = Boolean(selectedOrder?.id?.endsWith('_secondary'));

  // Detect if selected order is a combo (evaluating base/parent order so secondary leg row resolves correctly)
  const isOrderCombo = (() => {
    if (!selectedOrder) return false;
    const baseId = selectedOrder.id.replace('_secondary', '');
    const parentOrder = (orders || []).find((o) => o.id === baseId) || selectedOrder;

    return Boolean(
      (parentOrder.type === 'FastTrack' && (parentOrder.details as any)?.addAirportPickup) ||
      (parentOrder.type === 'AirportPickup' && (parentOrder.details as any)?.addFastTrack)
    );
  })();

  // Determine active service type
  const activeServiceType = selectedOrder?.type || 'Visa';

  // Helper to translate service code to user-facing name
  const getServiceName = (serviceType: string, lang: string = 'EN'): string => {
    if (serviceType === 'FastTrack') return 'Fast Track';
    if (serviceType === 'AirportPickup') return lang === 'EN' ? 'Airport Pickup' : 'Đưa đón sân bay';
    if (serviceType === 'Visa') return 'Visa';
    return serviceType;
  };

  // Determine active partner ID
  const activePartnerId = selectedOrder ? (
    isSecLeg
      ? ((selectedOrder as any)?.assignedPartnerIdSecondary || assignedPartners[selectedOrder.id])
      : ((selectedOrder as any)?.assignedPartnerId || assignedPartners[selectedOrder.id])
  ) : undefined;

  const currentWaUrl = (() => {
    if (!selectedOrder) return '';
    const baseId = isSecLeg ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;
    const parentOrder = (orders || []).find((o) => o.id === baseId) || selectedOrder;
    return isSecLeg ? (parentOrder.whatsappGroupUrlSecondary || '') : (parentOrder.whatsappGroupUrl || '');
  })();

  const currentZaUrl = (() => {
    if (!selectedOrder) return '';
    const baseId = isSecLeg ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;
    const parentOrder = (orders || []).find((o) => o.id === baseId) || selectedOrder;
    return isSecLeg ? (parentOrder.zaloGroupUrlSecondary || '') : (parentOrder.zaloGroupUrl || '');
  })();

  useEffect(() => {
    if (selectedOrder) {
      setWaGroupInput(currentWaUrl);
      setZaGroupInput(currentZaUrl);
      setGroupLinkError('');
      setGroupLinkSuccess('');
    }
  }, [selectedOrder?.id, currentWaUrl, currentZaUrl]);

  const handleSaveGroupLinks = async () => {
    if (!selectedOrder) return;
    setIsSavingGroupLinks(true);
    setGroupLinkError('');
    setGroupLinkSuccess('');

    try {
      const user = auth.currentUser;
      if (!user) {
        setGroupLinkError('Chưa đăng nhập tài khoản Staff');
        setIsSavingGroupLinks(false);
        return;
      }

      const token = await user.getIdToken();
      const isSec = selectedOrder.id.endsWith('_secondary');
      const baseId = isSec ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;

      const res = await fetch('/api/order-set-group-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: baseId,
          whatsappGroupUrl: waGroupInput,
          zaloGroupUrl: zaGroupInput,
          leg: isSec ? 'secondary' : 'primary',
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok || !data.success) {
        setGroupLinkError(data.error || 'Lỗi khi cập nhật link nhóm');
        setIsSavingGroupLinks(false);
        return;
      }

      const updated = orders.map((o) => {
        if (o.id === baseId) {
          if (isSec) {
            return {
              ...o,
              whatsappGroupUrlSecondary: data.whatsappGroupUrlSecondary || undefined,
              zaloGroupUrlSecondary: data.zaloGroupUrlSecondary || undefined,
              groupLinkUpdatedAtSecondary: data.groupLinkUpdatedAtSecondary,
            };
          } else {
            return {
              ...o,
              whatsappGroupUrl: data.whatsappGroupUrl || undefined,
              zaloGroupUrl: data.zaloGroupUrl || undefined,
              groupLinkUpdatedAt: data.groupLinkUpdatedAt,
            };
          }
        }
        return o;
      });

      setOrders(updated);
      setGroupLinkSuccess('Cập nhật link nhóm chat thành công!');
    } catch (err: any) {
      setGroupLinkError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsSavingGroupLinks(false);
    }
  };

  // Look up actual partner details from PARTNERS
  const activePartner = activeServiceType && activePartnerId
    ? PARTNERS[activeServiceType]?.find(p => p.id === activePartnerId)
    : undefined;

  // Get Primary and Secondary Partner assigned to this booking
  const primaryId = selectedOrder ? (selectedOrder.id.endsWith('_secondary') ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id) : undefined;
  const secondaryId = primaryId ? primaryId + '_secondary' : undefined;

  const primaryPartnerId = primaryId ? assignedPartners[primaryId] : undefined;
  const primaryPartnerObj = selectedOrder && primaryId ? PARTNERS[selectedOrder.type]?.find(p => p.id === primaryPartnerId) : undefined;

  const secondaryType = selectedOrder?.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack';
  const secondaryPartnerId = secondaryId ? assignedPartners[secondaryId] : undefined;
  const secondaryPartnerObj = selectedOrder && secondaryId ? PARTNERS[secondaryType]?.find(p => p.id === secondaryPartnerId) : undefined;

  // Assigned Agency Info helper
  const getAssignedAgencyInfo = (type: string, partnerObj?: any) => {
    const channel = type === 'Visa' 
      ? 'Zalo Group (Vietnam Legal Embassy Link)' 
      : type === 'FastTrack' 
        ? 'Zalo Group (VIP FastTrack Ops)' 
        : 'WhatsApp (VIP Fleet Dispatch Hub)';
    
    if (partnerObj) {
      const phone = partnerObj.contact.includes('Kevin') ? '+84912334556' 
                  : partnerObj.contact.includes('Vy') ? '+84905558221'
                  : partnerObj.contact.includes('Huong') ? '+84945889122'
                  : partnerObj.contact.includes('David') ? '+84909112233'
                  : partnerObj.contact.includes('Nam') ? '+84909667334'
                  : '+84912345678';
      return {
        agencyName: partnerObj.name,
        representative: partnerObj.contact,
        contactChannel: channel,
        phone: phone,
        badgeColor: type === 'Visa' 
          ? 'bg-purple-100 text-purple-700' 
          : type === 'FastTrack' 
            ? 'bg-emerald-100 text-emerald-700' 
            : 'bg-blue-100 text-blue-700'
      };
    }

    // Default Fallbacks
    if (type === 'Visa') {
      return {
        agencyName: 'VietConsular Legal Liaison HQ',
        representative: 'Ms. Huong Nguyen (Legal Lead)',
        contactChannel: 'Zalo Group (Vietnam Legal Embassy Link)',
        phone: '+84945889122',
        badgeColor: 'bg-purple-100 text-purple-700 border-purple-200'
      };
    } else if (type === 'FastTrack') {
      return {
        agencyName: 'Noi Bai & SGN Elite Escort Group (Pending Assignment)',
        representative: 'Mr. Kevin Pham (Liaison Lead)',
        contactChannel: 'Zalo Group (Noi Bai VIP FastTrack Ops)',
        phone: '+84912334556',
        badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200'
      };
    } else {
      return {
        agencyName: 'Luxury Fleet Transport Ltd (Pending Assignment)',
        representative: 'Mr. David Hoang (Fleet Dispatcher)',
        contactChannel: 'WhatsApp (Hanoi Fleet Dispatch Hub)',
        phone: '+84909112233',
        badgeColor: 'bg-blue-100 text-blue-700 border-blue-200'
      };
    }
  };

  // Quick Action: Change Order Status & record log
  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedOrder) return;

    const isSec = selectedOrder.id.endsWith('_secondary');
    const baseId = isSec ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;
    const parentOrder = (orders || []).find(o => o.id === baseId);
    const existingNotes = (parentOrder as any)?.opsNotes || [];

    const legLabel = isSec ? 'Secondary Combo Leg' : 'Primary Leg';
    const noteText = `System update: ${legLabel} (${activeServiceType}) status updated to "${newStatus}".`;

    const newNote = {
      text: noteText,
      by: auth.currentUser?.email || '',
      at: new Date().toISOString(),
      leg: (isSec ? 'secondary' : 'primary') as 'primary' | 'secondary'
    };

    const updatedOpsNotes = [...existingNotes, newNote];

    if (isSec) {
      await onUpdateOrder?.(baseId, { secondaryStatus: newStatus, secondarySubStatus: null, opsNotes: updatedOpsNotes });
    } else {
      const subOpts = getSubStatusOptions(newStatus, activeServiceType);
      const subStatus = subOpts.length > 0 ? subOpts[0] : null;
      await onUpdateOrder?.(baseId, { status: newStatus, subStatus, opsNotes: updatedOpsNotes });
    }
  };

  // Quick Action: Change Order Sub-Status & record log
  const handleUpdateSubStatus = async (newSubStatus: string) => {
    if (!selectedOrder) return;

    const isSec = selectedOrder.id.endsWith('_secondary');
    const baseId = isSec ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;
    const parentOrder = (orders || []).find(o => o.id === baseId);
    const existingNotes = (parentOrder as any)?.opsNotes || [];

    const legLabel = isSec ? 'Secondary Combo Leg' : 'Primary Leg';
    const noteText = `System update: ${legLabel} (${activeServiceType}) sub-status set to "${newSubStatus}".`;

    const newNote = {
      text: noteText,
      by: auth.currentUser?.email || '',
      at: new Date().toISOString(),
      leg: (isSec ? 'secondary' : 'primary') as 'primary' | 'secondary'
    };

    const updatedOpsNotes = [...existingNotes, newNote];

    if (isSec) {
      await onUpdateOrder?.(baseId, { secondarySubStatus: newSubStatus, opsNotes: updatedOpsNotes });
    } else {
      await onUpdateOrder?.(baseId, { subStatus: newSubStatus, opsNotes: updatedOpsNotes });
    }
  };

  // Quick Action: Update Staff or Vehicle dispatch details
  const handleUpdateStaffOrVehicle = async (field: string, value: string) => {
    if (!selectedOrder) return;
    const isSec = selectedOrder.id.endsWith('_secondary');
    const baseId = isSec ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;

    let targetField = field;
    if (isSec) {
      if (field === 'staffName') targetField = 'secondaryStaffName';
      else if (field === 'staffPhone') targetField = 'secondaryStaffPhone';
      else if (field === 'staffLocation') targetField = 'secondaryStaffLocation';
      else if (field === 'staffPhoto') targetField = 'secondaryStaffPhoto';
      else if (field === 'licensePlate') targetField = 'secondaryLicensePlate';
      else if (field === 'carPhoto') targetField = 'secondaryCarPhoto';
    }

    if (isSec) {
      const currentStatus = (selectedOrder as any).secondaryStatus || 'Confirmed';
      const nextStatus = (currentStatus === 'Confirmed' || currentStatus === 'Agency Review')
        ? 'Staff Assigned'
        : currentStatus;
      await onUpdateOrder?.(baseId, { [targetField]: value, secondaryStatus: nextStatus });
    } else {
      const currentStatus = selectedOrder.status || 'Confirmed';
      const nextStatus = (currentStatus === 'Confirmed' || currentStatus === 'Agency Review')
        ? 'Staff Assigned'
        : currentStatus;
      await onUpdateOrder?.(baseId, { [targetField]: value, status: nextStatus });
    }
  };

  // Commit field on blur or Enter press if value actually changed
  const handleCommitField = async (field: keyof typeof staffInputs) => {
    if (!selectedOrder) return;
    const isSec = selectedOrder.id.endsWith('_secondary');
    const o = selectedOrder as any;

    let origValue = '';
    if (field === 'staffName') origValue = isSec ? (o.secondaryStaffName || '') : (selectedOrder.staffName || '');
    else if (field === 'staffPhone') origValue = isSec ? (o.secondaryStaffPhone || '') : (selectedOrder.staffPhone || '');
    else if (field === 'staffLocation') origValue = isSec ? (o.secondaryStaffLocation || '') : (selectedOrder.staffLocation || '');
    else if (field === 'staffPhoto') origValue = isSec ? (o.secondaryStaffPhoto || '') : (selectedOrder.staffPhoto || '');
    else if (field === 'licensePlate') origValue = isSec ? (o.secondaryLicensePlate || '') : (selectedOrder.licensePlate || '');
    else if (field === 'carPhoto') origValue = isSec ? (o.secondaryCarPhoto || '') : (selectedOrder.carPhoto || '');

    const currentValue = staffInputs[field] || '';

    // Phone validation
    if (field === 'staffPhone') {
      const trimmed = currentValue.trim();
      if (trimmed !== '' && !isValidInternationalPhone(trimmed)) {
        setStaffPhoneError(
          language === 'EN'
            ? 'Invalid phone number format. Must be international format (e.g. +84909667334).'
            : 'Số điện thoại không hợp lệ. Vui lòng nhập đúng định dạng quốc tế (ví dụ: +84909667334).'
        );
        return; // DO NOT SAVE
      } else {
        setStaffPhoneError(null);
      }
    }

    // Only save if value actually changed
    if (currentValue.trim() === origValue.trim()) {
      return;
    }

    await handleUpdateStaffOrVehicle(field as string, currentValue.trim());
  };

  // Quick Action: Add internal ops note
  const handleAddLiaisonNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !liaisonNote.trim()) return;

    const isSec = selectedOrder.id.endsWith('_secondary');
    const baseId = isSec ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;
    const parentOrder = (orders || []).find(o => o.id === baseId);
    const existingNotes = (parentOrder as any)?.opsNotes || [];

    const newNote = {
      text: liaisonNote.trim(),
      by: auth.currentUser?.email || 'Operations',
      at: new Date().toISOString(),
      leg: (isSec ? 'secondary' : 'primary') as 'primary' | 'secondary'
    };

    const updatedOpsNotes = [...existingNotes, newNote];
    setLiaisonNote('');

    if (onUpdateOrder) {
      await onUpdateOrder(baseId, { opsNotes: updatedOpsNotes });
    }
  };

  // Helper to copy text templates to clipboard
  const handleCopyTemplate = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(label);
    setTimeout(() => setCopySuccess(null), 2500);
  };

  const handleTransferDossier = async (order: Order, serviceType: string) => {
    if (!order) return;
    const dossierText = getDossierText(order, serviceType);
    navigator.clipboard.writeText(dossierText);
    
    // Set success banner state
    setDossierTransferSuccess(order.id);
    setTimeout(() => {
      setDossierTransferSuccess(null);
    }, 4500);

    const isSec = order.id.endsWith('_secondary');
    const baseId = isSec ? order.id.replace('_secondary', '') : order.id;
    const parentOrder = (orders || []).find(o => o.id === baseId);
    const existingNotes = (parentOrder as any)?.opsNotes || [];

    const agencyName = currentAgency ? currentAgency.agencyName : 'assigned partner agency';
    const noteText = `System update: Staff transferred customer dossier details for ${serviceType} leg processing to ${agencyName}.`;

    const newNote = {
      text: noteText,
      by: auth.currentUser?.email || '',
      at: new Date().toISOString(),
      leg: (isSec ? 'secondary' : 'primary') as 'primary' | 'secondary'
    };

    const updatedOpsNotes = [...existingNotes, newNote];

    if (onUpdateOrder) {
      await onUpdateOrder(baseId, { opsNotes: updatedOpsNotes });
    }
  };

  // Pre-configured messaging templates based on current selected order
  const getMsgTemplates = (order: Order, typeOverride?: string) => {
    if (!order) return [];
    const type = typeOverride || order.type;
    const name = getCustomerName(order);
    const details = order.details as any;
    const flight = details.flightNumber || 'N/A';
    const date = details.arrivalDate || details.pickupDate || 'Today';
    const time = details.arrivalTime || details.pickupTime || 'N/A';

    if (type === 'Visa') {
      return [
        {
          label: 'Request Document Check',
          text: `Hi Huong Nguyen,\nCould you please initiate the Consular Legal Check for tourist visa application ID ${order.id} (${name})? Passport Number: ${details.passportNumber || 'N/A'}. Let me know if any stamp issue. Thanks!`
        },
        {
          label: 'Embassy Processing Notice',
          text: `Hi VietConsular Support,\nVisa applicant ${name} (${order.id}) has flight arriving on ${date}. We need the pre-approval letter processed express. Please confirm submission status. Thank you!`
        }
      ];
    } else if (type === 'FastTrack') {
      const ftType = details.packageType || 'Fast Track Standard';
      const airport = details.airport || 'Tan Son Nhat (SGN)';
      return [
        {
          label: 'Request Dispatch',
          text: `Hi Mr. Kevin Pham / Ms. Vy Nguyen,\nDispatching live fast track request for ${name} (${order.id}).\n• Package: ${ftType}\n• Airport: ${airport}\n• Flight: ${flight}\n• Landing Date: ${date} at ${time}\n• Special Requests: ${details.specialRequests || 'None'}\n\nPlease assign a physical escort staff with name board ready.`
        },
        {
          label: 'Flight Update Notification',
          text: `Hi partner,\nFlight update for client ${name} (${order.id}). Flight ${flight} landing schedule has changed at ${airport}. Please confirm standby adjustment at the arrival hall. Thank you!`
        }
      ];
    } else {
      const vClass = details.vehicleType || '4 seats';
      const airport = details.airport || 'Tan Son Nhat (SGN)';
      const isDeparture = details.direction === 'Departure';
      return [
        {
          label: 'Assign Driver Dispatch',
          text: `Hi Mr. David Hoang / Mr. Nam Cao,\nWe need a driver assigned for airport pickup booking ${order.id}.\n• Client: ${name}\n• Phone: ${getCustomerContact(order).phone}\n• Vehicle Class: ${vClass}\n• Direction: ${details.direction || 'Arrival'}\n• Airport: ${airport}\n${!isDeparture ? `• Flight Number: ${flight}\n` : ''}• Destination/Pickup: ${isDeparture ? (details.pickupAddress || 'N/A') : (details.destinationAddress || 'N/A')}\n\nPlease reply with driver name, phone, and plate number.`
        },
        {
          label: 'Driver standby check',
          text: `Hi dispatcher,\nHas the assigned driver arrived at the pickup location for passenger ${name} (${order.id}) at ${airport}? ${!isDeparture ? `Flight ${flight} has officially touched down.` : ''}`
        }
      ];
    }
  };

  const handleUnassignPartner = async (orderId: string, isSecondaryLeg: boolean) => {
    const isEn = language === 'EN';
    const confirmMsg = isEn 
      ? 'Are you sure you want to unassign this partner?' 
      : 'Bạn có chắc chắn muốn huỷ phân công đối tác này?';

    if (!window.confirm(confirmMsg)) return;

    const baseId = isSecondaryLeg ? orderId.replace('_secondary', '') : orderId;

    if (isSecondaryLeg) {
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

  const currentAgency = selectedOrder ? getAssignedAgencyInfo(activeServiceType, activePartner) : null;
  const templates = selectedOrder ? getMsgTemplates(selectedOrder, activeServiceType) : [];
  const activeLogs = selectedOrder ? (discussions[selectedOrder.id] || []) : [];

  return (
    <div className="space-y-6" id="agency-comms-hub">
      
      {/* Informational Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-lg border border-slate-700/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="bg-indigo-500 text-slate-950 text-[10px] tracking-wider uppercase font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <Share2 className="h-3 w-3" /> External Agency Bridge
            </span>
            <span className="text-slate-400 font-mono text-xs">Staff Communications & Live Status Sync</span>
          </div>
          <h2 className="font-display font-extrabold text-2xl tracking-tight">
            Partner Liaison & Operations Bridge
          </h2>
          <p className="text-slate-350 text-xs max-w-2xl">
            This workspace acts as the official bridge for the staff coordinator. When you discuss arrivals and clearances with partners on Zalo or WhatsApp, use these rapid controllers to directly transition statuses, log summaries, and copy message templates.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="bg-white/5 backdrop-blur-sm px-4 py-2.5 rounded-2xl text-center border border-white/5 shadow-inner">
            <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Operational Ledgers</span>
            <span className="text-lg font-black text-white">{orders.length} Bookings</span>
          </div>
          <div className="bg-emerald-500/10 backdrop-blur-sm px-4 py-2.5 rounded-2xl text-center border border-emerald-500/20">
            <span className="text-[9px] text-emerald-400 block uppercase font-bold tracking-wider">Active Agency Network</span>
            <span className="text-lg font-black text-emerald-400 flex items-center justify-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> 3 Partners
            </span>
          </div>
        </div>
      </div>

      {/* Main Bridge Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left 4 Cols: Booking Registry Selector */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[700px]">
          
          {/* Header Search & Filter */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-slate-500" />
                <span>Select Booking to Bridge</span>
              </h3>
              <span className="text-[9px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {filteredOrders.length} shown
              </span>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search ID, passenger name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500/15 focus:outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Service Type Filter Tabs */}
            <div className="flex bg-slate-200/60 p-1 rounded-lg text-[10.5px]">
              {(['All', 'Visa', 'FastTrack', 'AirportPickup'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`flex-1 py-1 rounded-md text-center font-bold transition-all cursor-pointer ${
                    filterType === type 
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {type === 'AirportPickup' ? 'Pickup' : type}
                </button>
              ))}
            </div>
          </div>

          {/* List of Bookings */}
          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No matching active bookings found.
              </div>
            ) : (
              filteredOrders.map(order => {
                const isSelected = order.id === selectedOrderId;
                const custName = getCustomerName(order);
                const orderIsCombo = !order.isSplitLeg && ((order.type === 'FastTrack' && (order.details as any)?.addAirportPickup) ||
                                     (order.type === 'AirportPickup' && (order.details as any)?.addFastTrack));
                
                const agency = getAssignedAgencyInfo(order.type, PARTNERS[order.type]?.find(p => p.id === assignedPartners[order.id]));
                const flight = (order.details as any).flightNumber;

                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full p-3.5 text-left transition-all cursor-pointer flex flex-col space-y-2 border-l-4 ${
                      isSelected 
                        ? 'bg-indigo-50/60 border-l-indigo-600 shadow-2xs' 
                        : 'hover:bg-slate-50 border-l-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-xs font-black text-slate-800">
                        {order.id}
                      </span>
                      <div className="flex items-center gap-1">
                        {order.isSplitLeg ? (
                          <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-200 text-[8px] font-black uppercase rounded-full">
                            SPLIT LEG ({order.type})
                          </span>
                        ) : (
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase ${
                            order.type === 'Visa' 
                              ? 'bg-purple-100 text-purple-700' 
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {order.type}
                          </span>
                        )}
                        {orderIsCombo && (
                          <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 border border-purple-200 text-[8px] font-black uppercase rounded-full">
                            COMBO DUO
                          </span>
                        )}
                      </div>
                    </div>
                    {/* ... Rest of booking list item content ... */}
                  </button>
                );
              })
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-150 text-[10px] text-slate-500 font-semibold flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span>Select any card to open the interactive coordinator status sync bridge.</span>
          </div>
        </div>

        {/* Right 8 Cols: Interactive Bridge Workspace */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-indigo-200 overflow-hidden shadow-md flex flex-col min-h-[700px]">
          
          {selectedOrder ? (
            <div className="divide-y divide-slate-150 flex-1 flex flex-col">
              
              {/* Header: Selected Order Profile */}
              <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-indigo-400 font-mono text-[11px] uppercase tracking-wider font-extrabold">Active Bridge Profile</span>
                    <span className="px-2 py-0.5 bg-indigo-500 text-white font-black rounded text-[9px] uppercase tracking-wide">
                      {selectedOrder.type === 'FastTrack'
                        ? `Fasttrack (${(selectedOrder.details as any)?.serviceDirection || (selectedOrder.details as any)?.direction || 'Arrival'})`
                        : selectedOrder.type === 'AirportPickup'
                          ? `Car/Bus (${(selectedOrder.details as any)?.direction || 'Arrival'})`
                          : selectedOrder.type} Service
                    </span>
                    {(selectedOrder.type === 'FastTrack' || selectedOrder.type === 'AirportPickup') && (
                      <span className="px-2 py-0.5 bg-emerald-600 text-white font-black rounded text-[9px] uppercase tracking-wide border border-emerald-400/20">
                        📍 {(selectedOrder.details as any).airport || 'Tan Son Nhat (SGN)'}
                      </span>
                    )}
                    {isOrderCombo && (
                      <span className="px-2 py-0.5 bg-purple-600 text-white font-black rounded text-[9px] uppercase tracking-wide border border-purple-400/20">
                        COMBO PACKAGE
                      </span>
                    )}
                  </div>
                  <h3 className="font-display font-extrabold text-lg flex items-center gap-2">
                    {getCustomerName(selectedOrder)}
                    <span className="text-slate-400 font-mono text-sm font-semibold">({selectedOrder.id})</span>
                  </h3>
                  
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300 font-medium">
                    <span>✉️ {getCustomerContact(selectedOrder).email}</span>
                    <span>📞 {getCustomerContact(selectedOrder).phone}</span>
                  </div>
                </div>

                {/* Open full details action */}
                <button
                  onClick={() => onSelectOrder(selectedOrder.id, selectedOrder.type as any)}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10 shrink-0"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Open Fulfillment Card ➜</span>
                </button>
              </div>

              {/* Combo Order Read-Only Indicator Card (Only if isOrderCombo is true) */}
              {isOrderCombo && (() => {
                const baseId = selectedOrder ? selectedOrder.id.replace('_secondary', '') : '';
                const parentOrder = (orders || []).find((o) => o.id === baseId);

                const primaryType = parentOrder?.type || selectedOrder.type;
                const secondaryType = primaryType === 'FastTrack' ? 'AirportPickup' : 'FastTrack';

                const primaryStatus = parentOrder?.status || 'Confirmed';
                const secondaryStatus = parentOrder?.secondaryStatus || 'Confirmed';

                const hasPrimaryStaff = Boolean(parentOrder?.staffName && String(parentOrder.staffName).trim());
                const hasSecondaryStaff = Boolean(parentOrder?.secondaryStaffName && String(parentOrder.secondaryStaffName).trim());

                return (
                  <div className="bg-purple-50/60 p-4 border-b border-purple-100/80 rounded-t-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Layers className="h-4 w-4 text-purple-700" />
                        <span className="text-xs font-extrabold text-purple-900">
                          {language === 'EN'
                            ? `Viewing: ${isSecLeg ? 'Secondary leg' : 'Primary leg'} (${getServiceName(activeServiceType, language)})`
                            : `Đang xem: ${isSecLeg ? 'Chặng phụ' : 'Chặng chính'} (${getServiceName(activeServiceType, language)})`}
                        </span>
                      </div>
                      <span className="text-[9px] bg-purple-100 text-purple-800 font-extrabold px-2 py-0.5 rounded-full uppercase border border-purple-200">
                        Combo Package
                      </span>
                    </div>

                    {/* Partner Assignment Summary for BOTH legs (Clickable) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                      {/* Primary Leg Summary */}
                      <div 
                        onClick={() => {
                          if (isSecLeg) setSelectedOrderId(baseId);
                        }}
                        className={`p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                          !isSecLeg 
                            ? 'bg-white border-purple-400 shadow-sm ring-1 ring-purple-300' 
                            : 'bg-slate-50/70 border-slate-200 opacity-65 cursor-pointer hover:bg-slate-100/80 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                            {language === 'EN' ? 'Primary Leg' : 'Chặng chính'}
                          </span>
                          {!isSecLeg && (
                            <span className="text-[8.5px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded">
                              {language === 'EN' ? 'Active' : 'Đang chọn'}
                            </span>
                          )}
                        </div>

                        {/* Partner Line */}
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-black uppercase shrink-0">
                            {primaryType}
                          </span>
                          <span className="truncate text-[11.5px]">
                            {primaryPartnerObj ? primaryPartnerObj.name : (language === 'EN' ? 'No partner yet' : 'Chưa giao đối tác')}
                          </span>
                        </div>

                        {/* Status Line */}
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-slate-400 text-[10px] font-medium">{language === 'EN' ? 'Status:' : 'Trạng thái:'}</span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-indigo-700 border border-indigo-200/80 font-mono">
                            {getStatusLabel(primaryStatus, language as any)}
                          </span>
                        </div>

                        {/* Staff Details Line */}
                        <div className={`text-[10px] font-bold flex items-center gap-1 pt-0.5 ${
                          hasPrimaryStaff ? 'text-emerald-600 font-extrabold' : 'text-amber-600 font-semibold'
                        }`}>
                          <span>
                            {hasPrimaryStaff
                              ? (primaryType === 'FastTrack'
                                  ? (language === 'EN' ? '✓ Escort details filled' : '✓ Đã có thông tin nhân viên')
                                  : (language === 'EN' ? '✓ Driver details filled' : '✓ Đã có thông tin tài xế'))
                              : (language === 'EN' ? '⏳ Waiting for partner details' : '⏳ Chờ thông tin từ đối tác')}
                          </span>
                        </div>
                      </div>

                      {/* Secondary Leg Summary */}
                      <div 
                        onClick={() => {
                          if (!isSecLeg) setSelectedOrderId(baseId + '_secondary');
                        }}
                        className={`p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                          isSecLeg 
                            ? 'bg-white border-purple-400 shadow-sm ring-1 ring-purple-300' 
                            : 'bg-slate-50/70 border-slate-200 opacity-65 cursor-pointer hover:bg-slate-100/80 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                            {language === 'EN' ? 'Secondary Leg' : 'Chặng phụ'}
                          </span>
                          {isSecLeg && (
                            <span className="text-[8.5px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded">
                              {language === 'EN' ? 'Active' : 'Đang chọn'}
                            </span>
                          )}
                        </div>

                        {/* Partner Line */}
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px] font-black uppercase shrink-0">
                            {secondaryType}
                          </span>
                          <span className="truncate text-[11.5px]">
                            {secondaryPartnerObj ? secondaryPartnerObj.name : (language === 'EN' ? 'No partner yet' : 'Chưa giao đối tác')}
                          </span>
                        </div>

                        {/* Status Line */}
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-slate-400 text-[10px] font-medium">{language === 'EN' ? 'Status:' : 'Trạng thái:'}</span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-indigo-700 border border-indigo-200/80 font-mono">
                            {getStatusLabel(secondaryStatus, language as any)}
                          </span>
                        </div>

                        {/* Staff Details Line */}
                        <div className={`text-[10px] font-bold flex items-center gap-1 pt-0.5 ${
                          hasSecondaryStaff ? 'text-emerald-600 font-extrabold' : 'text-amber-600 font-semibold'
                        }`}>
                          <span>
                            {hasSecondaryStaff
                              ? (secondaryType === 'FastTrack'
                                  ? (language === 'EN' ? '✓ Escort details filled' : '✓ Đã có thông tin nhân viên')
                                  : (language === 'EN' ? '✓ Driver details filled' : '✓ Đã có thông tin tài xế'))
                              : (language === 'EN' ? '⏳ Waiting for partner details' : '⏳ Chờ thông tin từ đối tác')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Switch Leg Button */}
                    {(() => {
                      const targetType = isSecLeg ? primaryType : secondaryType;
                      const targetServiceName = getServiceName(targetType, language);

                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (isSecLeg) {
                              setSelectedOrderId(baseId);
                            } else {
                              setSelectedOrderId(baseId + '_secondary');
                            }
                          }}
                          className="w-full py-2 px-3.5 bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-200 text-xs font-extrabold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          {!isSecLeg
                            ? (language === 'EN'
                                ? `Switch to secondary leg (${targetServiceName}) ➜`
                                : `Chuyển sang chặng phụ (${targetServiceName}) ➜`)
                            : (language === 'EN'
                                ? `⬅ Switch to primary leg (${targetServiceName})`
                                : `⬅ Chuyển về chặng chính (${targetServiceName})`)}
                        </button>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Unified Flow: Combined into one clear column */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-6 max-w-3xl mx-auto w-full animate-fade-in">
                  
                  {/* Find & Assign Partner Agency Dropdown */}
                  {(() => {
                    const isSecLeg = selectedOrder ? selectedOrder.id.endsWith('_secondary') : false;
                    const baseId = isSecLeg ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;

                    const currentAssignedPartnerId = isSecLeg
                      ? ((selectedOrder as any)?.assignedPartnerIdSecondary || assignedPartners[selectedOrder.id])
                      : ((selectedOrder as any)?.assignedPartnerId || assignedPartners[selectedOrder.id]);

                    const currentPartnerName = isSecLeg
                      ? ((selectedOrder as any)?.assignedPartnerNameSecondary || activePartner?.name)
                      : ((selectedOrder as any)?.assignedPartnerName || activePartner?.name);

                    const currentPartnerBy = isSecLeg
                      ? (selectedOrder as any)?.assignedPartnerBySecondary
                      : (selectedOrder as any)?.assignedPartnerBy;

                    const currentPartnerAt = isSecLeg
                      ? (selectedOrder as any)?.assignedPartnerAtSecondary
                      : (selectedOrder as any)?.assignedPartnerAt;

                    const isAssigned = !!currentAssignedPartnerId;
                    const timeStr = currentPartnerAt ? new Date(currentPartnerAt).toLocaleString() : '';
                    const byStr = currentPartnerBy || '';
                    const nameStr = currentPartnerName || 'Partner';

                    return (
                      <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm space-y-2.5">
                        <div className="flex justify-between items-center">
                          <label className="block text-[10px] text-slate-555 uppercase font-black tracking-wider flex items-center gap-1.5">
                            <span className="text-indigo-650 font-bold">🔍</span> Find & Match Partner Agency
                          </label>
                          {isAssigned && (
                            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                              {language === 'EN' ? '✓ Assigned' : '✓ Đã giao'}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <select
                            value={currentAssignedPartnerId || ''}
                            disabled={isAssigned}
                            onChange={async (e) => {
                              const pId = e.target.value;
                              if (!pId) return;

                              if (setAssignedPartners) {
                                setAssignedPartners(prev => ({
                                  ...prev,
                                  [selectedOrder.id]: pId
                                }));
                              }

                              const partnerObj = PARTNERS[activeServiceType]?.find(p => p.id === pId);
                              const assignedName = partnerObj ? partnerObj.name : 'Partner';
                              const parentOrder = (orders || []).find(o => o.id === baseId);
                              const existingNotes = (parentOrder as any)?.opsNotes || [];

                              const assignNote = {
                                text: `System update: Assigned partner "${assignedName}" to handle the ${activeServiceType} leg.`,
                                by: auth.currentUser?.email || '',
                                at: new Date().toISOString(),
                                leg: (isSecLeg ? 'secondary' : 'primary') as 'primary' | 'secondary'
                              };

                              const updatedOpsNotes = [...existingNotes, assignNote];

                              if (isSecLeg) {
                                await onUpdateOrder?.(baseId, {
                                  assignedPartnerIdSecondary: pId,
                                  assignedPartnerNameSecondary: assignedName,
                                  assignedPartnerAtSecondary: new Date().toISOString(),
                                  assignedPartnerBySecondary: auth.currentUser?.email || 'staff',
                                  opsNotes: updatedOpsNotes
                                });
                              } else {
                                await onUpdateOrder?.(baseId, {
                                  assignedPartnerId: pId,
                                  assignedPartnerName: assignedName,
                                  assignedPartnerAt: new Date().toISOString(),
                                  assignedPartnerBy: auth.currentUser?.email || 'staff',
                                  opsNotes: updatedOpsNotes
                                });
                              }
                            }}
                            className="flex-1 bg-white border border-slate-200 hover:border-slate-350 text-slate-800 text-xs font-bold rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none cursor-pointer transition-colors disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                          >
                            <option value="" className="text-slate-400 font-medium">-- Select Partner Agency --</option>
                            {PARTNERS[activeServiceType]?.map(partner => (
                              <option key={partner.id} value={partner.id}>
                                {partner.name} (⭐ {partner.rating} • Active: {partner.activeOrders})
                              </option>
                            ))}
                          </select>

                          {isAssigned && (
                            <button
                              type="button"
                              onClick={() => handleUnassignPartner(selectedOrder.id, isSecLeg)}
                              className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                            >
                              {language === 'EN' ? 'Unassign' : 'Huỷ phân công'}
                            </button>
                          )}
                        </div>

                        {isAssigned ? (
                          <div className="text-[11px] text-slate-700 bg-indigo-50/70 border border-indigo-150 p-2.5 rounded-xl font-medium flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 font-bold">
                              <Building className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                              <span>
                                {language === 'EN' 
                                  ? `Assigned to ${nameStr}${byStr ? ` by ${byStr}` : ''}${timeStr ? ` at ${timeStr}` : ''}`
                                  : `Đã giao cho ${nameStr}${byStr ? ` bởi ${byStr}` : ''}${timeStr ? ` lúc ${timeStr}` : ''}`}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 p-2 rounded-lg font-medium flex items-center gap-1">
                            <span>⚠️</span> {language === 'EN' ? 'Pending Assignment. Please choose a partner.' : 'Chờ phân công. Vui lòng chọn đối tác.'}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* Passenger & Service Dossier Card */}
                  <div className={`p-4 border rounded-2xl shadow-sm transition-all ${
                    activeServiceType === 'Visa' 
                      ? 'bg-purple-50/10 border-purple-200/80 shadow-purple-500/5' 
                      : activeServiceType === 'FastTrack'
                        ? 'bg-emerald-50/10 border-emerald-200/80 shadow-emerald-500/5'
                        : 'bg-blue-50/10 border-blue-200/80 shadow-blue-500/5'
                  }`}>
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center space-x-2">
                        <ClipboardCheck className={`h-4 w-4 ${
                          activeServiceType === 'Visa' 
                            ? 'text-purple-600' 
                            : activeServiceType === 'FastTrack'
                              ? 'text-emerald-600'
                              : 'text-blue-600'
                        }`} />
                        <h4 className="text-[11.5px] font-black text-slate-800 uppercase tracking-wider">
                          Passenger & Service Dossier
                        </h4>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        activeServiceType === 'Visa' 
                          ? 'bg-purple-100 text-purple-800' 
                          : activeServiceType === 'FastTrack'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                      }`}>
                        {activeServiceType} Details
                      </span>
                    </div>

                    {/* Info Grid based on service type */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-xs">
                      {activeServiceType === 'Visa' && (
                        <>
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Full Passenger Name</span>
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5">
                              <span className="font-extrabold text-slate-800 truncate select-all">{getCustomerName(selectedOrder)}</span>
                              <button 
                                onClick={() => handleCopyTemplate(getCustomerName(selectedOrder), 'Name')}
                                className="text-[9.5px] text-indigo-600 font-bold hover:underline ml-1"
                              >
                                {copySuccess === 'Name' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>

                          <EditableOrderField
                            key={`${selectedOrder.id}::details.firstName`}
                            label="First Name"
                            value={(selectedOrder.details as any).firstName || ''}
                            fieldPath="details.firstName"
                            logLabel="Tên"
                            language={language}
                            requireReason
                            validate={(v) => !v.trim() ? (language === 'VI' ? 'Không được để trống' : 'This field cannot be empty') : null}
                            valueClassName="font-extrabold text-slate-800"
                            onSave={handleSaveField}
                          />

                          <EditableOrderField
                            key={`${selectedOrder.id}::details.lastName`}
                            label="Last Name"
                            value={(selectedOrder.details as any).lastName || ''}
                            fieldPath="details.lastName"
                            logLabel="Họ"
                            language={language}
                            requireReason
                            validate={(v) => !v.trim() ? (language === 'VI' ? 'Không được để trống' : 'This field cannot be empty') : null}
                            valueClassName="font-extrabold text-slate-800"
                            onSave={handleSaveField}
                          />

                          <EditableOrderField
                            key={`${selectedOrder.id}::details.passportNumber`}
                            label="Passport Number"
                            value={(selectedOrder.details as any).passportNumber || ''}
                            fieldPath="details.passportNumber"
                            logLabel="Số hộ chiếu"
                            language={language}
                            uppercase
                            requireReason
                            validate={(v) => !v.trim() ? (language === 'VI' ? 'Không được để trống' : 'This field cannot be empty') : (!isValidPassportNumber(v) ? (language === 'VI' ? 'Số hộ chiếu không hợp lệ (VD: N1234567)' : 'Invalid passport number format') : null)}
                            valueClassName="font-extrabold text-slate-800 font-mono"
                            trailing={
                              <button 
                                onClick={() => handleCopyTemplate((selectedOrder.details as any).passportNumber || '', 'Passport')}
                                className="text-[9.5px] text-indigo-600 font-bold hover:underline ml-1"
                              >
                                {copySuccess === 'Passport' ? 'Copied' : 'Copy'}
                              </button>
                            }
                            onSave={handleSaveField}
                          />

                          <div className="space-y-1">
                            <EditableOrderField
                              key={`${selectedOrder.id}::details.phone`}
                              label="Customer Phone"
                              value={parsePhoneAndChannel((selectedOrder.details as any).phone, (selectedOrder.details as any).contactPref).phone}
                              fieldPath="details.phone"
                              logLabel="Số điện thoại khách"
                              language={language}
                              inputType="tel"
                              validate={(v) => !isValidInternationalPhone(v) ? (language === 'VI' ? 'Số điện thoại không hợp lệ (VD: 0972286699 hoặc +84972286699)' : 'Invalid phone number (e.g. 0972286699 or +84972286699)') : null}
                              valueClassName="font-bold text-slate-800"
                              onSave={handleSaveField}
                            />
                            {(() => {
                              const channel = parsePhoneAndChannel((selectedOrder.details as any).phone, (selectedOrder.details as any).contactPref).channel;
                              if (!channel) return null;
                              return (
                                <div className="text-[9.5px] text-slate-400 font-medium px-0.5 -mt-0.5">
                                  {language === 'EN' ? `Preferred channel: ${channel}` : `Kênh liên lạc: ${channel}`}
                                </div>
                              );
                            })()}
                          </div>

                          <EditableOrderField
                            key={`${selectedOrder.id}::details.email`}
                            label="Customer Email"
                            value={(selectedOrder.details as any).email || ''}
                            fieldPath="details.email"
                            logLabel="Email khách"
                            language={language}
                            inputType="email"
                            validate={(v) => !isValidEmail(v) ? (language === 'VI' ? 'Email không hợp lệ' : 'Invalid email format') : null}
                            valueClassName="font-bold text-slate-800"
                            onSave={handleSaveField}
                          />

                          <EditableOrderField
                            key={`${selectedOrder.id}::details.nationality`}
                            label="Nationality"
                            value={(selectedOrder.details as any).nationality || ''}
                            fieldPath="details.nationality"
                            logLabel="Quốc tịch"
                            language={language}
                            requireReason
                            validate={(v) => !v.trim() ? (language === 'VI' ? 'Không được để trống' : 'This field cannot be empty') : null}
                            valueClassName="text-slate-700 font-medium"
                            onSave={handleSaveField}
                          />

                          <EditableOrderField
                            key={`${selectedOrder.id}::details.dateOfBirth`}
                            label="Date of Birth"
                            value={(selectedOrder.details as any).dateOfBirth || ''}
                            fieldPath="details.dateOfBirth"
                            logLabel="Ngày sinh"
                            language={language}
                            inputType="date"
                            requireReason
                            validate={(v) => !v.trim() ? (language === 'VI' ? 'Không được để trống' : 'This field cannot be empty') : null}
                            valueClassName="text-slate-700 font-medium"
                            onSave={handleSaveField}
                          />

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Destination Country</span>
                            <div className="bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold truncate">
                              {(selectedOrder.details as any).destinationCountry || 'Vietnam'}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Visa Type</span>
                            <div className="bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold truncate">
                              {getDisplayVisaType(selectedOrder.details)}
                            </div>
                          </div>

                          <EditableOrderField
                            key={`${selectedOrder.id}::details.arrivalDate`}
                            label="Target Arrival Date"
                            value={(selectedOrder.details as any).arrivalDate || ''}
                            fieldPath="details.arrivalDate"
                            logLabel="Ngày nhập cảnh"
                            language={language}
                            inputType="date"
                            valueClassName="text-slate-700 font-medium"
                            onSave={handleSaveField}
                          />

                          <div className="sm:col-span-2 space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Passport Scan (Required for submission)</span>
                            <div className="bg-purple-50/40 border border-purple-100 rounded-lg p-2.5 flex items-center justify-between text-[10.5px]">
                              <span className="font-semibold text-purple-955 truncate">📂 {(selectedOrder.details as any).passportScan || 'passport_scan.jpg'}</span>
                              <span className="text-[8.5px] bg-purple-100 text-purple-800 font-black px-2 py-0.5 rounded uppercase shrink-0">Verified</span>
                            </div>
                          </div>
                        </>
                      )}

                      {activeServiceType === 'FastTrack' && (
                        <>
                          <EditableOrderField
                            key={`${selectedOrder.id}::details.contactName`}
                            label="Contact Name"
                            value={(selectedOrder.details as any).contactName || ''}
                            fieldPath="details.contactName"
                            logLabel="Tên khách"
                            language={language}
                            requireReason
                            validate={(v) => !v.trim() ? (language === 'VI' ? 'Không được để trống' : 'This field cannot be empty') : null}
                            valueClassName="font-extrabold text-slate-800"
                            onSave={handleSaveField}
                          />

                          <EditableOrderField
                            key={`${selectedOrder.id}::details.flightNumber`}
                            label="Flight Number"
                            value={(selectedOrder.details as any).flightNumber || ''}
                            fieldPath="details.flightNumber"
                            logLabel="Số hiệu chuyến bay"
                            language={language}
                            uppercase
                            validate={(v) => !isValidFlightNumber(v) ? (language === 'VI' ? 'Số hiệu chuyến bay không đúng định dạng (VD: VN214, VJ123)' : 'Invalid flight number format (e.g. VN214, VJ123)') : null}
                            valueClassName="font-extrabold text-slate-800"
                            trailing={
                              <button 
                                onClick={() => handleCopyTemplate((selectedOrder.details as any).flightNumber || '', 'Flight')}
                                className="text-[9.5px] text-indigo-600 font-bold hover:underline ml-1"
                              >
                                {copySuccess === 'Flight' ? 'Copied' : 'Copy'}
                              </button>
                            }
                            onSave={handleSaveField}
                          />

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Airport Location</span>
                            <div className="bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 text-slate-800 font-extrabold">
                              {(selectedOrder.details as any).airport || 'Tan Son Nhat (SGN)'}
                            </div>
                          </div>

                          <EditableOrderField
                            key={`${selectedOrder.id}::details.arrivalDate`}
                            label="Landing Date"
                            value={(selectedOrder.details as any).arrivalDate || ''}
                            fieldPath="details.arrivalDate"
                            logLabel="Ngày hạ cánh"
                            language={language}
                            inputType="date"
                            valueClassName="text-slate-700 font-medium"
                            onSave={handleSaveField}
                          />

                          <EditableOrderField
                            key={`${selectedOrder.id}::details.arrivalTime`}
                            label="Landing Time"
                            value={(selectedOrder.details as any).arrivalTime || ''}
                            fieldPath="details.arrivalTime"
                            logLabel="Giờ hạ cánh"
                            language={language}
                            inputType="time"
                            valueClassName="text-slate-700 font-medium"
                            onSave={handleSaveField}
                          />

                          <div className="space-y-1">
                            <EditableOrderField
                              key={`${selectedOrder.id}::details.contactPhone`}
                              label="Customer Phone"
                              value={parsePhoneAndChannel((selectedOrder.details as any).contactPhone, (selectedOrder.details as any).contactPref).phone}
                              fieldPath="details.contactPhone"
                              logLabel="Số điện thoại khách"
                              language={language}
                              inputType="tel"
                              validate={(v) => !isValidInternationalPhone(v) ? (language === 'VI' ? 'Số điện thoại không hợp lệ (VD: 0972286699 hoặc +84972286699)' : 'Invalid phone number (e.g. 0972286699 or +84972286699)') : null}
                              valueClassName="font-bold text-slate-800"
                              onSave={handleSaveField}
                            />
                            {(() => {
                              const channel = parsePhoneAndChannel((selectedOrder.details as any).contactPhone, (selectedOrder.details as any).contactPref).channel;
                              if (!channel) return null;
                              return (
                                <div className="text-[9.5px] text-slate-400 font-medium px-0.5 -mt-0.5">
                                  {language === 'EN' ? `Preferred channel: ${channel}` : `Kênh liên lạc: ${channel}`}
                                </div>
                              );
                            })()}
                          </div>

                          <EditableOrderField
                            key={`${selectedOrder.id}::details.contactEmail`}
                            label="Customer Email"
                            value={(selectedOrder.details as any).contactEmail || ''}
                            fieldPath="details.contactEmail"
                            logLabel="Email khách"
                            language={language}
                            inputType="email"
                            validate={(v) => !isValidEmail(v) ? (language === 'VI' ? 'Email không hợp lệ' : 'Invalid email format') : null}
                            valueClassName="font-bold text-slate-800"
                            onSave={handleSaveField}
                          />

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Concierge Package Tier</span>
                            <div className="bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium truncate">
                              {(() => {
                                const pkg = (selectedOrder.details as any).packageType;
                                if (pkg === 'VIP Meet & Assist' || pkg === 'Fast Track Standard') return 'Fast Track Standard';
                                if (pkg === 'Premium Fast Track' || pkg === 'Fast Track Business') return 'Fast Track Business';
                                if (pkg === 'Elite Lounges Gate-to-Gate' || pkg === 'Fast Track Vip' || pkg === 'Fast Track VIP') return 'Fast Track Vip';
                                return pkg || 'Fast Track Standard';
                              })()}
                            </div>
                          </div>

                          <div className="sm:col-span-2 space-y-1">
                            <EditableOrderField
                              key={`${selectedOrder.id}::details.specialRequests`}
                              label="Special Requests"
                              value={(selectedOrder.details as any).specialRequests || ''}
                              fieldPath="details.specialRequests"
                              logLabel="Ghi chú đặc biệt"
                              language={language}
                              inputType="textarea"
                              containerClassName="bg-amber-50/40 border border-amber-200/60 rounded-lg p-2.5 flex items-center justify-between font-mono min-h-[34px]"
                              valueClassName="text-amber-900 font-medium text-[11px] leading-relaxed select-all"
                              emptyText="No special liaison instructions provided."
                              onSave={handleSaveField}
                            />
                          </div>
                        </>
                      )}

                      {activeServiceType === 'AirportPickup' && (
                        <>
                          <EditableOrderField
                            key={`${selectedOrder.id}::details.passengerName`}
                            label="Passenger Name"
                            value={(selectedOrder.details as any).passengerName || ''}
                            fieldPath="details.passengerName"
                            logLabel="Tên hành khách"
                            language={language}
                            requireReason
                            validate={(v) => !v.trim() ? (language === 'VI' ? 'Không được để trống' : 'This field cannot be empty') : null}
                            valueClassName="font-extrabold text-slate-800"
                            trailing={
                              <button 
                                onClick={() => handleCopyTemplate((selectedOrder.details as any).passengerName || '', 'PassName')}
                                className="text-[9.5px] text-indigo-600 font-bold hover:underline ml-1"
                              >
                                {copySuccess === 'PassName' ? 'Copied' : 'Copy'}
                              </button>
                            }
                            onSave={handleSaveField}
                          />

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Airport Location</span>
                            <div className="bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 text-slate-850 font-extrabold">
                              {(selectedOrder.details as any).airport || 'Tan Son Nhat (SGN)'}
                            </div>
                          </div>

                          <EditableOrderField
                            key={`${selectedOrder.id}::details.pickupDate`}
                            label="Pickup Date"
                            value={(selectedOrder.details as any).pickupDate || ''}
                            fieldPath="details.pickupDate"
                            logLabel="Ngày đón"
                            language={language}
                            inputType="date"
                            valueClassName="text-slate-700 font-medium"
                            onSave={handleSaveField}
                          />

                          <EditableOrderField
                            key={`${selectedOrder.id}::details.pickupTime`}
                            label="Pickup Time"
                            value={(selectedOrder.details as any).pickupTime || ''}
                            fieldPath="details.pickupTime"
                            logLabel="Giờ đón"
                            language={language}
                            inputType="time"
                            valueClassName="text-slate-700 font-medium"
                            onSave={handleSaveField}
                          />

                          <div className="space-y-1">
                            <EditableOrderField
                              key={`${selectedOrder.id}::details.passengerPhone`}
                              label="Customer Phone"
                              value={parsePhoneAndChannel((selectedOrder.details as any).passengerPhone, (selectedOrder.details as any).contactPref).phone}
                              fieldPath="details.passengerPhone"
                              logLabel="Số điện thoại khách"
                              language={language}
                              inputType="tel"
                              validate={(v) => !isValidInternationalPhone(v) ? (language === 'VI' ? 'Số điện thoại không hợp lệ (VD: 0972286699 hoặc +84972286699)' : 'Invalid phone number (e.g. 0972286699 or +84972286699)') : null}
                              valueClassName="font-bold text-slate-800"
                              onSave={handleSaveField}
                            />
                            {(() => {
                              const channel = parsePhoneAndChannel((selectedOrder.details as any).passengerPhone, (selectedOrder.details as any).contactPref).channel;
                              if (!channel) return null;
                              return (
                                <div className="text-[9.5px] text-slate-400 font-medium px-0.5 -mt-0.5">
                                  {language === 'EN' ? `Preferred channel: ${channel}` : `Kênh liên lạc: ${channel}`}
                                </div>
                              );
                            })()}
                          </div>

                          <EditableOrderField
                            key={`${selectedOrder.id}::details.passengerEmail`}
                            label="Customer Email"
                            value={(selectedOrder.details as any).passengerEmail || ''}
                            fieldPath="details.passengerEmail"
                            logLabel="Email khách"
                            language={language}
                            inputType="email"
                            validate={(v) => !isValidEmail(v) ? (language === 'VI' ? 'Email không hợp lệ' : 'Invalid email format') : null}
                            valueClassName="font-bold text-slate-800"
                            onSave={handleSaveField}
                          />

                          {((selectedOrder.details as any).direction || (selectedOrder.details as any).serviceDirection) !== 'Departure' && (
                            <EditableOrderField
                              key={`${selectedOrder.id}::details.flightNumber`}
                              label="Flight Number"
                              value={(selectedOrder.details as any).flightNumber || ''}
                              fieldPath="details.flightNumber"
                              logLabel="Số hiệu chuyến bay"
                              language={language}
                              uppercase
                              validate={(v) => !isValidFlightNumber(v) ? (language === 'VI' ? 'Số hiệu chuyến bay không đúng định dạng (VD: VN214, VJ123)' : 'Invalid flight number format (e.g. VN214, VJ123)') : null}
                              valueClassName="font-bold text-green-700 font-mono"
                              onSave={handleSaveField}
                            />
                          )}

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Fleet Category</span>
                            <div className="bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium">
                              {(selectedOrder.details as any).vehicleType || '4 seats'}
                            </div>
                          </div>

                          <div className="sm:col-span-2 space-y-1">
                            <EditableOrderField
                              key={`${selectedOrder.id}::details.destinationAddress`}
                              label="Destination Address"
                              value={(selectedOrder.details as any).destinationAddress || ''}
                              fieldPath="details.destinationAddress"
                              logLabel="Địa chỉ điểm đến"
                              language={language}
                              valueClassName="font-extrabold text-slate-800 leading-tight select-all"
                              trailing={
                                <button 
                                  onClick={() => handleCopyTemplate((selectedOrder.details as any).destinationAddress || '', 'Dest')}
                                  className="text-[9.5px] text-indigo-600 font-bold hover:underline ml-2 shrink-0"
                                >
                                  {copySuccess === 'Dest' ? 'Copied' : 'Copy'}
                                </button>
                              }
                              onSave={handleSaveField}
                            />
                          </div>

                          <div className="sm:col-span-2 space-y-1">
                            <EditableOrderField
                              key={`${selectedOrder.id}::details.optionalNote`}
                              label="Driver & Dispatch Notes"
                              value={(selectedOrder.details as any).optionalNote || ''}
                              fieldPath="details.optionalNote"
                              logLabel="Ghi chú cho tài xế"
                              language={language}
                              inputType="textarea"
                              containerClassName="bg-blue-50/40 border border-blue-200/60 rounded-lg p-2.5 flex items-center justify-between font-mono min-h-[34px]"
                              valueClassName="text-blue-900 font-medium text-[11px] leading-relaxed select-all"
                              emptyText="No special chauffeur instructions provided."
                              onSave={handleSaveField}
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Bridge Dispatch tools inside the card */}
                    <div className="pt-3 border-t border-slate-200/75 flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
                      <span className="text-[10px] text-slate-500 font-medium leading-relaxed max-w-sm">
                        Brief agency partner immediately with complete validated booking details by pushing dossier.
                      </span>

                      <button
                        type="button"
                        onClick={() => handleTransferDossier(selectedOrder, activeServiceType)}
                        className={`py-2 px-4 rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-sm transition-all text-white ${
                          activeServiceType === 'Visa' 
                            ? 'bg-purple-600 hover:bg-purple-700' 
                            : activeServiceType === 'FastTrack'
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>Transfer Dossier to Partner</span>
                      </button>
                    </div>

                    {/* Success notification banner */}
                    {dossierTransferSuccess === selectedOrder.id && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="text-xs font-extrabold text-emerald-950">
                            Dossier Transferred & Copied Successfully!
                          </span>
                        </div>
                        <p className="text-[10.5px] text-emerald-800 leading-normal pl-6">
                          Full customer specs and files details are formatted and copied to your clipboard. 
                          You can now open <strong>Zalo</strong> or <strong>WhatsApp</strong> and paste (Cmd+V / Ctrl+V) to brief the representative instantly. 
                          A secure dispatch log has been registered in the Liaison Timeline below.
                        </p>
                      </motion.div>
                    )}
                  </div>

                  {/* Status controls */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-indigo-600" />
                        <span>
                          {isOrderCombo ? `Leg Status Bridge: ${getServiceName(activeServiceType, language)}` : 'Direct Status Transition Bridge'}
                        </span>
                      </h4>
                      <span className="text-[10px] font-bold text-slate-550 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                        Main Status: <strong className="text-slate-900">{selectedOrder.status}</strong>
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      Click any rapid status transition below to update this booking. The platform will record your action as Person-in-Charge, sync the central ledger, and update the live progress tracking receipt.
                    </p>

                    {/* Dynamic Rapid-Action status grid */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {(() => {
                        const statusOptions = getServiceStatusOptions(activeServiceType);

                        return statusOptions.map(status => {
                          const isActive = selectedOrder.status === status;
                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={() => handleUpdateStatus(status)}
                              className={`py-2.5 px-3 rounded-xl text-left font-bold transition-all border text-xs cursor-pointer flex items-center justify-between group ${
                                isActive 
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                              }`}
                            >
                              <span className="truncate">{status}</span>
                              {isActive ? (
                                <Check className="h-3.5 w-3.5 text-white" />
                              ) : (
                                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                              )}
                            </button>
                          );
                        });
                      })()}
                    </div>

                    {/* Dynamic Sub-Statuses */}
                    {getSubStatusOptions(selectedOrder.status, activeServiceType).length > 0 && (
                      <div className="space-y-3 mt-3">
                        <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-amber-800 font-extrabold uppercase tracking-wider block">
                              {selectedOrder.status} Sub-Status
                            </span>
                            <span className="text-[8px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-mono">
                              STATUS DETAIL
                            </span>
                          </div>
                          <div className="flex gap-2">
                            {getSubStatusOptions(selectedOrder.status, activeServiceType).map((subVal) => {
                              const isSel = (selectedOrder.subStatus || getSubStatusOptions(selectedOrder.status, activeServiceType)[0]) === subVal;
                              return (
                                <button
                                  key={subVal}
                                  type="button"
                                  onClick={() => handleUpdateSubStatus(subVal)}
                                  className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-lg border transition-all cursor-pointer ${
                                    isSel 
                                      ? subVal === 'Rejected'
                                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                        : 'bg-amber-600 text-white border-amber-600 shadow-sm' 
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  {getSubStatusLabel(subVal, language as any)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fast Track Service Staff Assigned Form */}
                    {activeServiceType === 'FastTrack' && ['Confirmed', 'Agency Review', 'Staff Assigned'].includes(selectedOrder.status || '') && (
                      <div className="mt-3 p-4 bg-purple-50/50 border border-purple-200/65 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <UserCheck className="h-4 w-4 text-purple-700" />
                            <span className="text-[10.5px] font-black text-purple-900 uppercase tracking-wider">Fast Track PIC Staff Dispatch</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Staff Name / Tên nhân viên</label>
                            <input 
                              type="text" 
                              value={staffInputs.staffName} 
                              onChange={(e) => setStaffInputs(prev => ({ ...prev, staffName: e.target.value }))}
                              onBlur={() => handleCommitField('staffName')}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                              placeholder="e.g. Mr. Kevin Pham" 
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Staff Phone / Số điện thoại</label>
                            <input 
                              type="text" 
                              value={staffInputs.staffPhone} 
                              onChange={(e) => {
                                setStaffInputs(prev => ({ ...prev, staffPhone: e.target.value }));
                                if (staffPhoneError) setStaffPhoneError(null);
                              }}
                              onBlur={() => handleCommitField('staffPhone')}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                              placeholder="e.g. +84912334556" 
                              className={`w-full bg-white border ${staffPhoneError ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:ring-purple-400'} rounded-lg p-2 text-xs focus:ring-1 focus:outline-none font-mono`}
                            />
                            {staffPhoneError && (
                              <p className="text-[10px] text-rose-600 font-bold mt-1 animate-fade-in flex items-center gap-1">
                                <span>⚠️</span> {staffPhoneError}
                              </p>
                            )}
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Meeting Location / Điểm đón khách</label>
                            <input 
                              type="text" 
                              value={staffInputs.staffLocation} 
                              onChange={(e) => setStaffInputs(prev => ({ ...prev, staffLocation: e.target.value }))}
                              onBlur={() => handleCommitField('staffLocation')}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                              placeholder="e.g. Arrival Terminal Gate A2 (near Coffee Stand)" 
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Staff Photo URL / Ảnh nhân viên</label>
                            <div className="flex items-center space-x-2">
                              <input 
                                type="text" 
                                value={staffInputs.staffPhoto} 
                                onChange={(e) => setStaffInputs(prev => ({ ...prev, staffPhoto: e.target.value }))}
                                onBlur={() => handleCommitField('staffPhoto')}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                placeholder="e.g. https://images.unsplash.com/photo-..." 
                                className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none"
                              />
                              <StaffPhotoAvatar
                                src={staffInputs.staffPhoto}
                                alt="Preview"
                                sizeClass="h-8 w-8"
                                onPreview={(url) => setPreviewPhotoUrl(url)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Airport Transfer Service Staff & Vehicle Assigned Form */}
                    {activeServiceType === 'AirportPickup' && ['Confirmed', 'Agency Review', 'Staff Assigned', 'Passenger Greet'].includes(selectedOrder.status || '') && (
                      <div className="mt-3 p-4 bg-blue-50/50 border border-blue-200/65 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <UserCheck className="h-4 w-4 text-blue-700" />
                            <span className="text-[10.5px] font-black text-blue-900 uppercase tracking-wider">Chauffeur & Fleet Dispatch Details</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Chauffeur Name / Tên tài xế</label>
                            <input 
                              type="text" 
                              value={staffInputs.staffName} 
                              onChange={(e) => setStaffInputs(prev => ({ ...prev, staffName: e.target.value }))}
                              onBlur={() => handleCommitField('staffName')}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                              placeholder="e.g. Mr. Nam Cao" 
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Chauffeur Phone / Số điện thoại</label>
                            <input 
                              type="text" 
                              value={staffInputs.staffPhone} 
                              onChange={(e) => {
                                setStaffInputs(prev => ({ ...prev, staffPhone: e.target.value }));
                                if (staffPhoneError) setStaffPhoneError(null);
                              }}
                              onBlur={() => handleCommitField('staffPhone')}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                              placeholder="e.g. +84909667334" 
                              className={`w-full bg-white border ${staffPhoneError ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:ring-blue-400'} rounded-lg p-2 text-xs focus:ring-1 focus:outline-none font-mono`}
                            />
                            {staffPhoneError && (
                              <p className="text-[10px] text-rose-600 font-bold mt-1 animate-fade-in flex items-center gap-1">
                                <span>⚠️</span> {staffPhoneError}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">License Plate / Biển số xe</label>
                            <input 
                              type="text" 
                              value={staffInputs.licensePlate} 
                              onChange={(e) => setStaffInputs(prev => ({ ...prev, licensePlate: e.target.value }))}
                              onBlur={() => handleCommitField('licensePlate')}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                              placeholder="e.g. 30A - 888.88" 
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none font-semibold font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Chauffeur Photo URL / Ảnh tài xế</label>
                            <div className="flex items-center space-x-2">
                              <input 
                                type="text" 
                                value={staffInputs.staffPhoto} 
                                onChange={(e) => setStaffInputs(prev => ({ ...prev, staffPhoto: e.target.value }))}
                                onBlur={() => handleCommitField('staffPhoto')}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                placeholder="e.g. https://images.unsplash.com/photo-..." 
                                className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
                              />
                              <StaffPhotoAvatar
                                src={staffInputs.staffPhoto}
                                alt="Preview"
                                sizeClass="h-8 w-8"
                                onPreview={(url) => setPreviewPhotoUrl(url)}
                              />
                            </div>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Vehicle Photo URL / Ảnh xe</label>
                            <div className="flex items-center space-x-2">
                              <input 
                                type="text" 
                                value={staffInputs.carPhoto} 
                                onChange={(e) => setStaffInputs(prev => ({ ...prev, carPhoto: e.target.value }))}
                                onBlur={() => handleCommitField('carPhoto')}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                placeholder="e.g. https://images.unsplash.com/photo-..." 
                                className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
                              />
                              {staffInputs.carPhoto && (
                                <img 
                                  src={staffInputs.carPhoto} 
                                  alt="Car Preview" 
                                  referrerPolicy="no-referrer"
                                  className="h-8 w-12 rounded border border-slate-200 object-cover shrink-0 text-[8px]"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}



                    {/* Airport Transfer Service Passenger Greet Form */}
                    {activeServiceType === 'AirportPickup' && selectedOrder.status === 'Passenger Greet' && (
                      <div className="mt-3 p-4 bg-emerald-50/50 border border-emerald-200/65 rounded-2xl space-y-3 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-emerald-700">🤝</span>
                            <span className="text-[10.5px] font-black text-emerald-900 uppercase tracking-wider">Passenger Greet Status</span>
                          </div>
                          <span className="text-[9px] bg-emerald-100 border border-emerald-200 text-emerald-800 font-extrabold px-2 py-0.5 rounded uppercase">
                            VIP Covered & On Board
                          </span>
                        </div>
                        
                        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-sm space-y-2.5 text-xs text-slate-700">
                          <p className="leading-relaxed">
                            <strong>Status:</strong> Our chauffeur has successfully met, greeted, and identified the lead passenger, <strong>{getCustomerName(selectedOrder)}</strong>.
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-medium">
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-black">Lead Passenger</span>
                              <span className="text-slate-900 font-bold">{getCustomerName(selectedOrder)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-black">Destination Address</span>
                              <span className="text-slate-900 truncate block">{(selectedOrder.details as any)?.destinationAddress || 'Airport departures terminal'}</span>
                            </div>
                            <div className="mt-1">
                              <span className="text-slate-400 block text-[9px] uppercase font-black">Assigned Chauffeur</span>
                              <span className="text-slate-900 font-bold">{selectedOrder.staffName || 'Mr. Nam Cao'}</span>
                            </div>
                            <div className="mt-1">
                              <span className="text-slate-400 block text-[9px] uppercase font-black">License Plate</span>
                              <span className="text-indigo-700 font-black font-mono">{selectedOrder.licensePlate || '30A - 888.88'}</span>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateStatus('Completed');
                            }}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <span>✅</span> Drop-off Completed & Mark Order Completed
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order Private Group Chat Links (Staff Only) */}
                  <div className="mt-4 p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <MessageSquare className="h-4 w-4 text-indigo-700" />
                        <span className="text-[10.5px] font-black text-indigo-900 uppercase tracking-wider">
                          Link Nhóm Chat Riêng Cho Đơn Hàng (WhatsApp & Zalo)
                        </span>
                      </div>
                      {(() => {
                        const baseId = isSecLeg ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;
                        const parentOrder = (orders || []).find((o) => o.id === baseId) || selectedOrder;
                        const updatedAt = isSecLeg ? parentOrder?.groupLinkUpdatedAtSecondary : parentOrder?.groupLinkUpdatedAt;
                        return updatedAt ? (
                          <span className="text-[9.5px] font-mono text-slate-500">
                            Cập nhật: {new Date(updatedAt).toLocaleString()}
                          </span>
                        ) : null;
                      })()}
                    </div>

                    <p className="text-[10.5px] text-slate-600 leading-normal">
                      💡 <strong>Hướng dẫn:</strong> Nhóm chat phải được tạo thủ công trong ứng dụng WhatsApp/Zalo. Sau đó copy link mời (invite link) và dán vào bên dưới rồi bấm <strong>Lưu Link Nhóm</strong>. (Tẩy trống ô rồi lưu để xóa link).
                    </p>

                    {isOrderCombo && (
                      <div className="text-[11px] font-bold text-indigo-800 bg-indigo-100/70 border border-indigo-200/80 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                        <span>📌</span>
                        <span>
                          {language === 'EN'
                            ? (isSecLeg ? `Group links for secondary leg (${getServiceName(activeServiceType, language)})` : `Group links for primary leg (${getServiceName(activeServiceType, language)})`)
                            : (isSecLeg ? `Link nhóm cho chặng phụ (${getServiceName(activeServiceType, language)})` : `Link nhóm cho chặng chính (${getServiceName(activeServiceType, language)})`)}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-black text-slate-600 uppercase mb-1">
                          WhatsApp Group Link (https://chat.whatsapp.com/...)
                        </label>
                        <input
                          type="text"
                          value={waGroupInput}
                          onChange={(e) => setWaGroupInput(e.target.value)}
                          placeholder="https://chat.whatsapp.com/..."
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-400 focus:outline-none font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-600 uppercase mb-1">
                          Zalo Group Link (https://zalo.me/g/...)
                        </label>
                        <input
                          type="text"
                          value={zaGroupInput}
                          onChange={(e) => setZaGroupInput(e.target.value)}
                          placeholder="https://zalo.me/g/..."
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-400 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    {groupLinkError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                        <span>{groupLinkError}</span>
                      </div>
                    )}

                    {groupLinkSuccess && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-medium flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{groupLinkSuccess}</span>
                      </div>
                    )}

                    {(() => {
                      const baseId = isSecLeg ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;
                      const parentOrder = (orders || []).find(o => o.id === baseId) || selectedOrder;
                      const waUrl = isSecLeg ? (parentOrder as any)?.whatsappGroupUrlSecondary : (parentOrder as any)?.whatsappGroupUrl;
                      const zaUrl = isSecLeg ? (parentOrder as any)?.zaloGroupUrlSecondary : (parentOrder as any)?.zaloGroupUrl;

                      return (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-sans">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={!waUrl}
                              title={
                                !waUrl
                                  ? (language === 'EN' ? 'No group link yet. Paste it in the field above and press Save.' : 'Chưa có link nhóm. Dán link vào ô bên trên rồi bấm Lưu Link Nhóm.')
                                  : (language === 'EN' ? 'Open WhatsApp group' : 'Mở nhóm WhatsApp')
                              }
                              onClick={() => {
                                if (waUrl) safeOpen(waUrl, '_blank');
                              }}
                              className={`px-3 py-2 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all ${
                                waUrl
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer shadow-xs'
                                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                              }`}
                            >
                              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                              <span>{language === 'EN' ? 'Open WhatsApp group' : 'Mở nhóm WhatsApp'}</span>
                            </button>

                            <button
                              type="button"
                              disabled={!zaUrl}
                              title={
                                !zaUrl
                                  ? (language === 'EN' ? 'No group link yet. Paste it in the field above and press Save.' : 'Chưa có link nhóm. Dán link vào ô bên trên rồi bấm Lưu Link Nhóm.')
                                  : (language === 'EN' ? 'Open Zalo group' : 'Mở nhóm Zalo')
                              }
                              onClick={() => {
                                if (zaUrl) safeOpen(zaUrl, '_blank');
                              }}
                              className={`px-3 py-2 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all ${
                                zaUrl
                                  ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 cursor-pointer shadow-xs'
                                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                              }`}
                            >
                              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                              <span>{language === 'EN' ? 'Open Zalo group' : 'Mở nhóm Zalo'}</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={isSavingGroupLinks}
                            onClick={handleSaveGroupLinks}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center space-x-1.5"
                          >
                            {isSavingGroupLinks ? (
                              <span>Đang lưu...</span>
                            ) : (
                              <span>Lưu Link Nhóm</span>
                            )}
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Edit History (Ops View) */}
                  {(() => {
                    const baseId = selectedOrder.id.replace('_secondary', '');
                    const baseOrder = orders.find((o) => o.id === baseId) || selectedOrder;
                    const logEntries: OrderEditLogEntry[] = [...((baseOrder as any).editLog || [])].reverse();

                    return (
                      <div className="pt-4 border-t border-slate-200/80 space-y-2">
                        <button
                          type="button"
                          onClick={() => setIsEditLogOpen(!isEditLogOpen)}
                          className="w-full flex justify-between items-center text-left py-1 group cursor-pointer focus:outline-none"
                        >
                          <div className="flex items-center gap-2">
                            <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                              <Clock className="h-4 w-4 text-indigo-600" />
                              <span>{language === 'EN' ? 'Edit history' : 'Nhật ký chỉnh sửa'}</span>
                            </h4>
                            <span className="text-[9.5px] font-bold bg-slate-150 text-slate-700 px-2 py-0.5 rounded-full font-mono">
                              {logEntries.length}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-indigo-600 font-bold group-hover:underline">
                            <span>{isEditLogOpen ? (language === 'EN' ? 'Collapse' : 'Thu gọn') : (language === 'EN' ? 'Expand' : 'Xem chi tiết')}</span>
                            {isEditLogOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </div>
                        </button>

                        {isEditLogOpen && (
                          <div className="space-y-2 pt-1">
                            {logEntries.length === 0 ? (
                              <p className="text-xs text-slate-400 font-medium italic px-1 py-1">
                                {language === 'EN' ? 'No edits yet' : 'Chưa có chỉnh sửa nào'}
                              </p>
                            ) : (
                              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                {logEntries.map((entry, idx) => {
                                  const dateStr = entry.at ? new Date(entry.at).toLocaleString(language === 'EN' ? 'en-US' : 'vi-VN') : 'N/A';
                                  return (
                                    <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5 text-xs font-mono">
                                      <div className="flex items-center justify-between gap-2 text-[10.5px]">
                                        <span className="font-extrabold text-slate-800 font-sans">{entry.label || entry.field}</span>
                                        <span className="text-[9.5px] text-slate-400 font-normal shrink-0">{entry.by || 'staff'} • {dateStr}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-slate-700 font-medium text-[11px] min-w-0">
                                        <span className="truncate max-w-[45%]" title={entry.oldValue || 'N/A'}>{entry.oldValue || 'N/A'}</span>
                                        <span className="text-slate-400 shrink-0">→</span>
                                        <span className="font-bold text-slate-900 truncate max-w-[45%]" title={entry.newValue}>{entry.newValue}</span>
                                      </div>
                                      {entry.reason && (
                                        <div className="text-[10.5px] bg-amber-50 border border-amber-200/70 text-amber-900 rounded-lg p-1.5 font-sans leading-relaxed">
                                          <span className="font-bold text-amber-800 mr-1">{language === 'EN' ? 'Reason:' : 'Lý do:'}</span>
                                          {entry.reason}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Internal Ops Discussion Notes */}
                  <div className="pt-4 border-t border-slate-200/80 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4 text-indigo-600" />
                        <span>{language === 'EN' ? 'Internal Ops Notes' : 'Ghi chú nội bộ'}</span>
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold font-sans">
                        {isOrderCombo
                          ? (language === 'EN'
                              ? (isSecLeg ? 'Linked to secondary leg' : 'Linked to primary leg')
                              : (isSecLeg ? 'Gắn với chặng phụ' : 'Gắn với chặng chính'))
                          : (language === 'EN' ? 'Standard link' : 'Gắn đơn tiêu chuẩn')}
                      </span>
                    </div>

                    {/* Notice Banner */}
                    <div className="text-[10.5px] text-amber-800 bg-amber-50/80 border border-amber-200/70 p-2.5 rounded-xl font-medium flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>
                        {language === 'EN'
                          ? 'Internal only. Neither the customer nor the partner can see this.'
                          : 'Chỉ nhân viên nội bộ nhìn thấy. Khách hàng và đối tác KHÔNG thấy nội dung này.'}
                      </span>
                    </div>

                    {/* Simple Note Log Form */}
                    <form onSubmit={handleAddLiaisonNote} className="space-y-2">
                      <div className="relative">
                        <textarea
                          placeholder={
                            language === 'EN'
                              ? 'Enter internal ops notes for this order (e.g. Verified flight details with customer via phone...)'
                              : 'Nhập ghi chú nội bộ cho đơn này (ví dụ: Đã gọi điện xác nhận thông tin chuyến bay với khách...)'
                          }
                          value={liaisonNote}
                          onChange={(e) => setLiaisonNote(e.target.value)}
                          rows={2}
                          className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl p-3 text-xs focus:outline-none transition-all placeholder:text-slate-400 font-sans"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!liaisonNote.trim()}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Send className="h-3 w-3" />
                          <span>{language === 'EN' ? 'Add Note' : 'Ghi chú'}</span>
                        </button>
                      </div>
                    </form>

                    {/* Timeline of logged messages */}
                    <div className="space-y-2 mt-2 max-h-[220px] overflow-y-auto">
                      {activeLogs.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center text-slate-400 text-[11px]">
                          {language === 'EN'
                            ? 'No internal ops notes recorded yet for this order.'
                            : 'Chưa có ghi chú nội bộ nào được lưu cho đơn này.'}
                        </div>
                      ) : (
                        [...activeLogs].reverse().map((log: any, idx: number) => {
                          const authorEmail = log.by || (log.sender === 'system' ? (language === 'EN' ? 'System' : 'Hệ thống') : 'Operations');
                          const isSystem = !log.by && log.sender === 'system';
                          const timeStr = log.timestamp ? (isNaN(Date.parse(log.timestamp)) ? log.timestamp : new Date(log.timestamp).toLocaleString()) : '';

                          return (
                            <div 
                              key={idx} 
                              className={`p-2.5 rounded-xl text-xs space-y-1 border ${
                                isSystem 
                                  ? 'bg-slate-50 text-slate-700 border-slate-200/80' 
                                  : 'bg-indigo-50/40 text-indigo-950 border-indigo-100/60'
                              }`}
                            >
                              <div className="flex justify-between items-center text-[9px] font-bold text-slate-500">
                                <span className="font-mono text-indigo-700 font-bold">{authorEmail}</span>
                                <span className="font-mono text-slate-400">{timeStr}</span>
                              </div>
                              <p className="font-medium text-[11px] leading-relaxed select-all">
                                {log.text}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/20">
              <ClipboardCheck className="h-16 w-16 text-slate-300 stroke-[1.2] mb-4 animate-pulse" />
              <h3 className="font-display font-bold text-slate-800 text-lg">Liaison Profile Active</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                Please select any active order from the left pane list to initiate updates, sync statuses, or copy templates for dispatch.
              </p>
            </div>
          )}

        </div>

      </div>

      {previewPhotoUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fade-in select-none"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Staff Full Preview"
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
}
