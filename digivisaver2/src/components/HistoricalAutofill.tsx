import React, { useState } from 'react';
import { Sparkles, Users, Search, Check, RefreshCw, UserCheck, AlertCircle } from 'lucide-react';
import { HISTORICAL_PROFILES, HistoricalProfile } from '../data/historicalUsers';

interface HistoricalAutofillProps {
  onSelect: (profile: HistoricalProfile) => void;
  serviceType: 'Visa' | 'FastTrack' | 'AirportPickup';
}

export default function HistoricalAutofill({ onSelect, serviceType }: HistoricalAutofillProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = HISTORICAL_PROFILES.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.passportNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (profile: HistoricalProfile) => {
    setSelectedId(profile.id);
    onSelect(profile);
    setIsOpen(false);
  };

  const getServiceLabel = () => {
    if (serviceType === 'Visa') return 'Vietnam Digital eVisa / Entry Permit';
    if (serviceType === 'FastTrack') return 'VVIP Airport Fast-Track Assistant';
    return 'VIP Chauffeur Transfer';
  };

  return (
    <div className="bg-gradient-to-r from-amber-50 to-indigo-50/70 p-4 sm:p-5 rounded-2xl border border-indigo-100 shadow-sm space-y-3 mb-6" id="historical-autofill-banner">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="h-9 w-9 rounded-xl bg-amber-105 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 shadow-sm mt-0.5">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
              ⚡ Returning Corporate Traveler?
            </span>
            <h4 className="font-display font-bold text-slate-800 text-xs mt-1">
              Instant Travel Profile Restoration & Autofill
            </h4>
            <p className="text-[11px] text-slate-550 max-w-xl">
              We found historical records in our global concierge directory. Choose your traveler profile below to instantly populate your biometrics, passport codes, and tax invoicing logs.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="sm:self-center px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center space-x-1.5 transition-all w-full sm:w-auto justify-center"
        >
          <Users className="h-4 w-4" />
          <span>{isOpen ? 'Close Profile Search' : 'Select Customer Profile'}</span>
        </button>
      </div>

      {isOpen && (
        <div className="pt-3 border-t border-indigo-100 space-y-3 bg-white/70 p-4 rounded-xl mt-2 animate-fade-in">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by full traveler name, email address or passport code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Grid list of profiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center col-span-2">No matching profiles found in database</p>
            ) : (
              filtered.map((profile) => {
                const isSelected = selectedId === profile.id;
                return (
                  <div
                    key={profile.id}
                    onClick={() => handleSelect(profile)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800">{profile.firstName} {profile.lastName}</span>
                        <span className="text-[9px] font-mono bg-slate-100 rounded px-1.5 text-slate-500 font-semibold">{profile.id}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 flex flex-wrap gap-x-2">
                        <span>🛂 {profile.passportNumber} ({profile.nationality})</span>
                        <span>•</span>
                        <span className="truncate max-w-[140px]">{profile.email}</span>
                      </p>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0 ml-2">
                      {isSelected ? (
                        <div className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="h-3 w-3" />
                        </div>
                      ) : (
                        <span className="text-[10px] text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded font-black hover:bg-indigo-100">
                          SELECT
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {selectedId && (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-250 rounded-xl text-xs flex items-center justify-between text-emerald-800 animate-fade-in-quick">
          <div className="flex items-center space-x-2">
            <UserCheck className="h-4.5 w-4.5 text-emerald-650 shrink-0" />
            <span>
              Profile <strong>{HISTORICAL_PROFILES.find(p => p.id === selectedId)?.name.split(' (')[0]}</strong> successfully restored! Review travel dates & submit.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-[10px] font-black text-rose-600 hover:underline px-2"
          >
            Clear Autofill
          </button>
        </div>
      )}
    </div>
  );
}
