'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  RotateCcw,
  Sparkles,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  provider?: 'email' | 'google';
  isVerified: boolean;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onAuthSuccess: (user: AuthUser, isNewUser?: boolean) => void;
  isMandatory?: boolean;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'VERIFY_OTP' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD' | 'GOOGLE_PROMPT';

export default function AuthModal({
  isOpen,
  onClose,
  onAuthSuccess,
  isMandatory = false,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);

  // Google specific prompt
  const [googleEmail, setGoogleEmail] = useState('minh.tuan@gmail.com');
  const [googleName, setGoogleName] = useState('Minh Tuấn');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);

  // Google Client ID
  const [googleClientId, setGoogleClientId] = useState<string>(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    '451917802570-bfkh9g6ft0k0uhi977s1oujihtquml05.apps.googleusercontent.com'
  );

  // OTP Countdown Timer
  useEffect(() => {
    let timer: any = null;
    if ((mode === 'VERIFY_OTP' || mode === 'RESET_PASSWORD') && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [mode, countdown]);

  useEffect(() => {
    fetch('/api/auth/google')
      .then((res) => res.json())
      .then((data) => {
        if (data.clientId) setGoogleClientId(data.clientId);
      })
      .catch(() => {});
  }, []);

  // Initialize Google One-Tap & OAuth SDK
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initGsi = () => {
      if ((window as any).google?.accounts?.id) {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: googleClientId,
            callback: async (response: any) => {
              if (response.credential) {
                try {
                  const base64Url = response.credential.split('.')[1];
                  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                  const jsonPayload = decodeURIComponent(
                    atob(base64)
                      .split('')
                      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                      .join('')
                  );
                  const payload = JSON.parse(jsonPayload);
                  if (payload.email) {
                    await handleConfirmGoogleAuth(
                      payload.email,
                      payload.name || 'Bệnh nhân',
                      payload.picture
                    );
                  }
                } catch (e) {
                  console.error('Failed to parse Google ID token:', e);
                }
              }
            },
          });
        } catch (e) {
          console.warn('GSI ID init error:', e);
        }
      }
    };

    initGsi();
    const t = setTimeout(initGsi, 800);
    return () => clearTimeout(t);
  }, [googleClientId]);

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

      try {
        confetti({
          particleCount: 75,
          spread: 65,
          origin: { y: 0.6 },
        });
      } catch {}

      const rawUser = data?.user || {};
      const safeFullName = typeof rawUser.fullName === 'string' && rawUser.fullName.trim()
        ? rawUser.fullName.trim()
        : (email.split('@')[0] || 'Bệnh nhân');

      onAuthSuccess({
        id: rawUser.id || `usr-${Date.now()}`,
        email: rawUser.email || email,
        fullName: safeFullName,
        provider: 'email',
        isVerified: true,
      });
      onClose?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Đăng nhập không thành công.');
    } finally {
      setIsLoading(false);
    }
  };

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
      setErrorMsg('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Đăng ký thất bại');
      }

      setGeneratedOtp(data.otpCode || null);
      setSuccessMsg(data.message || 'Mã xác thực 6 số đã được gửi tới email của bạn!');
      setMode('VERIFY_OTP');
      setCountdown(60);
    } catch (err: any) {
      setErrorMsg(err.message || 'Có lỗi xảy ra khi tạo tài khoản.');
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
        throw new Error(data.error || 'Mã xác thực không đúng hoặc đã hết hạn.');
      }

      try {
        confetti({
          particleCount: 85,
          spread: 75,
          origin: { y: 0.6 },
        });
      } catch {}

      const rawUser = data?.user || {};
      const safeFullName = typeof rawUser.fullName === 'string' && rawUser.fullName.trim()
        ? rawUser.fullName.trim()
        : (email.split('@')[0] || 'Bệnh nhân');

      onAuthSuccess({
        id: rawUser.id || `usr-${Date.now()}`,
        email: rawUser.email || email,
        fullName: safeFullName,
        provider: 'email',
        isVerified: true,
      }, true);
      onClose?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Xác thực OTP thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Vui lòng nhập địa chỉ email của bạn.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể gửi mã đặt lại mật khẩu.');
      }

      setGeneratedOtp(data.otpCode || null);
      setSuccessMsg(data.message || 'Mã xác thực 6 số đã được gửi tới email của bạn!');
      setOtp(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmNewPassword('');
      setMode('RESET_PASSWORD');
      setCountdown(60);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi gửi yêu cầu khôi phục mật khẩu.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const fullCode = otp.join('');
    if (fullCode.length < 6) {
      setErrorMsg('Vui lòng nhập đủ 6 chữ số mã xác thực.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: fullCode,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Đặt lại mật khẩu thất bại.');
      }

      try {
        confetti({
          particleCount: 85,
          spread: 75,
          origin: { y: 0.6 },
        });
      } catch {}

      const rawUser = data?.user || {};
      const safeFullName = typeof rawUser.fullName === 'string' && rawUser.fullName.trim()
        ? rawUser.fullName.trim()
        : (email.split('@')[0] || 'Bệnh nhân');

      onAuthSuccess({
        id: rawUser.id || `usr-${Date.now()}`,
        email: rawUser.email || email,
        fullName: safeFullName,
        provider: 'email',
        isVerified: true,
      }, false);
      onClose?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Đặt lại mật khẩu thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Execute Google Authentication with selected or entered Gmail
  const handleConfirmGoogleAuth = async (targetEmail: string, targetName: string, avatarUrl?: string) => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          fullName: targetName,
          avatarUrl: avatarUrl || '/images/knee-hero.png',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Xác thực Google thất bại');
      }

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}

      const rawUser = data?.user || {};
      const safeFullName = typeof rawUser.fullName === 'string' && rawUser.fullName.trim()
        ? rawUser.fullName.trim()
        : (targetName || targetEmail.split('@')[0] || 'Bệnh nhân Google');

      onAuthSuccess({
        id: rawUser.id || `usr-g-${Date.now()}`,
        email: rawUser.email || targetEmail,
        fullName: safeFullName,
        avatarUrl: rawUser.avatarUrl || avatarUrl,
        provider: 'google',
        isVerified: true,
      });
      onClose?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Đăng nhập Google thất bại, vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Launch official Google OAuth popup window
  const handleGoogleSignIn = () => {
    setErrorMsg(null);

    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      try {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'email profile openid',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              console.warn('Google OAuth error:', tokenResponse.error);
              setErrorMsg('Đăng nhập Google bị hủy hoặc gặp lỗi: ' + tokenResponse.error);
              return;
            }

            if (tokenResponse.access_token) {
              setIsLoading(true);
              try {
                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const gUser = await userInfoRes.json();

                if (!gUser.email) {
                  throw new Error('Không lấy được thông tin email từ tài khoản Google.');
                }

                await handleConfirmGoogleAuth(
                  gUser.email,
                  gUser.name || gUser.given_name || 'Bệnh nhân',
                  gUser.picture
                );
              } catch (err: any) {
                setErrorMsg(err.message || 'Lỗi khi đồng bộ tài khoản Google.');
              } finally {
                setIsLoading(false);
              }
            }
          },
        });

        // Opens official Google Sign-In popup!
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err: any) {
        console.warn('initTokenClient failed, fallback to manual prompt:', err);
      }
    }

    // Fallback if Google CDN is blocked or offline
    setMode('GOOGLE_PROMPT');
  };

  const handleOtpChange = (val: string, index: number) => {
    if (val.length > 1) {
      val = val[val.length - 1];
    }
    const updated = [...otp];
    updated[index] = val;
    setOtp(updated);

    if (val && index < 5) {
      const nextInput = document.getElementById(`auth-otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed sm:absolute inset-0 z-50 bg-[#0C0D11] text-white flex flex-col justify-between overflow-y-auto animate-fade-in font-sans">
      {/* Background Image: auth-bg.jpg with Glowing 3D Knee & Wave */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-25">
        <Image
          src="/images/auth-bg.jpg"
          alt="AXVYRA Medical Background"
          fill
          className="object-cover object-top"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0C0D11]/40 via-[#0C0D11]/80 to-[#0C0D11]" />
      </div>

      {/* Brand Header */}
      <div className="relative z-20 px-6 pt-6 pb-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </div>
            <span className="font-medium text-lg tracking-widest text-white">
              AXVYRA
            </span>
          </div>
          <p className="text-xs font-light text-slate-400 mt-0.5">
            Rebuild. Rise. Return.
          </p>
        </div>
      </div>

      {/* Main Floating Glass Form Container */}
      <div className="relative z-20 px-4 pt-6 pb-5 max-w-sm w-full mx-auto my-auto">
        <div className="bg-[#16181F] border border-white/[0.08] rounded-[32px] p-6 shadow-2xl space-y-4 text-white">
          {/* Card Title & Subtitle */}
          {mode === 'LOGIN' && (
            <div className="space-y-1">
              <h1 className="text-2xl font-light text-white tracking-tight leading-tight">
                Chào mừng bạn
                <br />
                đến với <span className="text-emerald-400 font-normal">AXVYRA</span>
              </h1>
              <p className="text-xs text-slate-400 font-light leading-relaxed pt-0.5">
                Đồng hành cùng bạn trên hành trình phục hồi và trở lại vận động.
              </p>
            </div>
          )}

          {mode === 'REGISTER' && (
            <div className="space-y-1">
              <h1 className="text-2xl font-light text-white tracking-tight leading-tight">
                Đăng ký tài khoản
                <br />
                <span className="text-emerald-400 font-normal">AXVYRA</span>
              </h1>
              <p className="text-xs text-slate-400 font-light leading-relaxed pt-0.5">
                Nhận phác đồ cá nhân hóa chuẩn y khoa cho dây chằng và sụn chêm.
              </p>
            </div>
          )}

          {mode === 'GOOGLE_PROMPT' && (
            <div className="space-y-1 text-center">
              <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
              <h1 className="text-xl font-light text-white leading-tight">
                Đăng nhập bằng Google
              </h1>
              <p className="text-xs text-slate-400 font-light">
                Xác thực tài khoản Google của bạn trên AXVYRA
              </p>
            </div>
          )}

          {mode === 'VERIFY_OTP' && (
            <div className="space-y-1 text-center">
              <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/10 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-light text-white leading-tight">
                Xác thực mã Email
              </h1>
              <p className="text-xs text-slate-400 font-light leading-relaxed">
                Nhập mã xác thực 6 số gửi tới <br />
                <strong className="text-white font-medium">{email}</strong>
              </p>
            </div>
          )}

          {mode === 'FORGOT_PASSWORD' && (
            <div className="space-y-1 text-center">
              <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/10 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-light text-white leading-tight">
                Khôi phục mật khẩu
              </h1>
              <p className="text-xs text-slate-400 font-light leading-relaxed">
                Nhập email của bạn để nhận mã xác thực đặt lại mật khẩu.
              </p>
            </div>
          )}

          {mode === 'RESET_PASSWORD' && (
            <div className="space-y-1 text-center">
              <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/10 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <Lock className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-light text-white leading-tight">
                Đặt lại mật khẩu mới
              </h1>
              <p className="text-xs text-slate-400 font-light leading-relaxed">
                Nhập mã 6 số gửi tới <strong className="text-white font-medium">{email}</strong> và mật khẩu mới.
              </p>
            </div>
          )}

          {/* Feedback alerts */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-light flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-light flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* MODE 1: LOGIN FORM */}
          {mode === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-3 pt-1">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-full py-3.5 pl-11 pr-4 text-xs font-normal text-white placeholder-slate-500 outline-none transition"
                />
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu"
                  className="w-full bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-full py-3.5 pl-11 pr-11 text-xs font-normal text-white placeholder-slate-500 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setMode('FORGOT_PASSWORD');
                  }}
                  className="text-[11px] font-light text-slate-400 hover:text-emerald-400 transition"
                >
                  Quên mật khẩu?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-full bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-950 font-medium text-xs shadow-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <span>{isLoading ? 'Đang xác thực...' : 'Đăng nhập'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* MODE 2: REGISTER FORM */}
          {mode === 'REGISTER' && (
            <form onSubmit={handleRegister} className="space-y-3 pt-1">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Họ và tên bệnh nhân"
                  className="w-full bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-full py-3 pl-11 pr-4 text-xs font-normal text-white placeholder-slate-500 outline-none transition"
                />
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-full py-3 pl-11 pr-4 text-xs font-normal text-white placeholder-slate-500 outline-none transition"
                />
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                  className="w-full bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-full py-3 pl-11 pr-11 text-xs font-normal text-white placeholder-slate-500 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Xác nhận mật khẩu"
                  className="w-full bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-full py-3 pl-11 pr-4 text-xs font-normal text-white placeholder-slate-500 outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-full bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-950 font-medium text-xs shadow-xl flex items-center justify-center gap-2 transition disabled:opacity-50 mt-1"
              >
                <span>{isLoading ? 'Đang gửi...' : 'Tiếp tục & Nhận mã OTP'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* MODE 3: GOOGLE AUTH CONFIRMATION PROMPT */}
          {mode === 'GOOGLE_PROMPT' && (
            <div className="space-y-3 pt-1 animate-fade-in">
              <div className="p-3.5 bg-white/[0.03] border border-white/[0.08] rounded-2xl space-y-2">
                <div className="space-y-1 text-left">
                  <label className="text-[11px] font-light text-slate-300 block">Địa chỉ Email Google của bạn:</label>
                  <input
                    type="email"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    placeholder="tenban@gmail.com"
                    className="w-full bg-[#16181F] border border-white/10 focus:border-white/30 rounded-xl py-2.5 px-3 text-xs font-normal text-white outline-none"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[11px] font-light text-slate-300 block">Tên hiển thị:</label>
                  <input
                    type="text"
                    value={googleName}
                    onChange={(e) => setGoogleName(e.target.value)}
                    placeholder="Minh Tuấn"
                    className="w-full bg-[#16181F] border border-white/10 focus:border-white/30 rounded-xl py-2.5 px-3 text-xs font-normal text-white outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleConfirmGoogleAuth(googleEmail, googleName)}
                disabled={isLoading}
                className="w-full py-3.5 rounded-full bg-white hover:bg-slate-100 text-slate-950 font-medium text-xs shadow-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isLoading ? 'Đang kết nối Google...' : 'Xác thực & Vào ứng dụng'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('LOGIN')}
                className="w-full text-center text-[11px] font-light text-slate-400 hover:text-white"
              >
                Quay lại đăng nhập thông thường
              </button>
            </div>
          )}

          {/* MODE 4: 6-DIGIT OTP VERIFICATION */}
          {mode === 'VERIFY_OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 pt-1 animate-fade-in text-center">
              {generatedOtp && (
                <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-light flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Chế độ thử nghiệm: <strong className="text-base font-medium tracking-widest text-amber-200">{generatedOtp}</strong>
                  </span>
                </div>
              )}

              <div className="flex justify-center gap-2 pt-1">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`auth-otp-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, idx)}
                    className="w-10 h-12 text-center text-lg font-light bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-2xl outline-none text-white transition"
                    autoFocus={idx === 0}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-400 text-[11px] font-light">
                  {countdown > 0 ? `Gửi lại sau ${countdown}s` : 'Chưa nhận được mã?'}
                </span>
                <button
                  type="button"
                  disabled={countdown > 0 || isLoading}
                  onClick={async () => {
                    setIsLoading(true);
                    setErrorMsg(null);
                    try {
                      const res = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fullName, email, password }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Gửi lại mã thất bại');
                      setGeneratedOtp(data.otpCode || null);
                      setCountdown(60);
                      setSuccessMsg('Đã gửi lại mã xác thực mới vào email của bạn!');
                    } catch (err: any) {
                      setErrorMsg(err.message || 'Không thể gửi lại mã xác thực.');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="font-medium text-emerald-400 disabled:opacity-40 text-[11px]"
                >
                  Gửi lại mã
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-full bg-white hover:bg-slate-100 text-slate-950 font-medium text-xs shadow-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isLoading ? 'Đang kiểm tra...' : 'Xác thực & Bắt đầu'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('REGISTER')}
                className="text-[11px] font-light text-slate-400 hover:text-white"
              >
                Đổi lại thông tin đăng ký
              </button>
            </form>
          )}

          {/* MODE 5: FORGOT PASSWORD REQUEST FORM */}
          {mode === 'FORGOT_PASSWORD' && (
            <form onSubmit={handleForgotPassword} className="space-y-3.5 pt-1 animate-fade-in">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email đăng ký của bạn"
                  className="w-full bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-full py-3.5 pl-11 pr-4 text-xs font-normal text-white placeholder-slate-500 outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-full bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-950 font-medium text-xs shadow-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <span>{isLoading ? 'Đang gửi mã...' : 'Gửi mã xác thực'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMode('LOGIN');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white transition"
                >
                  ← Quay lại Đăng nhập
                </button>
              </div>
            </form>
          )}

          {/* MODE 6: RESET PASSWORD WITH OTP */}
          {mode === 'RESET_PASSWORD' && (
            <form onSubmit={handleResetPassword} className="space-y-3.5 pt-1 animate-fade-in">
              {generatedOtp && (
                <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-light flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Chế độ thử nghiệm: <strong className="text-base font-medium tracking-widest text-amber-200">{generatedOtp}</strong>
                  </span>
                </div>
              )}

              <div className="flex justify-center gap-2 pt-1">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`auth-reset-otp-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val.length > 1) val = val[val.length - 1];
                      const updated = [...otp];
                      updated[idx] = val;
                      setOtp(updated);
                      if (val && idx < 5) {
                        const nextInput = document.getElementById(`auth-reset-otp-${idx + 1}`);
                        nextInput?.focus();
                      }
                    }}
                    className="w-10 h-12 text-center text-lg font-light bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-2xl outline-none text-white transition"
                    autoFocus={idx === 0}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-400 text-[11px] font-light">
                  {countdown > 0 ? `Gửi lại sau ${countdown}s` : 'Chưa nhận được mã?'}
                </span>
                <button
                  type="button"
                  disabled={countdown > 0 || isLoading}
                  onClick={handleForgotPassword}
                  className="font-medium text-emerald-400 disabled:opacity-40 text-[11px]"
                >
                  Gửi lại mã
                </button>
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                  className="w-full bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-full py-3 pl-11 pr-11 text-xs font-normal text-white placeholder-slate-500 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Xác nhận mật khẩu mới"
                  className="w-full bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-full py-3 pl-11 pr-4 text-xs font-normal text-white placeholder-slate-500 outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-full bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-950 font-medium text-xs shadow-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isLoading ? 'Đang cập nhật...' : 'Xác nhận & Đăng nhập ngay'}</span>
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('LOGIN');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white transition"
                >
                  ← Quay lại Đăng nhập
                </button>
              </div>
            </form>
          )}

          {/* GOOGLE ONLY SOCIAL LOGIN (APPLE REMOVED) */}
          {mode !== 'VERIFY_OTP' && mode !== 'GOOGLE_PROMPT' && mode !== 'FORGOT_PASSWORD' && mode !== 'RESET_PASSWORD' && (
            <div className="space-y-3 pt-1">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.08]" />
                </div>
                <span className="relative bg-[#16181F] px-3 text-[11px] text-slate-400 font-light">
                  Hoặc tiếp tục với
                </span>
              </div>

              {/* Full Width Google Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-full bg-white/[0.06] hover:bg-white/10 active:scale-[0.98] border border-white/10 shadow-lg flex items-center justify-center gap-2.5 text-xs font-medium text-white transition"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Đăng nhập bằng Google</span>
              </button>

              {/* Bottom Switcher */}
              <div className="text-center pt-1.5">
                {mode === 'LOGIN' ? (
                  <p className="text-xs text-slate-400 font-light">
                    Bạn chưa có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('REGISTER');
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="font-medium text-emerald-400 hover:text-emerald-300 ml-1"
                    >
                      Đăng ký ngay
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 font-light">
                    Đã có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('LOGIN');
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="font-medium text-emerald-400 hover:text-emerald-300 ml-1"
                    >
                      Đăng nhập ngay
                    </button>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
