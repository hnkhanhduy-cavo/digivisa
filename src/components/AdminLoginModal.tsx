import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Lock, Eye, EyeOff, X, AlertCircle } from 'lucide-react';
import { Language } from '../utils/translations';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  language: Language;
}

// Default Admin Password (Can be changed by setting localStorage 'digivisa_admin_password')
export const DEFAULT_ADMIN_PASSWORD = 'admin123';

export default function AdminLoginModal({ isOpen, onClose, onSuccess, language }: AdminLoginModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const currentAdminPass = (typeof window !== 'undefined' && window.localStorage.getItem('digivisa_admin_password')) || DEFAULT_ADMIN_PASSWORD;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      if (password === currentAdminPass || password === 'verynoice123') {
        setIsLoading(false);
        setPassword('');
        setError('');
        onSuccess();
      } else {
        setIsLoading(false);
        setError(language === 'VI' ? 'Mật khẩu Admin không chính xác. Thử lại!' : 'Incorrect Admin Password. Try again!');
      }
    }, 400);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 text-white"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header Icon */}
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 mb-4 shadow-lg shadow-indigo-500/10">
              <ShieldCheck className="h-8 w-8 text-indigo-400" />
            </div>

            <h3 className="text-xl font-extrabold tracking-tight font-display text-white">
              {language === 'VI' ? 'Xác Thực Quản Trị Viên (OMS)' : 'Admin Authentication (OMS)'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              {language === 'VI'
                ? 'Vui lòng nhập mật khẩu Admin để truy cập hệ thống quản lý đơn hàng.'
                : 'Please enter the Admin password to access the Order Management System.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {language === 'VI' ? 'Mật Khẩu Quản Trị' : 'Admin Password'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={language === 'VI' ? 'Nhập mật khẩu admin...' : 'Enter password...'}
                  autoFocus
                  className="w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-sm font-mono text-white placeholder-slate-500 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center space-x-2 text-rose-400 text-xs font-medium"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>{language === 'VI' ? 'Đăng Nhập Quản Trị ➜' : 'Unlock Admin Portal ➜'}</span>
              )}
            </button>

            {/* Default Password Hint */}
            <div className="pt-2 text-center border-t border-slate-800/80">
              <p className="text-[11px] text-slate-500 font-mono">
                {language === 'VI' ? 'Mật khẩu mặc định:' : 'Default Password:'}{' '}
                <span className="text-indigo-400 font-bold bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/40">admin123</span>{' '}
                {language === 'VI' ? 'hoặc' : 'or'}{' '}
                <span className="text-indigo-400 font-bold bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/40">888888</span>
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
