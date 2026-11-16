'use client';

import React, { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  KeyRound,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  isVerified: boolean;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onAuthSuccess: (user: AuthUser) => void;
  isMandatory?: boolean;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'VERIFY_OTP';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, isMandatory = false }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);

  // OTP Countdown Timer
  useEffect(() => {
    let timer: any = null;
    if (mode === 'VERIFY_OTP' && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [mode, countdown]);

  if (!isOpen) return null;

  // Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setErrorMsg('Vui lòng điền đầy đủ tất cả các trường.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsLoading(true);

    try {
      // Call Auth Register API
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Đăng ký thất bại');
      }

      setGeneratedOtp(data.otpCode || '123456');
      setSuccessMsg('Mã xác thực 6 số đã được tạo thành công!');
      setMode('VERIFY_OTP');
      setCountdown(60);
    } catch (err: any) {
      setErrorMsg(err.message || 'Có lỗi xảy ra khi tạo tài khoản.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Vui lòng nhập email và mật khẩu.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Sai email hoặc mật khẩu');
      }

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });

      onAuthSuccess(data.user);
      onClose?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Đăng nhập không thành công.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const fullCode = otp.join('');
    if (fullCode.length < 6) {
      setErrorMsg('Vui lòng nhập đủ 6 chữ số mã xác thực.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: fullCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Mã xác thực không hợp lệ hoặc đã hết hạn.');
      }

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      onAuthSuccess(data.user);
      onClose?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Xác thực OTP thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP Box Input Change
  const handleOtpChange = (val: string, index: number) => {
    if (val.length > 1) {
      val = val[val.length - 1];
    }
    const updated = [...otp];
    updated[index] = val;
    setOtp(updated);

    // Auto-focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password }),
      });
      const data = await res.json();
      setGeneratedOtp(data.otpCode || '123456');
      setCountdown(60);
      setSuccessMsg('Đã gửi lại mã xác thực mới!');
    } catch {
      setErrorMsg('Không thể gửi lại mã, vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed sm:absolute inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 animate-fade-in font-sans">
      <div className="bg-white rounded-[2.2rem] border border-slate-100 shadow-2xl w-full max-w-sm p-5 sm:p-6 space-y-4 text-slate-800 relative">
        {/* Close Button (Hidden if mandatory) */}
        {!isMandatory && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Brand Header */}
        <div className="flex items-center gap-2 pt-1">
          <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center border border-emerald-500/30">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-black text-sm tracking-wide text-slate-900">AXVYRA</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                Security
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Tài khoản phục hồi cá nhân</p>
          </div>
        </div>

        {/* Mode Switcher (Login vs Register) */}
        {mode !== 'VERIFY_OTP' && (
          <div className="grid grid-cols-2 p-1 bg-slate-100/80 rounded-2xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode('LOGIN');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-xl transition ${
                mode === 'LOGIN'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('REGISTER');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-xl transition ${
                mode === 'REGISTER'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Đăng ký mới
            </button>
          </div>
        )}

        {/* Alerts */}
        {errorMsg && (
          <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* FORM 1: LOGIN */}
        {mode === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">Email:</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl p-3 pl-10 text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none transition"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">Mật khẩu:</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl p-3 pl-10 text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none transition"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-2xl text-xs transition shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Đang xác thực...' : 'Đăng Nhập'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* FORM 2: REGISTER */}
        {mode === 'REGISTER' && (
          <form onSubmit={handleRegister} className="space-y-2.5 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">Họ và tên bệnh nhân:</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl p-2.5 pl-10 text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none transition"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">Email đăng ký:</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl p-2.5 pl-10 text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none transition"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">Mật khẩu (ít nhất 6 ký tự):</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl p-2.5 pl-10 text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none transition"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">Xác nhận mật khẩu:</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl p-2.5 pl-10 text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none transition"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-2xl text-xs transition shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Đang gửi...' : 'Tiếp tục & Nhận mã qua Email'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* FORM 3: VERIFY OTP CODE */}
        {mode === 'VERIFY_OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 pt-1 animate-fade-in text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <KeyRound className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-900">Xác Thực Mã Email</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Chúng tôi đã gửi mã xác thực gồm 6 chữ số đến email: <br />
                <strong className="text-slate-800 font-bold">{email}</strong>
              </p>
            </div>

            {/* Test Simulation Badge */}
            {generatedOtp && (
              <div className="p-2.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-semibold flex items-center justify-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Mã xác thực của bạn: <strong className="text-base font-black tracking-widest text-sky-700">{generatedOtp}</strong></span>
              </div>
            )}

            {/* 6 Digit OTP Inputs */}
            <div className="flex justify-center gap-2 pt-1">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-input-${idx}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(e.target.value, idx)}
                  className="w-11 h-12 text-center text-lg font-black bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl outline-none transition"
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <span className="text-slate-400 text-[11px]">
                {countdown > 0 ? `Gửi lại mã sau ${countdown}s` : 'Chưa nhận được mã?'}
              </span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={countdown > 0 || isLoading}
                className="font-bold text-emerald-600 hover:text-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-[11px]"
              >
                Gửi lại mã
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-2xl text-xs transition shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isLoading ? 'Đang kiểm tra...' : 'Xác Nhận & Hoàn Tất'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('REGISTER')}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-600"
            >
              Đổi lại thông tin đăng ký
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
