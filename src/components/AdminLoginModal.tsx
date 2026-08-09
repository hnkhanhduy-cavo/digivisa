import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Lock, Eye, EyeOff, X, AlertCircle, Mail } from 'lucide-react';
import { Language } from '../utils/translations';
import { auth, loginUser, logoutUser } from '../utils/firebase';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  language: Language;
}

export default function AdminLoginModal({ isOpen, onClose, onSuccess, language }: AdminLoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await loginUser(email.trim(), password);
      if (result.error || !result.user) {
        setError(
          result.unverified
            ? (language === 'VI' ? 'Email chưa được xác minh.' : 'Email not verified.')
            : (language === 'VI' ? 'Đăng nhập thất bại. Kiểm tra email/mật khẩu.' : 'Login failed. Check email/password.')
        );
        setIsLoading(false);
        return;
      }

      // Force-refresh token so custom claims are current
      const tokenResult = await result.user.getIdTokenResult(true);
      if (tokenResult.claims.staff !== true) {
        await logoutUser();
        setError(
          language === 'VI'
            ? 'Tài khoản không có quyền staff. Liên hệ ops để gắn claim staff:true.'
            : 'Account has no staff claim. Ask ops to set custom claim staff:true.'
        );
        setIsLoading(false);
        return;
      }

      // Ensure auth.currentUser is the staff session for subsequent Firestore reads
      if (!auth.currentUser) {
        setError(language === 'VI' ? 'Phiên đăng nhập không hợp lệ.' : 'Invalid auth session.');
        setIsLoading(false);
        return;
      }

      setPassword('');
      setError('');
      setIsLoading(false);
      onSuccess();
    } catch (err: any) {
      setIsLoading(false);
      setError(err?.message || (language === 'VI' ? 'Lỗi đăng nhập.' : 'Login error.'));
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-x-hidden max-h-[90dvh] overflow-y-auto p-6 sm:p-8 text-white"
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 mb-4 shadow-lg shadow-indigo-500/10">
              <ShieldCheck className="h-8 w-8 text-indigo-400" />
            </div>

            <h3 className="text-xl font-extrabold tracking-tight font-display text-white">
              {language === 'VI' ? 'Đăng Nhập Staff (OMS)' : 'Staff Sign-In (OMS)'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              {language === 'VI'
                ? 'Đăng nhập Firebase với tài khoản có custom claim staff:true.'
                : 'Sign in with a Firebase account that has custom claim staff:true.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@digivisa.example"
                  autoFocus
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-base sm:text-sm font-mono text-white placeholder-slate-500 transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {language === 'VI' ? 'Mật khẩu' : 'Password'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={language === 'VI' ? 'Mật khẩu Firebase...' : 'Firebase password...'}
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-base sm:text-sm font-mono text-white placeholder-slate-500 transition-all outline-none"
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

            <button
              type="submit"
              disabled={isLoading || !email.trim() || !password.trim()}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>{language === 'VI' ? 'Xác thực Staff ➜' : 'Verify Staff Access ➜'}</span>
              )}
            </button>

            <div className="pt-2 text-center border-t border-slate-800/80">
              <p className="text-[11px] text-slate-500">
                {language === 'VI'
                  ? 'Claim gắn qua POST /api/staff-set-claim (header X-Sync-Secret).'
                  : 'Claim is set via POST /api/staff-set-claim (X-Sync-Secret header).'}
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
