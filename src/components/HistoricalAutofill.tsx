import React, { useState, useEffect } from 'react';
import { Sparkles, Users, Check, UserCheck } from 'lucide-react';
import { safeStorage } from '../utils/storage';
import { auth } from '../utils/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  passportNumber: string;
  passportExpiry: string;
  nationality: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  passportScan?: string;
  photoScan?: string;
  passportScanDataUrl?: string;
  photoScanDataUrl?: string;
  createdAt?: string;
}

interface HistoricalAutofillProps {
  onSelect: (profile: any) => void;
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

  // Load registered user profiles from past orders
  useEffect(() => {
    if (!currentUser) {
      setUserProfiles([]);
      return;
    }

    try {
      const savedOrdersRaw = safeStorage.getItem('digivisa_orders');
      if (savedOrdersRaw) {
        const orders = JSON.parse(savedOrdersRaw);
        if (Array.isArray(orders)) {
          const profileMap = new Map<string, UserProfile>();

          orders.forEach((ord: any) => {
            const d = ord.details || {};
            // Extract passenger / bio info
            const passport = d.passportNumber || d.passportNo || '';
            const fName = d.firstName || (d.passengerName ? d.passengerName.split(' ')[0] : '');
            const lName = d.lastName || (d.passengerName ? d.passengerName.split(' ').slice(1).join(' ') : '');

            if (passport && fName) {
              const key = passport.trim().toUpperCase();
              if (!profileMap.has(key)) {
                profileMap.set(key, {
                  id: ord.id || `PROFILE-${profileMap.size + 1}`,
                  firstName: fName,
                  lastName: lName,
                  passportNumber: key,
                  passportExpiry: d.passportExpiry || '',
                  nationality: d.nationality || 'United States',
                  dateOfBirth: d.dateOfBirth || '',
                  email: d.email || currentUser.email || '',
                  phone: d.phone || '',
                  passportScan: d.passportScan || '',
                  photoScan: d.photoScan || '',
                  passportScanDataUrl: d.passportScanDataUrl || '',
                  photoScanDataUrl: d.photoScanDataUrl || '',
                  createdAt: ord.createdAt || new Date().toISOString()
                });
              }
            }
          });

          // Convert map values to array and take MAX 4 MOST RECENT PROFILES
          const list = Array.from(profileMap.values()).slice(0, 4);
          setUserProfiles(list);
        }
      }
    } catch (e) {
      console.error('Error reading user profiles:', e);
    }
  }, [currentUser]);

  // CRITICAL REQUIREMENT: Only show this block for logged-in users who have at least 1 saved profile!
  if (!currentUser || userProfiles.length === 0) {
    return null;
  }

  const handleSelect = (profile: UserProfile) => {
    setSelectedId(profile.id);
    onSelect(profile);
    setIsOpen(false);
  };

  return (
    <div className="bg-gradient-to-r from-amber-50 to-indigo-50/70 p-4 sm:p-5 rounded-2xl border border-indigo-100 shadow-sm space-y-3 mb-6" id="historical-autofill-banner">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 shadow-sm mt-0.5">
            <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-indigo-800 bg-indigo-100/80 px-2 py-0.5 rounded-full border border-indigo-200">
              ⚡ {isEn ? 'Saved Profile Auto-Fill' : 'Tự Động Điền Hồ Sơ Đã Đăng Ký'}
            </span>
            <h4 className="font-display font-bold text-slate-800 text-xs mt-1">
              {isEn ? 'Restore Previous Traveller Profiles (Max 4 Recent)' : 'Khôi phục thông tin hành khách từ các đơn thành công trước đây'}
            </h4>
            <p className="text-[11px] text-slate-500 max-w-xl">
              {isEn 
                ? 'Select a previously registered traveller to instantly populate biometrics and passport info.'
                : 'Bấm chọn danh tính hành khách bên dưới để tự động điền nhanh số hộ chiếu, ngày sinh và họ tên.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="sm:self-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center space-x-1.5 transition-all w-full sm:w-auto justify-center"
        >
          <Users className="h-4 w-4" />
          <span>{isOpen ? (isEn ? 'Close Profiles' : 'Đóng Danh Sách') : (isEn ? 'Select Saved Profile' : 'Chọn Hồ Sơ Đã Đăng Ký')}</span>
        </button>
      </div>

      {isOpen && (
        <div className="pt-3 border-t border-indigo-100 space-y-3 bg-white/80 backdrop-blur-xs p-4 rounded-xl mt-2 animate-fade-in">
          {/* Grid list of max 4 recent profiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {userProfiles.map((profile) => {
              const isSelected = selectedId === profile.id;
              return (
                <div
                  key={profile.id}
                  onClick={() => handleSelect(profile)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500 shadow-2xs'
                      : 'border-slate-200 hover:border-indigo-300 bg-white shadow-2xs'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">{profile.firstName} {profile.lastName}</span>
                      <span className="text-[9px] font-mono bg-indigo-50 text-indigo-700 rounded px-1.5 font-bold border border-indigo-100">
                        {profile.nationality}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 flex items-center space-x-2">
                      <span>🛂 Hộ chiếu: <strong className="font-mono text-slate-700">{profile.passportNumber}</strong></span>
                      {profile.email && <span>• {profile.email}</span>}
                    </p>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 ml-2">
                    {isSelected ? (
                      <div className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </div>
                    ) : (
                      <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg font-bold hover:bg-indigo-100 border border-indigo-150 transition-colors">
                        {isEn ? 'SELECT' : 'CHỌN'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedId && (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-250 rounded-xl text-xs flex items-center justify-between text-emerald-800 animate-fade-in-quick">
          <div className="flex items-center space-x-2">
            <UserCheck className="h-4.5 w-4.5 text-emerald-650 shrink-0" />
            <span>
              {isEn ? 'Restored profile for ' : 'Đã khôi phục thông tin hành khách '} 
              <strong>{userProfiles.find(p => p.id === selectedId)?.firstName} {userProfiles.find(p => p.id === selectedId)?.lastName}</strong>!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-[10px] font-black text-rose-600 hover:underline px-2 cursor-pointer"
          >
            {isEn ? 'Clear' : 'Xóa thông tin'}
          </button>
        </div>
      )}
    </div>
  );
}
