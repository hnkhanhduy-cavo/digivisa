import React from 'react';
import { Plane, Compass, ClipboardList, Info, Building, Globe, User, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { Language, TRANSLATIONS } from '../utils/translations';

interface HeaderProps {
  activeTab: 'services' | 'tracker' | 'faqs' | 'oms';
  setActiveTab: (tab: 'services' | 'tracker' | 'faqs' | 'oms') => void;
  orderCount: number;
  userRole: 'customer' | 'staff';
  setUserRole: (role: 'customer' | 'staff') => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  currentUser?: { email?: string | null; displayName?: string | null } | null;
  onOpenUserAuth?: () => void;
  onOpenAdminAuth?: () => void;
  onLogout?: () => void;
}

export default function Header({
  activeTab,
  setActiveTab,
  orderCount,
  userRole,
  setUserRole,
  language,
  setLanguage,
  currentUser,
  onOpenUserAuth,
  onOpenAdminAuth,
  onLogout,
}: HeaderProps) {
  const t = TRANSLATIONS[language];
  const isEn = language === 'EN';

  return (
    <header className="sticky top-0 z-50 bg-white/90 text-slate-800 shadow-sm backdrop-blur-md border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo Brand */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group animate-fade-in"
            onClick={() => setActiveTab('services')}
            id="header-brand-logo"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm shadow-indigo-600/10 group-hover:scale-105 transition-transform duration-200">
              <Plane className="h-4 w-4 sm:h-5 sm:w-5 text-white rotate-45 group-hover:rotate-90 transition-transform duration-300" />
            </div>
            <div>
              <div className="flex items-center">
                <span className="font-display font-extrabold tracking-tight text-lg sm:text-xl text-slate-900">
                  DIGIVISA
                </span>
                <span className="ml-1.5 px-2 py-0.5 text-[8px] font-bold tracking-widest text-indigo-600 bg-indigo-50 rounded-full border border-indigo-100 uppercase hidden sm:inline-block">
                  {t.secureBadge}
                </span>
              </div>
              <span className="hidden sm:block text-[9px] text-slate-400 tracking-wider font-sans font-medium uppercase mt-0.5">
                {t.officialGateways}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1 bg-slate-50 p-1 rounded-xl border border-slate-150/80">
            <button
              id="nav-services-btn"
              onClick={() => setActiveTab('services')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === 'services'
                  ? 'bg-white text-indigo-600 border border-slate-200/80 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 border border-transparent'
              }`}
            >
              <Compass className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500" />
              <span>{t.services}</span>
            </button>

            <button
              id="nav-tracker-btn"
              onClick={() => setActiveTab('tracker')}
              className={`relative flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === 'tracker'
                  ? 'bg-white text-indigo-600 border border-slate-200/80 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 border border-transparent'
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500" />
              <span>{t.myOrders}</span>
              {orderCount > 0 && (
                <span className="absolute -top-1 -right-1 sm:-top-1 sm:-right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white ring-2 ring-white">
                  {orderCount}
                </span>
              )}
            </button>

            <button
              id="nav-faqs-btn"
              onClick={() => setActiveTab('faqs')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeTab === 'faqs'
                  ? 'bg-white text-indigo-600 border border-slate-200/80 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 border border-transparent'
              }`}
            >
              <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500" />
              <span>{t.guideInfo}</span>
            </button>

            {/* Staff OMS tab is ONLY visible when user is in staff/admin role */}
            {userRole === 'staff' && (
              <button
                id="nav-oms-btn"
                onClick={() => setActiveTab('oms')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                  activeTab === 'oms'
                    ? 'bg-[#1E293B] text-white border border-[#334155] shadow-md font-semibold'
                    : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100'
                }`}
              >
                <Building className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500 group-hover:text-white" />
                <span>{t.staffOms}</span>
                <span className="hidden md:inline-block px-1.5 py-0.5 text-[8px] font-bold text-white bg-indigo-600 rounded">
                  {t.adminLabel}
                </span>
              </button>
            )}
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center space-x-2">
            
            {/* Customer Login / Register Button */}
            {currentUser ? (
              <div className="flex items-center space-x-1.5 bg-indigo-50 border border-indigo-100 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl">
                <User className="h-3.5 w-3.5 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-900 truncate max-w-[100px] sm:max-w-[140px]">
                  {currentUser.displayName || currentUser.email?.split('@')[0]}
                </span>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                    title={isEn ? "Logout" : "Đăng xuất"}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenUserAuth}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isEn ? 'Sign In / Register' : 'Đăng nhập / Đăng ký'}</span>
                <span className="sm:hidden">{isEn ? 'Sign In' : 'Đăng nhập'}</span>
              </button>
            )}

            {/* Staff / Admin Access Button */}
            {userRole === 'staff' ? (
              <button
                onClick={() => {
                  setUserRole('customer');
                  setActiveTab('services');
                }}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-emerald-400 font-bold rounded-xl text-[10px] uppercase tracking-wider transition-colors cursor-pointer border border-slate-700"
                title={isEn ? "Exit Staff Admin Mode" : "Thoát chế độ Admin"}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden md:inline">{isEn ? 'Exit Admin' : 'Thoát Admin'}</span>
              </button>
            ) : (
              <button
                onClick={onOpenAdminAuth}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title={isEn ? "Staff Admin Login" : "Đăng nhập Staff / Admin"}
              >
                <ShieldCheck className="h-4 w-4" />
              </button>
            )}

            {/* Language Selector Dropdown */}
            <div className="flex items-center bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl shadow-xs">
              <Globe className="h-3.5 w-3.5 text-slate-500 mr-1" />
              <select
                id="language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-transparent border-none text-slate-700 text-xs sm:text-sm font-semibold focus:ring-0 focus:outline-none cursor-pointer pr-1"
              >
                <option value="EN" className="bg-white text-slate-800">EN</option>
                <option value="VI" className="bg-white text-slate-800">VI</option>
              </select>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}
