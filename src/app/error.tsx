'use client';

import React, { useEffect } from 'react';
import { RotateCcw, AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('AXVYRA Client-Side Error Boundary caught:', error);
  }, [error]);

  const handleHardReset = () => {
    try {
      localStorage.removeItem('axvyra_v1_case');
      localStorage.removeItem('axvyra_auth_user');
      localStorage.removeItem('ageGroup');
      localStorage.removeItem('surgeryDate');
      localStorage.removeItem('surgeryType');
      localStorage.removeItem('operatedLeg');
    } catch {}
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#F2F7F9] text-slate-800 flex flex-col justify-center items-center p-5 select-none font-sans">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl border border-slate-100 text-center space-y-4">
        {/* Warning Icon */}
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-xs">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-black text-slate-900">
            Đã có sự cố hiển thị nhỏ
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Hệ thống phát hiện lỗi trạng thái hoặc bộ nhớ cache tạm thời không khớp. Dữ liệu phục hồi của bạn luôn được bảo vệ an toàn.
          </p>
        </div>

        {error?.message && (
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Chi tiết kỹ thuật
            </span>
            <p className="text-[11px] font-mono text-rose-600 break-words leading-tight line-clamp-3">
              {error.message}
            </p>
          </div>
        )}

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full py-3 px-4 rounded-full bg-gradient-to-r from-[#4ade80] via-[#22c55e] to-[#0d9488] text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Thử tải lại màn hình</span>
          </button>

          <button
            type="button"
            onClick={handleHardReset}
            className="w-full py-2.5 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Xóa cache & Đăng nhập lại</span>
          </button>
        </div>
      </div>
    </div>
  );
}
