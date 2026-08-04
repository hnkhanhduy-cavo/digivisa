import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Send, CheckCircle, Clock, Sparkles, Check, 
  Smartphone, Share2, Clipboard, ArrowRight, UserCheck, AlertCircle, 
  RefreshCw, Layers, FileText, PhoneCall, CheckSquare, Search, Filter,
  ExternalLink, User, Compass, HelpCircle, ClipboardCheck, ArrowUpRight,
  ChevronRight, Building, ShieldAlert, CheckSquare2
} from 'lucide-react';
import { Order, Currency, CURRENCY_SYMBOLS } from '../types';
import { safeStorage } from '../utils/storage';
import { getSplitOrders } from '../utils/orderUtils';
import { formatPhoneE164 } from '../utils/validation';
import { auth } from '../utils/firebase';

interface OMSAgencyCommsProps {
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  discussions: Record<string, Array<{ sender: 'digivisa' | 'partner' | 'system', text: string, timestamp: string }>>;
  setDiscussions: React.Dispatch<React.SetStateAction<Record<string, Array<{ sender: 'digivisa' | 'partner' | 'system', text: string, timestamp: string }>>>>;
  currency: Currency;
  assignedPartners: Record<string, string>;
  setAssignedPartners?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  PARTNERS: Record<string, Array<{ id: string; name: string; contact: string; rating: string; activeOrders: number }>>;
  onSelectOrder: (orderId: string, tab: 'All' | 'Visa' | 'FastTrack' | 'AirportPickup') => void;
  initialSelectedOrderId?: string | null;
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
    return { email: details.email || 'N/A', phone: details.phone ? formatPhoneE164(details.phone) : 'N/A' };
  }
  const rawPhone = details.contactPhone || details.passengerPhone;
  return { 
    email: details.contactEmail || details.passengerEmail || 'N/A', 
    phone: rawPhone ? formatPhoneE164(rawPhone) : 'N/A' 
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

export default function OMSAgencyComms({
  orders,
  setOrders,
  discussions,
  setDiscussions,
  currency,
  assignedPartners,
  setAssignedPartners,
  PARTNERS,
  onSelectOrder,
  initialSelectedOrderId
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

  // Track active leg for combo orders (Dual Service coordination)
  const [activeComboLeg, setActiveComboLeg] = useState<'primary' | 'secondary'>('primary');

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

  // Auto-select first order if none selected
  useEffect(() => {
    const splitOrders = getSplitOrders(orders);
    if (splitOrders.length > 0 && !selectedOrderId) {
      setSelectedOrderId(splitOrders[0].id);
    }
  }, [orders, selectedOrderId]);

  // Sync selectedOrderId when initialSelectedOrderId changes from the parent
  useEffect(() => {
    if (initialSelectedOrderId) {
      setSelectedOrderId(initialSelectedOrderId);
      setFilterType('All'); // Show all order types to guarantee visibility of the selected order
      
      if (initialSelectedOrderId.endsWith('_secondary')) {
        setActiveComboLeg('secondary');
      } else {
        setActiveComboLeg('primary');
      }
    }
  }, [initialSelectedOrderId]);

  // Reset to primary leg whenever the selected order changes
  useEffect(() => {
    setActiveComboLeg('primary');
  }, [selectedOrderId]);

  // Filtered order list
  const filteredOrders = getSplitOrders(orders).filter(o => {
    const custName = getCustomerName(o).toLowerCase();
    const matchesSearch = o.id.toLowerCase().includes(searchQuery.toLowerCase()) || custName.includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'All' || o.type === filterType;
    return matchesSearch && matchesType;
  });

  const selectedOrder = getSplitOrders(orders).find(o => o.id === selectedOrderId) || getSplitOrders(orders)[0];

  // Detect if selected order is a combo
  const isOrderCombo = !selectedOrder?.isSplitLeg && (selectedOrder ? (
    (selectedOrder.type === 'FastTrack' && (selectedOrder.details as any)?.addAirportPickup) ||
    (selectedOrder.type === 'AirportPickup' && (selectedOrder.details as any)?.addFastTrack)
  ) : false);

  // Determine active service type based on switcher
  const activeServiceType = selectedOrder ? (
    !isOrderCombo || activeComboLeg === 'primary'
      ? selectedOrder.type
      : (selectedOrder.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack')
  ) : 'Visa';

  // Determine active partner ID
  const activePartnerId = selectedOrder ? (
    !isOrderCombo || activeComboLeg === 'primary'
      ? assignedPartners[selectedOrder.id]
      : assignedPartners[selectedOrder.id + '_secondary']
  ) : undefined;

  useEffect(() => {
    if (selectedOrder) {
      setWaGroupInput(selectedOrder.whatsappGroupUrl || '');
      setZaGroupInput(selectedOrder.zaloGroupUrl || '');
      setGroupLinkError('');
      setGroupLinkSuccess('');
    }
  }, [selectedOrder?.id, selectedOrder?.whatsappGroupUrl, selectedOrder?.zaloGroupUrl]);

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
          return {
            ...o,
            whatsappGroupUrl: data.whatsappGroupUrl || undefined,
            zaloGroupUrl: data.zaloGroupUrl || undefined,
            groupLinkUpdatedAt: data.groupLinkUpdatedAt,
          };
        }
        return o;
      });

      setOrders(updated);
      safeStorage.setItem('digivisa_orders', JSON.stringify(updated));
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

  // Get Primary Partner assigned to this booking
  const primaryPartnerId = selectedOrder ? assignedPartners[selectedOrder.id] : undefined;
  const primaryPartnerObj = selectedOrder ? PARTNERS[selectedOrder.type]?.find(p => p.id === primaryPartnerId) : undefined;

  // Get Secondary Partner assigned to this booking
  const secondaryType = selectedOrder?.type === 'FastTrack' ? 'AirportPickup' : 'FastTrack';
  const secondaryPartnerId = selectedOrder ? assignedPartners[selectedOrder.id + '_secondary'] : undefined;
  const secondaryPartnerObj = selectedOrder ? PARTNERS[secondaryType]?.find(p => p.id === secondaryPartnerId) : undefined;

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
  const handleUpdateStatus = (newStatus: string) => {
    if (!selectedOrder) return;

    const isSec = selectedOrder.id.endsWith('_secondary');
    const baseId = isSec ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;

    // 1. Update the order in state and local storage
    const updated = orders.map(o => {
      if (o.id === baseId) {
        if (isSec) {
          return { ...o, secondaryStatus: newStatus, secondarySubStatus: undefined };
        } else {
          let subStatus = o.subStatus;
          if (o.type === 'Visa') {
            if (newStatus === 'Agency Review') {
              subStatus = 'Standard Review';
            } else if (newStatus === 'Submitted to Embassy') {
              subStatus = 'Standard processing';
            } else if (newStatus === 'Completed') {
              subStatus = 'Approved';
            } else {
              subStatus = undefined;
            }
          }
          return { ...o, status: newStatus, subStatus };
        }
      }
      return o;
    });
    setOrders(updated);
    safeStorage.setItem('digivisa_orders', JSON.stringify(updated));

    // 2. Add discussion record representing the update
    const legLabel = isSec ? 'Secondary Combo Leg' : 'Primary Leg';
    const partnerName = activePartner ? activePartner.name : 'Partner Liaison';

    const noteText = `🔄 [Bridge Status Update] Person in Charge directly updated ${legLabel} (${activeServiceType}) status to "${newStatus}" after checking in with ${partnerName}.`;
    const newDisc = {
      sender: 'digivisa' as const,
      text: noteText,
      timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    };

    setDiscussions(prev => ({
      ...prev,
      [selectedOrder.id]: [...(prev[selectedOrder.id] || []), newDisc]
    }));
  };

  // Quick Action: Change Order Sub-Status & record log
  const handleUpdateSubStatus = (newSubStatus: string) => {
    if (!selectedOrder) return;

    const isSec = selectedOrder.id.endsWith('_secondary');
    const baseId = isSec ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;

    const updated = orders.map(o => {
      if (o.id === baseId) {
        if (isSec) {
          return { ...o, secondarySubStatus: newSubStatus };
        } else {
          return { ...o, subStatus: newSubStatus };
        }
      }
      return o;
    });
    setOrders(updated);
    safeStorage.setItem('digivisa_orders', JSON.stringify(updated));

    const legLabel = isSec ? 'Secondary Combo Leg' : 'Primary Leg';
    const noteText = `🔄 [Bridge Sub-Status Update] Sub-status set to "${newSubStatus}" for ${legLabel} (${activeServiceType}).`;
    const newDisc = {
      sender: 'digivisa' as const,
      text: noteText,
      timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    };

    setDiscussions(prev => ({
      ...prev,
      [selectedOrder.id]: [...(prev[selectedOrder.id] || []), newDisc]
    }));
  };

  // Quick Action: Update Staff or Vehicle dispatch details
  const handleUpdateStaffOrVehicle = (field: string, value: string) => {
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

    const updated = orders.map(o => {
      if (o.id === baseId) {
        if (isSec) {
          const currentStatus = o.secondaryStatus || 'Confirmed';
          const nextStatus = currentStatus === 'Confirmed' ? 'Staff Assigned' : currentStatus;
          return { ...o, [targetField]: value, secondaryStatus: nextStatus };
        } else {
          const currentStatus = o.status || 'Confirmed';
          const nextStatus = currentStatus === 'Confirmed' ? 'Staff Assigned' : currentStatus;
          return { ...o, [targetField]: value, status: nextStatus };
        }
      }
      return o;
    });
    setOrders(updated);
    safeStorage.setItem('digivisa_orders', JSON.stringify(updated));
  };

  // Quick Action: Add manual liaison discussion note
  const handleAddLiaisonNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !liaisonNote.trim()) return;

    const legLabel = isOrderCombo 
      ? (activeComboLeg === 'primary' ? 'Primary Leg' : 'Secondary Combo Leg')
      : 'Service';

    const formattedNote = `💬 [Bridge Note - ${legLabel}] Staff update: ${liaisonNote}`;
    const newDisc = {
      sender: 'digivisa' as const,
      text: formattedNote,
      timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    };

    setDiscussions(prev => ({
      ...prev,
      [selectedOrder.id]: [...(prev[selectedOrder.id] || []), newDisc]
    }));

    // Update order's internal special requests or notes
    const updated = orders.map(o => {
      if (o.id === selectedOrder.id) {
        const details = o.details as any;
        if (o.type === 'AirportPickup') {
          return {
            ...o,
            details: {
              ...details,
              optionalNote: details.optionalNote 
                ? `${details.optionalNote}\n[Liaison Log]: ${liaisonNote}`
                : `[Liaison Log]: ${liaisonNote}`
            }
          };
        } else {
          return {
            ...o,
            details: {
              ...details,
              specialRequests: details.specialRequests
                ? `${details.specialRequests}\n[Liaison Log]: ${liaisonNote}`
                : `[Liaison Log]: ${liaisonNote}`
            }
          };
        }
      }
      return o;
    });
    setOrders(updated);
    safeStorage.setItem('digivisa_orders', JSON.stringify(updated));

    setLiaisonNote('');
    alert(`📝 Note logged for ${legLabel}! It will appear across tracking panels and operational histories.`);
  };

  // Helper to copy text templates to clipboard
  const handleCopyTemplate = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(label);
    setTimeout(() => setCopySuccess(null), 2500);
  };

  const handleTransferDossier = (order: Order, serviceType: string) => {
    if (!order) return;
    const dossierText = getDossierText(order, serviceType);
    navigator.clipboard.writeText(dossierText);
    
    // Set success banner state
    setDossierTransferSuccess(order.id);
    setTimeout(() => {
      setDossierTransferSuccess(null);
    }, 4500);

    // Automatically log a system notification in discussion records for audit history in OMS
    const agencyName = currentAgency ? currentAgency.agencyName : 'assigned partner agency';
    const noteText = `🚀 [Dossier Sync] Staff coordinator successfully transferred full customer dossier & document checklist details to ${agencyName} for ${serviceType} processing. Payload copied to clipboard.`;
    const newDisc = {
      sender: 'system' as const,
      text: noteText,
      timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    };

    setDiscussions(prev => ({
      ...prev,
      [order.id]: [...(prev[order.id] || []), newDisc]
    }));
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
                const flight = (order.details as any).flightNumber || '';

                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex flex-col space-y-2 outline-none ${
                      isSelected ? 'bg-indigo-50/50 border-r-4 border-indigo-600' : 'border-r-4 border-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono text-[10.5px] font-bold text-slate-900 block select-all">
                          {order.id}
                        </span>
                        <h4 className="text-xs font-black text-slate-800 mt-0.5 truncate max-w-[180px]">
                          {custName}
                        </h4>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {order.type === 'AirportPickup' ? (
                          (() => {
                            const direction = (order.details as any)?.direction || 'Arrival';
                            return (
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                direction === 'Arrival' 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-indigo-100 text-indigo-700'
                              }`}>
                                Pickup ({direction})
                              </span>
                            );
                          })()
                        ) : order.type === 'FastTrack' ? (
                          (() => {
                            const serviceDir = (order.details as any)?.serviceDirection || (order.details as any)?.direction || 'Arrival';
                            const isArrival = serviceDir === 'Arrival';
                            return (
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                isArrival 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : 'bg-teal-100 text-teal-800'
                              }`}>
                                Fasttrack ({serviceDir})
                              </span>
                            );
                          })()
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
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

                    <div className="flex justify-between items-center text-[10px]">
                      <div className="flex items-center text-slate-500 font-medium">
                        <Clock className="h-3 w-3 mr-1 shrink-0" />
                        <span>
                          {order.type === 'Visa' ? (
                            `${(order.details as any).destinationCountry || 'Vietnam'} • ${getDisplayVisaType(order.details)}`
                          ) : (
                            <>
                              {flight ? `Flight ${flight}` : 'Regular Transit'}
                              {(order.type === 'FastTrack' || order.type === 'AirportPickup') && ` • ${(order.details as any).airport || 'Tan Son Nhat (SGN)'}`}
                            </>
                          )}
                        </span>
                      </div>
                      <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[9.5px]">
                        {order.status}
                      </span>
                    </div>

                    {/* Assigned partner label */}
                    <div className="pt-2 border-t border-slate-100/70 flex justify-between items-center text-[9px]">
                      <span className="text-slate-400 font-semibold uppercase tracking-wider">Partner Agency</span>
                      <span className="text-slate-600 font-bold max-w-[180px] truncate">
                        {agency.representative}
                      </span>
                    </div>
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
                  className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-white/5"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Open Fulfillment Card ➜</span>
                </button>
              </div>

              {/* Combo Order Switcher Bridge (Only if isOrderCombo is true) */}
              {isOrderCombo && (
                <div className="bg-purple-50/50 p-4 border-b border-purple-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Layers className="h-4 w-4 text-purple-700 animate-pulse" />
                      <span className="text-[11px] font-black text-purple-900 uppercase tracking-wider">
                        Dual Combo Order Detected: Select service leg to bridge
                      </span>
                    </div>
                    <span className="text-[9px] bg-purple-150 text-purple-800 font-bold px-2 py-0.5 rounded-full uppercase">
                      Independent Partners
                    </span>
                  </div>
                  
                  <p className="text-[11px] text-slate-550 leading-relaxed">
                    Because this is a combo, <strong>different agencies</strong> are responsible for each leg. Select which part of the journey you are coordinating to view their assigned contact details, generate custom chat templates, and transition status.
                  </p>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    
                    {/* Primary Leg Button */}
                    <button
                      onClick={() => setActiveComboLeg('primary')}
                      className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col space-y-1.5 relative overflow-hidden ${
                        activeComboLeg === 'primary'
                          ? 'bg-white border-purple-600 shadow-md ring-2 ring-purple-500/10'
                          : 'bg-slate-50/60 hover:bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[9.5px] uppercase font-black tracking-wider text-slate-400">
                          Leg 1: Primary Service
                        </span>
                        {activeComboLeg === 'primary' && (
                          <span className="w-2 h-2 rounded-full bg-purple-600" />
                        )}
                      </div>
                      <div className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] uppercase font-black">
                          {selectedOrder.type}
                        </span>
                        <span>{primaryPartnerObj ? primaryPartnerObj.name : 'Pending Dispatch'}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium truncate">
                        Liaison: {primaryPartnerObj ? primaryPartnerObj.contact : 'Not Assigned'}
                      </span>
                    </button>

                    {/* Secondary Leg Button */}
                    <button
                      onClick={() => setActiveComboLeg('secondary')}
                      className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col space-y-1.5 relative overflow-hidden ${
                        activeComboLeg === 'secondary'
                          ? 'bg-white border-purple-600 shadow-md ring-2 ring-purple-500/10'
                          : 'bg-slate-50/60 hover:bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[9.5px] uppercase font-black tracking-wider text-slate-400">
                          Leg 2: Secondary Combo
                        </span>
                        {activeComboLeg === 'secondary' && (
                          <span className="w-2 h-2 rounded-full bg-purple-600" />
                        )}
                      </div>
                      <div className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px] uppercase font-black">
                          {secondaryType}
                        </span>
                        <span>{secondaryPartnerObj ? secondaryPartnerObj.name : 'Pending Dispatch'}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium truncate">
                        Liaison: {secondaryPartnerObj ? secondaryPartnerObj.contact : 'Not Assigned'}
                      </span>
                    </button>

                  </div>
                </div>
              )}

              {/* Unified Flow: Combined into one clear column */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-6 max-w-3xl mx-auto w-full animate-fade-in">
                  
                  {/* Find & Assign Partner Agency Dropdown */}
                  <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm space-y-2.5">
                    <label className="block text-[10px] text-slate-555 uppercase font-black tracking-wider flex items-center gap-1.5">
                      <span className="text-indigo-650 font-bold">🔍</span> Find & Match Partner Agency
                    </label>
                    <select
                      value={activePartnerId || ''}
                      onChange={(e) => {
                        const pId = e.target.value;
                        if (!pId) return;

                        // 1. Assign partner using prop callback
                        if (setAssignedPartners) {
                          setAssignedPartners(prev => ({
                            ...prev,
                            [isOrderCombo && activeComboLeg === 'secondary' ? selectedOrder.id + '_secondary' : selectedOrder.id]: pId
                          }));
                        }

                        // 2. Set status of this service leg/order to Confirmed
                        const isSec = isOrderCombo && activeComboLeg === 'secondary';
                        const baseId = isSec ? selectedOrder.id.replace('_secondary', '') : selectedOrder.id;

                        const updated = orders.map(o => {
                          if (o.id === baseId) {
                            if (isSec) {
                              return { ...o, secondaryStatus: 'Confirmed', secondarySubStatus: undefined };
                            } else {
                              return { ...o, status: 'Confirmed', subStatus: undefined };
                            }
                          }
                          return o;
                        });
                        setOrders(updated);
                        safeStorage.setItem('digivisa_orders', JSON.stringify(updated));

                        // 3. Post system memo to discussions
                        const partnerObj = PARTNERS[activeServiceType]?.find(p => p.id === pId);
                        const assignedName = partnerObj ? partnerObj.name : 'Partner';
                        const noteText = `🤝 [Partner Liaison Found] Staff matched and assigned "${assignedName}" to handle the ${activeServiceType} leg. Leg progress status has been updated to "Confirmed" on the central tracker.`;
                        
                        const systemMsg = {
                          sender: 'system' as const,
                          text: noteText,
                          timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                        };

                        setDiscussions(prev => ({
                          ...prev,
                          [selectedOrder.id]: [...(prev[selectedOrder.id] || []), systemMsg]
                        }));
                      }}
                      className="w-full bg-white border border-slate-200 hover:border-slate-350 text-slate-800 text-xs font-bold rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none cursor-pointer transition-colors"
                    >
                      <option value="" className="text-slate-400 font-medium">-- Select Partner Agency --</option>
                      {PARTNERS[activeServiceType]?.map(partner => (
                        <option key={partner.id} value={partner.id}>
                          {partner.name} (⭐ {partner.rating} • Active: {partner.activeOrders})
                        </option>
                      ))}
                    </select>
                    {(!activePartnerId) && (
                      <div className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 p-2 rounded-lg font-medium flex items-center gap-1">
                        <span>⚠️</span> Pending Assignment. Please choose a partner.
                      </div>
                    )}
                  </div>
                  
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

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Passport Number</span>
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 font-mono">
                              <span className="font-extrabold text-slate-800 select-all">{(selectedOrder.details as any).passportNumber || 'N/A'}</span>
                              <button 
                                onClick={() => handleCopyTemplate((selectedOrder.details as any).passportNumber || '', 'Passport')}
                                className="text-[9.5px] text-indigo-600 font-bold hover:underline ml-1"
                              >
                                {copySuccess === 'Passport' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Nationality & DOB</span>
                            <div className="bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium">
                              {(selectedOrder.details as any).nationality || 'N/A'} ({(selectedOrder.details as any).dateOfBirth || 'N/A'})
                            </div>
                          </div>

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

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Target Arrival Date</span>
                            <div className="bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium truncate">
                              {(selectedOrder.details as any).arrivalDate || 'N/A'}
                            </div>
                          </div>

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
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Flight Number</span>
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 font-mono">
                              <span className="font-extrabold text-slate-800">{(selectedOrder.details as any).flightNumber || 'N/A'}</span>
                              <button 
                                onClick={() => handleCopyTemplate((selectedOrder.details as any).flightNumber || '', 'Flight')}
                                className="text-[9.5px] text-indigo-600 font-bold hover:underline ml-1"
                              >
                                {copySuccess === 'Flight' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Airport Location</span>
                            <div className="bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 text-slate-800 font-extrabold">
                              {(selectedOrder.details as any).airport || 'Tan Son Nhat (SGN)'}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Landing Date & Time</span>
                            <div className="bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium">
                              {(selectedOrder.details as any).arrivalDate || 'N/A'} at {(selectedOrder.details as any).arrivalTime || 'N/A'}
                            </div>
                          </div>

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
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Special Requests</span>
                            <div className="bg-amber-50/40 border border-amber-200/60 rounded-lg p-2.5 text-amber-900 font-medium text-[11px] leading-relaxed select-all">
                              {(selectedOrder.details as any).specialRequests || 'No special liaison instructions provided.'}
                            </div>
                          </div>
                        </>
                      )}

                      {activeServiceType === 'AirportPickup' && (
                        <>
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Passenger Name</span>
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5">
                              <span className="font-extrabold text-slate-800 truncate">{(selectedOrder.details as any).passengerName || 'N/A'}</span>
                              <button 
                                onClick={() => handleCopyTemplate((selectedOrder.details as any).passengerName || '', 'PassName')}
                                className="text-[9.5px] text-indigo-600 font-bold hover:underline ml-1"
                              >
                                {copySuccess === 'PassName' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Airport Location</span>
                            <div className="bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 text-slate-850 font-extrabold">
                              {(selectedOrder.details as any).airport || 'Tan Son Nhat (SGN)'}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Pickup Date & Time</span>
                            <div className="bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium">
                              {(selectedOrder.details as any).pickupDate || 'N/A'} at {(selectedOrder.details as any).pickupTime || 'N/A'}
                            </div>
                          </div>

                          {((selectedOrder.details as any).direction || (selectedOrder.details as any).serviceDirection) !== 'Departure' && (
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold uppercase text-slate-400 block font-mono">Flight Number</span>
                              <div className="bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 text-green-700 font-mono font-bold">
                                {(selectedOrder.details as any).flightNumber || 'N/A'}
                              </div>
                            </div>
                          )}

                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Fleet Category</span>
                            <div className="bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium">
                              {(selectedOrder.details as any).vehicleType || '4 seats'}
                            </div>
                          </div>

                          <div className="sm:col-span-2 space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Destination Address</span>
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-150 rounded-lg p-2.5">
                              <span className="font-extrabold text-slate-800 leading-tight select-all">{(selectedOrder.details as any).destinationAddress || 'N/A'}</span>
                              <button 
                                onClick={() => handleCopyTemplate((selectedOrder.details as any).destinationAddress || '', 'Dest')}
                                className="text-[9.5px] text-indigo-600 font-bold hover:underline ml-2 shrink-0"
                              >
                                {copySuccess === 'Dest' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>

                          <div className="sm:col-span-2 space-y-1">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Driver & Dispatch Notes</span>
                            <div className="bg-blue-50/40 border border-blue-200/60 rounded-lg p-2.5 text-blue-900 font-medium text-[11px] leading-relaxed select-all">
                              {(selectedOrder.details as any).optionalNote || 'No special chauffeur instructions provided.'}
                            </div>
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
                          {isOrderCombo ? `Leg Status Bridge: ${activeServiceType}` : 'Direct Status Transition Bridge'}
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
                        let statusOptions: string[] = [];
                        if (activeServiceType === 'Visa') {
                          statusOptions = ['Agency Review', 'Submitted to Embassy', 'Processing', 'Completed'];
                        } else if (activeServiceType === 'AirportPickup') {
                          statusOptions = ['Staff Assigned', 'Passenger Greet', 'Completed'];
                        } else { // FastTrack
                          statusOptions = ['Staff Assigned', 'Completed'];
                        }

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

                    {/* Visa Service Custom Sub-Statuses */}
                    {activeServiceType === 'Visa' && (
                      <div className="space-y-3">
                        {selectedOrder.status === 'Agency Review' && (
                          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl space-y-2 mt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-amber-800 font-extrabold uppercase tracking-wider block">
                                Agency Review Sub-Status
                              </span>
                              <span className="text-[8px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-mono">
                                DOCUMENTATION CHECK
                              </span>
                            </div>
                            <div className="flex gap-2">
                              {[
                                { label: 'Standard Document Check', value: 'Standard Review' },
                                { label: '⚠️ More Documents Required', value: 'More documents required' }
                              ].map((subOpt) => {
                                const isSel = (selectedOrder.subStatus || 'Standard Review') === subOpt.value;
                                return (
                                  <button
                                    key={subOpt.value}
                                    type="button"
                                    onClick={() => handleUpdateSubStatus(subOpt.value)}
                                    className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-lg border transition-all cursor-pointer ${
                                      isSel 
                                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm' 
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    {subOpt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {selectedOrder.status === 'Submitted to Embassy' && (
                          <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl space-y-2 mt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-indigo-800 font-extrabold uppercase tracking-wider block">
                                Embassy Submission Sub-Status
                              </span>
                              <span className="text-[8px] font-black bg-indigo-100 text-indigo-900 border border-indigo-300 px-1.5 py-0.2 rounded font-mono">
                                EMBASSY WAITING
                              </span>
                            </div>
                            <div className="flex gap-2">
                              {[
                                { label: 'Standard Under Review', value: 'Standard processing' },
                                { label: '⚠️ More Docs Required (Embassy Request)', value: 'Awaiting Paperwork' }
                              ].map((subOpt) => {
                                const isSel = (selectedOrder.subStatus || 'Standard processing') === subOpt.value;
                                return (
                                  <button
                                    key={subOpt.value}
                                    type="button"
                                    onClick={() => handleUpdateSubStatus(subOpt.value)}
                                    className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-lg border transition-all cursor-pointer ${
                                      isSel 
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    {subOpt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {selectedOrder.status === 'Completed' && (
                          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl space-y-2 mt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-emerald-800 font-extrabold uppercase tracking-wider block">
                                Completed Sub-Status
                              </span>
                              <span className="text-[8px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.2 rounded font-mono">
                                OUTCOME VERIFIED
                              </span>
                            </div>
                            <div className="flex gap-2">
                              {[
                                { label: 'Approved & Issued', value: 'Approved' },
                                { label: 'Declined / Rejected', value: 'Declined' }
                              ].map((subOpt) => {
                                const isSel = (selectedOrder.subStatus || 'Approved') === subOpt.value;
                                return (
                                  <button
                                    key={subOpt.value}
                                    type="button"
                                    onClick={() => handleUpdateSubStatus(subOpt.value)}
                                    className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-lg border transition-all cursor-pointer ${
                                      isSel 
                                        ? subOpt.value === 'Approved'
                                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                          : 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    {subOpt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fast Track Service Staff Assigned Form */}
                    {activeServiceType === 'FastTrack' && (selectedOrder.status === 'Confirmed' || selectedOrder.status === 'Staff Assigned') && (
                      <div className="mt-3 p-4 bg-purple-50/50 border border-purple-200/65 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <UserCheck className="h-4 w-4 text-purple-700" />
                            <span className="text-[10.5px] font-black text-purple-900 uppercase tracking-wider">Fast Track PIC Staff Dispatch</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Staff Name</label>
                            <input 
                              type="text" 
                              value={selectedOrder.staffName || ''} 
                              onChange={(e) => handleUpdateStaffOrVehicle('staffName', e.target.value)}
                              placeholder="e.g. Mr. Kevin Pham" 
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Staff Phone</label>
                            <input 
                              type="text" 
                              value={selectedOrder.staffPhone || ''} 
                              onChange={(e) => handleUpdateStaffOrVehicle('staffPhone', e.target.value)}
                              placeholder="e.g. +84912334556" 
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none font-mono"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Meeting Location</label>
                            <input 
                              type="text" 
                              value={selectedOrder.staffLocation || ''} 
                              onChange={(e) => handleUpdateStaffOrVehicle('staffLocation', e.target.value)}
                              placeholder="e.g. Arrival Terminal Gate A2 (near Coffee Stand)" 
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Staff Portrait Photo URL</label>
                            <div className="flex items-center space-x-2">
                              <input 
                                type="text" 
                                value={selectedOrder.staffPhoto || ''} 
                                onChange={(e) => handleUpdateStaffOrVehicle('staffPhoto', e.target.value)}
                                placeholder="e.g. https://images.unsplash.com/photo-..." 
                                className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none"
                              />
                              {selectedOrder.staffPhoto && (
                                <img 
                                  src={selectedOrder.staffPhoto} 
                                  alt="Preview" 
                                  referrerPolicy="no-referrer"
                                  className="h-8 w-8 rounded-full border border-slate-200 object-cover shrink-0"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Airport Transfer Service Staff & Vehicle Assigned Form */}
                    {activeServiceType === 'AirportPickup' && (selectedOrder.status === 'Confirmed' || selectedOrder.status === 'Staff Assigned') && (
                      <div className="mt-3 p-4 bg-blue-50/50 border border-blue-200/65 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <UserCheck className="h-4 w-4 text-blue-700" />
                            <span className="text-[10.5px] font-black text-blue-900 uppercase tracking-wider">Chauffeur & Fleet Dispatch Details</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateStaffOrVehicle('staffName', 'Mr. Nam Cao (VIP Fleet Captain)');
                              handleUpdateStaffOrVehicle('staffPhone', '+84909667334');
                              handleUpdateStaffOrVehicle('licensePlate', '30A - 888.88');
                              handleUpdateStaffOrVehicle('staffPhoto', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150');
                              handleUpdateStaffOrVehicle('carPhoto', 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&q=80&w=300');
                            }}
                            className="text-[9px] bg-blue-100 hover:bg-blue-200 text-blue-800 font-extrabold px-2 py-0.5 rounded transition-all cursor-pointer border border-blue-200"
                          >
                            ⚡ Auto-Fill Chauffeur
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Chauffeur Name</label>
                            <input 
                              type="text" 
                              value={selectedOrder.staffPhone ? selectedOrder.staffName : selectedOrder.staffName || ''} 
                              onChange={(e) => handleUpdateStaffOrVehicle('staffName', e.target.value)}
                              placeholder="e.g. Mr. Nam Cao" 
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Chauffeur Phone</label>
                            <input 
                              type="text" 
                              value={selectedOrder.staffPhone || ''} 
                              onChange={(e) => handleUpdateStaffOrVehicle('staffPhone', e.target.value)}
                              placeholder="e.g. +84909667334" 
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">License Plate</label>
                            <input 
                              type="text" 
                              value={selectedOrder.licensePlate || ''} 
                              onChange={(e) => handleUpdateStaffOrVehicle('licensePlate', e.target.value)}
                              placeholder="e.g. 30A - 888.88" 
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none font-semibold font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Chauffeur Photo URL</label>
                            <div className="flex items-center space-x-2">
                              <input 
                                type="text" 
                                value={selectedOrder.staffPhoto || ''} 
                                onChange={(e) => handleUpdateStaffOrVehicle('staffPhoto', e.target.value)}
                                placeholder="e.g. https://images.unsplash.com/photo-..." 
                                className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
                              />
                              {selectedOrder.staffPhoto && (
                                <img 
                                  src={selectedOrder.staffPhoto} 
                                  alt="Preview" 
                                  referrerPolicy="no-referrer"
                                  className="h-8 w-8 rounded-full border border-slate-200 object-cover shrink-0"
                                />
                              )}
                            </div>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[8.5px] font-black text-slate-500 uppercase mb-1">Vehicle Photo URL</label>
                            <div className="flex items-center space-x-2">
                              <input 
                                type="text" 
                                value={selectedOrder.carPhoto || ''} 
                                onChange={(e) => handleUpdateStaffOrVehicle('carPhoto', e.target.value)}
                                placeholder="e.g. https://images.unsplash.com/photo-..." 
                                className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
                              />
                              {selectedOrder.carPhoto && (
                                <img 
                                  src={selectedOrder.carPhoto} 
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
                      {selectedOrder.groupLinkUpdatedAt && (
                        <span className="text-[9.5px] font-mono text-slate-500">
                          Cập nhật: {new Date(selectedOrder.groupLinkUpdatedAt).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <p className="text-[10.5px] text-slate-600 leading-normal">
                      💡 <strong>Hướng dẫn:</strong> Nhóm chat phải được tạo thủ công trong ứng dụng WhatsApp/Zalo. Sau đó copy link mời (invite link) và dán vào bên dưới rồi bấm <strong>Lưu Link Nhóm</strong>. (Tẩy trống ô rồi lưu để xóa link).
                    </p>

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

                    <div className="flex justify-end">
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
                  </div>

                  {/* Liaison discussion log */}
                  <div className="pt-4 border-t border-slate-200/80 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4 text-indigo-600" />
                        <span>Staff-Partner Liaison Logs & Memos</span>
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold font-sans">
                        {isOrderCombo ? `Linking to ${activeComboLeg} leg` : 'Standard link'}
                      </span>
                    </div>

                    {/* Simple Note Log Form */}
                    <form onSubmit={handleAddLiaisonNote} className="space-y-2">
                      <div className="relative">
                        <textarea
                          placeholder={
                            isOrderCombo
                              ? `e.g. Spoke with ${activePartner?.contact || 'partner'} regarding ${activeServiceType} leg. Everything confirmed for arrival...`
                              : "e.g. Discussed documentation check with Huong. Passport scans verified, submitting to embassy."
                          }
                          value={liaisonNote}
                          onChange={(e) => setLiaisonNote(e.target.value)}
                          rows={2}
                          className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl p-3 text-xs focus:outline-none transition-all placeholder:text-slate-400"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!liaisonNote.trim()}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1 shadow-sm transition-all"
                        >
                          <Send className="h-3 w-3" />
                          <span>Log Discussion Memo</span>
                        </button>
                      </div>
                    </form>

                    {/* Timeline of logged messages */}
                    <div className="space-y-2 mt-2 max-h-[180px] overflow-y-auto">
                      {activeLogs.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center text-slate-400 text-[11px]">
                          No manual discussion logs registered yet. Type above to record call details.
                        </div>
                      ) : (
                        [...activeLogs].reverse().map((log, idx) => {
                          const isPlatformLog = log.text.includes("Bridge Status Update") || log.text.includes("Liaison Status Update");
                          return (
                            <div 
                              key={idx} 
                              className={`p-2.5 rounded-xl text-xs space-y-1 border ${
                                isPlatformLog 
                                  ? 'bg-slate-50 text-slate-700 border-slate-200/80' 
                                  : 'bg-indigo-50/40 text-indigo-950 border-indigo-100/60'
                              }`}
                            >
                              <div className="flex justify-between items-center text-[9px] font-bold text-slate-450 uppercase">
                                <span>{isPlatformLog ? 'PLATFORM SYSTEM' : 'STAFF COORD LOG'}</span>
                                <span className="font-mono">{log.timestamp}</span>
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

    </div>
  );
}
