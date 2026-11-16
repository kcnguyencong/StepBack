'use client';

import React, { useState } from 'react';
import { CheckCircle2, Heart, Award, X, MessageSquare, AlertCircle } from 'lucide-react';
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
    <div className="fixed sm:absolute inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl w-full max-w-sm p-5 space-y-4 text-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Đánh Giá Buổi Tập</h3>
              <p className="text-[10px] text-slate-500 line-clamp-1">{sessionTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* RPE Scale (1-10) */}
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 text-[11px]">
                Mức độ gắng sức (RPE 1-10):
              </span>
              <span className="font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg text-[11px]">
                {rpeScore} - {getRpeLabel(rpeScore)}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={rpeScore}
              onChange={(e) => setRpeScore(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          {/* Pain Scale during session (1-10) */}
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 text-[11px]">
                Đau trong lúc tập (VAS 1-10):
              </span>
              <span
                className={`font-black px-2 py-0.5 rounded-lg text-[11px] ${
                  painDuringSession <= 3
                    ? 'bg-emerald-100 text-emerald-700'
                    : painDuringSession <= 6
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-700'
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
              className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          {/* Patient notes */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 text-[11px] block">
              Ghi chú cảm giác / Bất thường:
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ví dụ: Cơ đùi gồng tốt, hơi căng nhẹ vùng bánh chè khi duỗi..."
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Lưu Kết Quả & Hoàn Tất
          </button>
        </form>
      </div>
    </div>
  );
}
