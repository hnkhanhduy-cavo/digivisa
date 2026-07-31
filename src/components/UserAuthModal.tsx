import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Mail, X, AlertCircle, LogIn, UserPlus, CheckCircle, AlertTriangle } from 'lucide-react';
import { Language } from '../utils/translations';
import { registerUser, loginUser } from '../utils/firebase';

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userData: { uid: string; email: string | null; displayName?: string | null }) => void;
  language: Language;
}

export default function UserAuthModal({ isOpen, onClose, onSuccess, language }: UserAuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerificationNotice(null);

    if (!email.trim() || !password.trim()) {
      setError(language === 'VI' ? 'Vui lòng điền đầy đủ Email và Mật khẩu.' : 'Please fill in Email and Password.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError(language === 'VI' ? 'Mật khẩu xác nhận không trùng khớp.' : 'Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError(language === 'VI' ? 'Mật khẩu phải có ít nhất 6 ký tự.' : 'Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    if (mode === 'register') {
      const res = await registerUser(email.trim(), password);
      setIsLoading(false);
      if (res.error) {
        setError(res.error);
      } else if (res.user) {
        if (res.verificationSent) {
          setVerificationNotice(
            language === 'VI'
              ? `📧 Đã tạo tài khoản thành công! Đã gửi liên kết kích hoạt tới ${email.trim()}. Vui lòng mở Hòm thư Email (Inbox/Spam) nhấp vào liên kết để kích hoạt trước khi Đăng nhập.`
              : `📧 Account created! Activation link sent to ${email.trim()}. Please check your email inbox/spam and click the activation link before signing in.`
          );
          setMode('login');
          setPassword('');
          setConfirmPassword('');
        } else {
          onSuccess({
            uid: res.user.uid,
            email: res.user.email,
            displayName: res.user.displayName || email.split('@')[0]
          });
        }
      }
    } else {
      const res = await loginUser(email.trim(), password);
      setIsLoading(false);
      if (res.unverified) {
        setError(
          language === 'VI'
            ? `⚠️ Tài khoản CHƯA ĐƯỢC KÍCH HOẠT! Vui lòng vào Hòm thư Email (${email.trim()}) nhấp vào liên kết kích hoạt. Chúng tôi vừa gửi lại mail xác nhận cho bạn.`
            : `⚠️ Account NOT ACTIVATED! Please check your email (${email.trim()}) inbox/spam and click the activation link. We have resent the email for you.`
        );
      } else if (res.error) {
        setError(language === 'VI' ? 'Email hoặc mật khẩu không chính xác.' : 'Incorrect email or password.');
      } else if (res.user) {
        onSuccess({
          uid: res.user.uid,
          email: res.user.email,
          displayName: res.user.displayName || email.split('@')[0]
        });
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 text-slate-800"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
              {mode === 'login' ? <LogIn className="h-7 w-7" /> : <UserPlus className="h-7 w-7" />}
            </div>

            <h3 className="text-xl font-extrabold tracking-tight font-display text-slate-900">
              {mode === 'login' 
                ? (language === 'VI' ? 'Đăng Nhập Tài Khoản' : 'Account Sign In')
                : (language === 'VI' ? 'Tạo Tài Khoản Mới' : 'Create New Account')}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              {language === 'VI' 
                ? 'Đăng nhập bằng Email để bảo mật và quản lý danh sách đơn hàng cá nhân.' 
                : 'Sign in with your activated email to manage personal visa applications.'}
            </p>
          </div>

          {/* Mode Tabs (Login / Register) */}
          <div className="flex bg-slate-100 p-1 rounded-xl mt-5 border border-slate-200">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setVerificationNotice(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'login' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {language === 'VI' ? 'Đăng Nhập' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); setVerificationNotice(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'register' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {language === 'VI' ? 'Đăng Ký Mới' : 'Register'}
            </button>
          </div>

          {/* Verification Notice Banner */}
          {verificationNotice && (
            <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start space-x-2.5">
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">{language === 'VI' ? 'Gửi Email Kích Hoạt Thành Công!' : 'Activation Email Sent!'}</span>
                <span className="text-[11px] leading-relaxed block">{verificationNotice}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            {/* Email Field */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                {language === 'VI' ? 'Địa chỉ Email *' : 'Email Address *'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@domain.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl text-sm text-slate-900 placeholder-slate-400 transition-all outline-none"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                {language === 'VI' ? 'Mật khẩu *' : 'Password *'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl text-sm text-slate-900 placeholder-slate-400 transition-all outline-none"
                />
              </div>
            </div>

            {/* Confirm Password Field (Register Mode Only) */}
            {mode === 'register' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  {language === 'VI' ? 'Xác nhận Mật khẩu *' : 'Confirm Password *'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl text-sm text-slate-900 placeholder-slate-400 transition-all outline-none"
                  />
                </div>
              </motion.div>
            )}

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-700 text-xs font-medium"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </motion.div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>
                  {mode === 'login' 
                    ? (language === 'VI' ? 'Đăng Nhập ➜' : 'Sign In ➜') 
                    : (language === 'VI' ? 'Đăng Ký & Nhận Mail Kích Hoạt ➜' : 'Register & Send Activation Mail ➜')}
                </span>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
