'use client';

import React, { useState } from 'react';
import { CheckCircle2, Award, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface SessionFeedbackModalProps {
  isOpen: boolean;
  sessionTitle: string;
  onSaveFeedback: (feedback: {
    rpeScore: number;
    painDuringSession: number;
    notes: string;
  }) => void;
  onClose: () => void;
}

export default function SessionFeedbackModal({
  isOpen,
  sessionTitle,
  onSaveFeedback,
  onClose,
}: SessionFeedbackModalProps) {
  const [rpeScore, setRpeScore] = useState<number>(5);
  const [painDuringSession, setPainDuringSession] = useState<number>(2);
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 },
    });
    onSaveFeedback({
      rpeScore,
      painDuringSession,
      notes,
    });
  };

  const getRpeLabel = (val: number) => {
    if (val <= 2) return 'Rất nhẹ nhàng';
    if (val <= 4) return 'Vừa sức / Dễ chịu';
    if (val <= 6) return 'Hơi nặng / Bắt đầu mỏi';
    if (val <= 8) return 'Nặng / Thử thách cơ';
    return 'Cực kỳ gắng sức';
  };

  return (
    <div className="fixed sm:absolute inset-0 z-50 bg-[#0C0D11]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-[#16181F] border border-white/[0.08] rounded-[32px] shadow-2xl w-full max-w-sm p-6 space-y-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10 text-emerald-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-light text-white tracking-tight">Đánh Giá Buổi Tập</h3>
              <p className="text-[11px] text-slate-400 font-light line-clamp-1">{sessionTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* RPE Scale (1-10) */}
          <div className="space-y-2 bg-white/[0.03] p-3.5 rounded-2xl border border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="font-light text-slate-300 text-[11px]">
                Mức độ gắng sức (RPE 1-10):
              </span>
              <span className="font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[10px]">
                {rpeScore} - {getRpeLabel(rpeScore)}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={rpeScore}
              onChange={(e) => setRpeScore(parseInt(e.target.value, 10))}
              className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
            />
          </div>

          {/* Pain Scale during session (1-10) */}
          <div className="space-y-2 bg-white/[0.03] p-3.5 rounded-2xl border border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="font-light text-slate-300 text-[11px]">
                Đau trong lúc tập (VAS 1-10):
              </span>
              <span
                className={`font-medium px-2.5 py-0.5 rounded-full text-[10px] ${
                  painDuringSession <= 3
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : painDuringSession <= 6
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                }`}
              >
                {painDuringSession}/10
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={painDuringSession}
              onChange={(e) => setPainDuringSession(parseInt(e.target.value, 10))}
              className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
            />
          </div>

          {/* Patient notes */}
          <div className="space-y-1.5">
            <label className="font-light text-slate-300 text-[11px] block">
              Ghi chú cảm giác / Bất thường:
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ví dụ: Cơ đùi gồng tốt, hơi căng nhẹ vùng bánh chè khi duỗi..."
              rows={2}
              className="w-full bg-white/[0.04] border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-950 font-medium rounded-full text-xs transition shadow-xl flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Lưu Kết Quả & Hoàn Tất
          </button>
        </form>
      </div>
    </div>
  );
}