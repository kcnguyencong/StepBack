'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Check,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Award,
  Lock,
  Sparkles,
  Calendar,
  Compass,
  ArrowRight
} from 'lucide-react';
import { SurgeryType, SURGERY_DETAILS, PHASE_RULES } from '@/data/rehabProtocols';

interface RoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDay: number;
  currentWeek: number;
  currentPhase: number;
  surgeryDateStr: string;
  surgeryType: SurgeryType;
}

interface RoadmapStageData {
  id: number;
  shortLabel: string;
  title: string;
  weekRangeText: string;
  startDay: number;
  endDay: number;
  durationText: string;
  focus: string;
  maxFlexion: string;
  weightBearing: string;
  braceRule: string;
  criteria: string[];
  redFlags?: string[];
}

export default function RoadmapModal({
  isOpen,
  onClose,
  currentDay,
  currentWeek,
  currentPhase,
  surgeryDateStr,
  surgeryType,
}: RoadmapModalProps) {
  const [selectedPhaseId, setSelectedPhaseId] = useState<number>(currentPhase || 1);

  // Helper to format date
  const formatDate = (date: Date) => {
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  const baseSurgeryDate = useMemo(() => {
    const d = new Date(surgeryDateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [surgeryDateStr]);

  const surgeryDetails = SURGERY_DETAILS[surgeryType] || SURGERY_DETAILS.ACL_MENISCUS_REPAIR;

  // 5 Clinical Recovery Stages
  const stages: RoadmapStageData[] = useMemo(() => {
    const isMeniscus = surgeryType === 'ACL_MENISCUS_REPAIR';

    return [
      {
        id: 1,
        shortLabel: 'Hậu phẫu',
        title: 'Giai đoạn 1: Kiểm soát sưng đau & Đánh thức cơ đùi',
        weekRangeText: 'Tuần 1 – 2',
        startDay: 1,
        endDay: 14,
        durationText: '14 ngày đầu',
        focus: 'Phục hồi duỗi thẳng gối 0° khẩn cấp, kích hoạt cơ tứ đầu đùi và kiểm soát dịch phù nề.',
        maxFlexion: '≤ 90° (tuyệt đối không gập sâu quá 90°)',
        weightBearing: isMeniscus
          ? 'Không tì lực (NWB) • Đi 2 nạng hoàn toàn'
          : 'Chống chân chịu lực 1 phần có 2 nạng (PWB)',
        braceRule: 'Khóa nẹp thẳng 0° liên tục 24/24 (chỉ tháo khi tập gập gối thụ động)',
        criteria: [
          'Gối duỗi thẳng hoàn toàn 0° chạm mặt phẳng (không ép lực)',
          'Nâng chân thẳng có nẹp (SLR) 10 lần liên tục không rớt gối',
          'Gập gối chủ động đạt 70° – 90° êm ái không đau nhói',
          'Vết mổ khô ráo, dịch khớp gối giảm rõ rệt',
        ],
        redFlags: [
          'Sốt > 38°C, vết mổ sưng nóng đỏ hoặc rỉ dịch đục',
          'Bắp chân căng tức dữ dội khi gập cổ chân (nghi ngờ huyết khối)',
        ],
      },
      {
        id: 2,
        shortLabel: 'Bỏ nạng',
        title: 'Giai đoạn 2: Phục hồi biên độ vận động & Tập bỏ nạng',
        weekRangeText: 'Tuần 3 – 6',
        startDay: 15,
        endDay: 42,
        durationText: '4 tuần tiếp theo',
        focus: 'Mở rộng biên độ gập gối an toàn, tái lập dáng đi tự nhiên và chuyển đổi bỏ dần 2 nạng.',
        maxFlexion: isMeniscus ? 'Giữ ≤ 90° đến hết tuần 6' : 'Tăng dần lên 120° – 125°',
        weightBearing: isMeniscus
          ? 'Tuần 3-4: Đi 2 nạng không tì; Tuần 5-6: Chạm mũi chân nhẹ (Toe-touch)'
          : 'Tăng dần trọng lực, bỏ dần 1 nạng rồi bỏ nạng hoàn toàn',
        braceRule: isMeniscus
          ? 'Khóa thẳng 0° khi đi lại; mở khóa 0°–90° khi ngồi tập'
          : 'Mở khóa nẹp 0°–90°; có thể bỏ nẹp sau tuần 4 nếu cơ đùi khỏe',
        criteria: [
          'Duy trì duỗi thẳng 0° bền vững mỗi sáng thức dậy',
          isMeniscus ? 'Gập gối đạt 90° trơn tru không căng tức mối khâu' : 'Gập gối đạt 120°+',
          'Dáng đi tự nhiên hai chân cân đối không khập khiễng',
          'Cơ tứ đầu đùi co siết rõ rệt khi đứng trụ',
        ],
        redFlags: [
          'Tiếng kẹt "khục" cơ học ở khe khớp khi gập duỗi',
          'Đau nhói tại vị trí khâu sụn chêm khi chống chân',
        ],
      },
      {
        id: 3,
        shortLabel: 'Sức mạnh',
        title: 'Giai đoạn 3: Tăng cường sức mạnh cơ bắp & Thăng bằng',
        weekRangeText: 'Tuần 7 – 12',
        startDay: 43,
        endDay: 84,
        durationText: '6 tuần kế tiếp',
        focus: 'Tăng cường sức mạnh cơ đùi (Quadriceps) & cơ gân kheo (Hamstrings), phục hồi phản xạ thăng bằng.',
        maxFlexion: '130° – 135° (tiệm cận biên độ chân lành)',
        weightBearing: 'Chịu lực hoàn toàn (FWB) • Bỏ nạng hoàn toàn',
        braceRule: 'Bỏ nẹp hoàn toàn trong mọi sinh hoạt hàng ngày',
        criteria: [
          'Gập gối đạt 130°+ tương đương với chân lành',
          'Đứng thăng bằng 1 chân mổ vững vàng 30 giây không chao đảo',
          'Bước lên và bước xuống bục cao 15cm có kiểm soát trục gối',
          'Đi bộ nhanh 30 phút liên tục không sưng phù dịch',
        ],
        redFlags: [
          'Khớp gối có cảm giác trượt lỏng (Giving way) khi đổi hướng nhẹ',
          'Viêm gân bánh chè đau buốt trước gối kéo dài',
        ],
      },
      {
        id: 4,
        shortLabel: 'Chạy bộ',
        title: 'Giai đoạn 4: Phục hồi sức bền & Chạy bộ đường thẳng',
        weekRangeText: 'Tuần 13 – 24',
        startDay: 85,
        endDay: 168,
        durationText: '3 tháng tiếp theo',
        focus: 'Tái lập sức bền cơ bắp, bắt đầu chạy bộ đường thẳng (Jogging) và bài tập tiếp đất kiểm soát trục chân.',
        maxFlexion: 'Toàn bộ biên độ sinh lý (140° – 145°)',
        weightBearing: 'Hoạt động cường độ trung bình • Chạy bộ đường phẳng',
        braceRule: 'Không đeo nẹp (có thể đeo băng gối thể thao hỗ trợ)',
        criteria: [
          'Sức mạnh cơ đùi đạt ít nhất 85% so với chân lành',
          'Chạy bộ đường thẳng 15–20 phút nhịp độ nhẹ không đau, không sưng',
          'Thực hiện bài nhảy tiếp đất 2 chân không bị chụm gối vào trong (Knee valgus)',
        ],
        redFlags: [
          'Khớp gối tái tràn dịch sau mỗi lần chạy bộ',
          'Đau nhức cơ học kéo dài quá 24h sau buổi tập',
        ],
      },
      {
        id: 5,
        shortLabel: 'Thể thao',
        title: 'Giai đoạn 5: Tập đổi hướng nhanh & Trở lại thể thao đỉnh cao',
        weekRangeText: 'Tháng 6 – 9+',
        startDay: 169,
        endDay: 280,
        durationText: 'Sau 6 tháng mổ',
        focus: 'Tập đổi hướng cắt kéo (Agility), bật nhảy xoay người và vượt qua bài test Trở lại Thể thao (RTS).',
        maxFlexion: '100% tự nhiên như chân lành',
        weightBearing: 'Vận động thể thao không giới hạn sau khi qua test RTS',
        braceRule: 'Tự do hoàn toàn (tùy nhu cầu thi đấu)',
        criteria: [
          'Chỉ số LSI (Limb Symmetry Index) đạt ≥ 90% ở các bài nhảy lò cò (Hop Tests)',
          'Đạt điểm đánh giá tâm lý tự tin ACL-RSI ≥ 75 điểm (không sợ tái phát)',
          'Bác sĩ phẫu thuật & Chuyên gia VLTL kiểm tra khớp và ký duyệt RTS',
        ],
        redFlags: [
          'Cảm giác bất an hoặc gối mất vững khi bật nhảy tiếp đất',
        ],
      },
    ];
  }, [surgeryType]);

  // Overall calculations
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentDay / 168) * 100)));

  if (!isOpen) return null;

  const activeStage = stages.find((s) => s.id === selectedPhaseId) || stages[0];

  // Calculate calendar dates for the active stage
  const stageStartDate = new Date(baseSurgeryDate.getTime() + (activeStage.startDay - 1) * 86400000);
  const stageEndDate = new Date(baseSurgeryDate.getTime() + (activeStage.endDay - 1) * 86400000);

  return (
    <div className="fixed inset-0 z-50 bg-[#0C0D11]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in font-sans">
      <div className="bg-[#16181F] border border-white/[0.08] rounded-[32px] shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col text-white overflow-hidden">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-light text-white tracking-tight">
                  Lộ Trình Phục Hồi Lâm Sàng
                </h3>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  16–24 tuần
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-light truncate max-w-[260px] sm:max-w-none">
                {surgeryDetails.shortLabel} • Ngày mổ: {formatDate(baseSurgeryDate)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* Timeline Overall Banner */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-light flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Vị trí hiện tại của bạn:</span>
                <strong className="text-white font-medium">Ngày {currentDay} sau mổ (Tuần {currentWeek})</strong>
              </span>
              <span className="text-emerald-400 font-semibold font-mono">
                {progressPercent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden p-0.5">
              <div
                style={{ width: `${progressPercent}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
              />
            </div>
          </div>

          {/* 5-Step Horizontal Phase Stepper */}
          <div className="space-y-1.5">
            <span className="text-[10.5px] uppercase font-light text-slate-400 tracking-wider block px-1">
              5 Giai đoạn phục hồi chuẩn y khoa (Nhấn để xem chi tiết)
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {stages.map((stage) => {
                const isCurrent = stage.id === currentPhase;
                const isPast = stage.id < currentPhase;
                const isSelected = stage.id === selectedPhaseId;

                return (
                  <button
                    key={stage.id}
                    onClick={() => setSelectedPhaseId(stage.id)}
                    className={`p-2 rounded-2xl flex flex-col items-center justify-between text-center transition-all ${
                      isSelected
                        ? 'bg-white text-slate-950 shadow-xl shadow-white/10 ring-2 ring-emerald-400/80 scale-[1.02]'
                        : isCurrent
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : isPast
                        ? 'bg-white/[0.04] border border-white/[0.06] text-slate-300'
                        : 'bg-white/[0.02] border border-white/[0.04] text-slate-500 opacity-60'
                    }`}
                  >
                    <span className={`text-[9px] uppercase font-semibold ${isSelected ? 'text-slate-950' : 'text-slate-400'}`}>
                      GĐ {stage.id}
                    </span>

                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center my-1 text-[11px] font-bold ${
                        isSelected
                          ? 'bg-slate-950 text-white'
                          : isCurrent
                          ? 'bg-emerald-500 text-white shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                          : isPast
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {isPast ? <Check className="w-3 h-3 stroke-[3]" /> : stage.id}
                    </div>

                    <span className={`text-[9.5px] font-medium truncate w-full ${isSelected ? 'text-slate-950' : 'text-slate-300'}`}>
                      {stage.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Phase Detail Card */}
          <div className="bg-[#1A1C24] border border-white/[0.08] rounded-3xl p-4 sm:p-5 space-y-4 shadow-xl">
            {/* Card Header */}
            <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] pb-3.5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-white/[0.08] text-slate-300 border border-white/10">
                    {activeStage.weekRangeText}
                  </span>
                  {activeStage.id === currentPhase ? (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Giai đoạn hiện tại
                    </span>
                  ) : activeStage.id < currentPhase ? (
                    <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      ✓ Đã vượt qua
                    </span>
                  ) : (
                    <span className="text-[10px] font-light uppercase px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400">
                      Chặng sắp tới
                    </span>
                  )}
                </div>
                <h4 className="text-base sm:text-lg font-medium text-white tracking-tight">
                  {activeStage.title}
                </h4>
                <p className="text-xs text-slate-400 font-light mt-0.5">
                  Thời gian dự kiến: <strong className="text-slate-200 font-normal">{formatDate(stageStartDate)} – {formatDate(stageEndDate)}</strong> ({activeStage.durationText})
                </p>
              </div>
            </div>

            {/* Core Focus */}
            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-1">
              <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Trọng tâm cốt lõi:
              </span>
              <p className="text-xs text-slate-300 font-light leading-relaxed">
                {activeStage.focus}
              </p>
            </div>

            {/* 3 Medical Parameters Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <span className="text-[10px] text-slate-400 block font-light">Góc gập an toàn</span>
                <span className="text-xs font-semibold text-white block">
                  {activeStage.maxFlexion}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <span className="text-[10px] text-slate-400 block font-light">Chế độ tì chân / Nạng</span>
                <span className="text-xs font-medium text-slate-200 block leading-snug">
                  {activeStage.weightBearing}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <span className="text-[10px] text-slate-400 block font-light">Nẹp gối (Brace)</span>
                <span className="text-xs font-medium text-slate-200 block leading-snug">
                  {activeStage.braceRule}
                </span>
              </div>
            </div>

            {/* Criteria to advance (Tiêu chuẩn vàng chuyển giai đoạn) */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-medium text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Tiêu chuẩn vàng để chuyển sang giai đoạn tiếp theo:
              </span>
              <div className="space-y-1.5">
                {activeStage.criteria.map((crit, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-start gap-2.5 text-xs text-slate-300 font-light leading-relaxed"
                  >
                    <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                      ✓
                    </span>
                    <span>{crit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Red flags warnings */}
            {activeStage.redFlags && activeStage.redFlags.length > 0 && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-rose-400 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Dấu hiệu cần dừng tập & báo bác sĩ:
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-rose-200/90 font-light">
                  {activeStage.redFlags.map((rf, i) => (
                    <li key={i}>{rf}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06] flex items-center justify-between shrink-0 bg-white/[0.02]">
          <span className="text-[11px] text-slate-400 font-light">
            Phác đồ lâm sàng chuẩn MOON Knee Group & Melbourne ACL Guide
          </span>
          <button
            onClick={onClose}
            className="py-2.5 px-5 bg-white hover:bg-slate-100 text-slate-950 font-medium rounded-full text-xs transition active:scale-95 shadow-md"
          >
            Đã hiểu
          </button>
        </div>

      </div>
    </div>
  );
}
