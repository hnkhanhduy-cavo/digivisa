import React, { useState, useEffect } from 'react';
import { Sparkles, Users, Check, UserCheck, CheckCircle2 } from 'lucide-react';
import { safeStorage } from '../utils/storage';
import { auth } from '../utils/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export interface UserProfile {
  id: string;
  orderId?: string;
  contactName: string;
  firstName: string;
  lastName: string;
  passportNumber: string;
  passportExpiry: string;
  nationality: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  flightNumber?: string;
  airlineName?: string;
  airport?: string;
  pickupDestination?: string;
  createdAt?: string;
  paymentStatus?: string;
}

interface HistoricalAutofillProps {
  onSelect: (profile: UserProfile) => void;
  serviceType: 'Visa' | 'FastTrack' | 'AirportPickup';
  language?: 'EN' | 'VI';
}

export default function HistoricalAutofill({ onSelect, serviceType, language = 'VI' }: HistoricalAutofillProps) {
  const isEn = language === 'EN';
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);

  // Listen to Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  // Load max 4 recent successful registered profiles from past orders
  useEffect(() => {
    try {
      const savedOrdersRaw = safeStorage.getItem('digivisa_orders');
      if (savedOrdersRaw) {
        const orders = JSON.parse(savedOrdersRaw);
        if (Array.isArray(orders)) {
          const profileMap = new Map<string, UserProfile>();

          // Sort orders by createdAt descending (most recent first)
          const sortedOrders = [...orders].sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
          });

          sortedOrders.forEach((ord: any) => {
            const d = ord.details || {};
            const passport = d.passportNumber || d.passportNo || '';
            const cName = d.contactName || d.passengerName || (d.firstName ? `${d.firstName} ${d.lastName || ''}`.trim() : '');
            const fName = d.firstName || (cName ? cName.split(' ')[0] : '');
            const lName = d.lastName || (cName ? cName.split(' ').slice(1).join(' ') : '');

            const key = passport.trim().toUpperCase() || cName.trim().toUpperCase() || ord.id;

            if (key && (fName || cName)) {
              if (!profileMap.has(key)) {
                profileMap.set(key, {
                  id: ord.id || `PROFILE-${profileMap.size + 1}`,
                  orderId: ord.id,
                  contactName: cName || `${fName} ${lName}`.trim(),
                  firstName: fName,
                  lastName: lName,
                  passportNumber: passport,
                  passportExpiry: d.passportExpiry || '',
                  nationality: d.nationality || 'United States',
                  dateOfBirth: d.dateOfBirth || '',
                  email: d.email || d.contactEmail || d.passengerEmail || currentUser?.email || '',
                  phone: d.phone || d.contactPhone || d.passengerPhone || '',
                  flightNumber: d.flightNumber || '',
                  airlineName: d.airlineName || '',
                  airport: d.airport || '',
                  pickupDestination: d.pickupDestination || '',
                  createdAt: ord.createdAt || new Date().toISOString(),
                  paymentStatus: ord.paymentStatus || 'Paid',
                });
              }
            }
          });

          // Take MAX 4 MOST RECENT PROFILES
          const list = Array.from(profileMap.values()).slice(0, 4);
          setUserProfiles(list);
        }
      }
    } catch (e) {
      console.error('Error reading user profiles:', e);
    }
  }, [currentUser]);

  if (userProfiles.length === 0) {
    return null;
  }

  const handleSelect = (profile: UserProfile) => {
    setSelectedId(profile.id);
    onSelect(profile);
    setIsOpen(false);
  };

  const selectedProfile = userProfiles.find((p) => p.id === selectedId);

  return (
    <div className="bg-gradient-to-r from-emerald-50/90 via-indigo-50/70 to-blue-50/80 p-4 sm:p-5 rounded-2xl border border-indigo-150 shadow-xs space-y-3 mb-6" id="historical-autofill-banner">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md mt-0.5">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200">
                ⚡ {isEn ? '4 Recent Successful Orders' : '4 Đơn Thành Công Gần Nhất'}
              </span>
            </div>
            <h4 className="font-display font-bold text-slate-800 text-xs mt-1">
              {isEn ? 'Quick Fill from Registered Successful Orders' : 'Gọi lại thông tin từ các đơn đã đăng ký thành công'}
            </h4>
            <p className="text-[11px] text-slate-600 max-w-xl">
              {isEn 
                ? 'Click below to quickly populate traveller biometrics, contact email, phone & flight details from your 4 most recent successful orders.'
                : 'Nhấn nút bên dưới để chọn lại 1 trong 4 đơn đăng ký thành công gần nhất để điền nhanh các ô thông tin.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="sm:self-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center space-x-1.5 transition-all w-full sm:w-auto justify-center"
        >
          <Users className="h-4 w-4" />
          <span>
            {isOpen 
              ? (isEn ? 'Close List' : 'Đóng Danh Sách') 
              : (isEn ? '⚡ Select Recent Order (Max 4)' : '⚡ Chọn Đơn Đăng Ký Thành Công')}
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="pt-3 border-t border-indigo-150 space-y-3 bg-white/90 backdrop-blur-xs p-4 rounded-xl mt-2 animate-fade-in shadow-inner">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
              {isEn ? 'Select an order to auto-fill details below:' : 'Bấm vào đơn để tự động điền lại thông tin bên dưới:'}
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              {isEn ? `Showing ${userProfiles.length} recent order(s)` : `Hiển thị ${userProfiles.length} đơn gần nhất`}
            </span>
          </div>

          {/* Grid list of max 4 recent orders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {userProfiles.map((profile) => {
              const isSelected = selectedId === profile.id;
              return (
                <div
                  key={profile.id}
                  onClick={() => handleSelect(profile)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500 shadow-sm'
                      : 'border-slate-200 hover:border-indigo-400 bg-white hover:bg-slate-50/80 shadow-2xs'
                  }`}
                >
                  <div className="space-y-1 overflow-hidden pr-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 truncate">
                        {profile.contactName || `${profile.firstName} ${profile.lastName}`}
                      </span>
                      {profile.orderId && (
                        <span className="text-[9px] font-mono bg-slate-100 text-slate-700 px-1.5 rounded font-bold border border-slate-200 shrink-0">
                          {profile.orderId}
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-500 space-y-0.5">
                      {profile.passportNumber && (
                        <p>🛂 Hộ chiếu: <strong className="font-mono text-slate-700">{profile.passportNumber}</strong> ({profile.nationality})</p>
                      )}
                      {profile.email && <p className="truncate">✉️ Email: <strong className="text-slate-700">{profile.email}</strong></p>}
                      {profile.phone && <p>📞 SĐT: <strong className="font-mono text-slate-700">{profile.phone}</strong></p>}
                      {profile.flightNumber && <p>✈️ Chuyến bay: <strong className="font-mono text-slate-700">{profile.flightNumber}</strong> ({profile.airport || ''})</p>}
                    </div>

                    <div className="pt-1 flex items-center space-x-2">
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                        {isEn ? 'Registered / Paid' : 'Đã Đăng Ký / Thành Công'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 ml-1">
                    {isSelected ? (
                      <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    ) : (
                      <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg font-bold hover:bg-indigo-100 border border-indigo-200 transition-colors">
                        {isEn ? 'USE THIS' : 'CHỌN ĐƠN NÀY'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedId && selectedProfile && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-300 rounded-xl text-xs flex items-center justify-between text-emerald-900 animate-fade-in-quick">
          <div className="flex items-center space-x-2">
            <UserCheck className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
            <span>
              {isEn ? 'Successfully filled data from order ' : 'Đã tự động điền dữ liệu từ đơn hàng '} 
              <strong className="font-mono">{selectedProfile.orderId || selectedProfile.id}</strong> ({selectedProfile.contactName})!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-[10px] font-black text-rose-600 hover:underline px-2 cursor-pointer shrink-0"
          >
            {isEn ? 'Clear' : 'Xóa thông tin'}
          </button>
        </div>
      )}
    </div>
  );
}
