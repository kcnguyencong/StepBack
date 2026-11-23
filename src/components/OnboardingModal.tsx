'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Calendar,
  Activity,
  User,
  ShieldCheck,
  ChevronRight,
  Check,
  Target
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  SurgeryType,
  SURGERY_DETAILS,
  getRehabStatus,
  AgeGroup,
  getAgeGroupDetails,
  getSurgeryDetails,
  getSafeAgeGroup,
  getSafeSurgeryType
} from '@/data/rehabProtocols';

export interface UserProfile {
  name: string;
  surgeryDate: string;
  surgeryType: SurgeryType;
  surgeryLeg: 'left' | 'right';
  ageGroup?: AgeGroup;
  weightBearingRestriction?: string;
  maxFlexionRestriction?: number;
  rehabGoal?: string;
  completedOnboarding: boolean;
}

interface OnboardingModalProps {
  initialProfile: UserProfile;
  isOpen: boolean;
  onComplete: (profile: UserProfile) => void;
  onClose?: () => void;
}

export default function OnboardingModal({
  initialProfile,
  isOpen,
  onComplete,
  onClose,
}: OnboardingModalProps) {
  const [step, setStep] = useState<number>(0);
  const [name, setName] = useState<string>(initialProfile.name || '');
  const [surgeryDate, setSurgeryDate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('surgeryDate');
      if (stored) return stored;
    }
    return initialProfile.surgeryDate || new Date().toISOString().split('T')[0];
  });
  const [surgeryLeg, setSurgeryLeg] = useState<'left' | 'right'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('operatedLeg') as 'left' | 'right';
      if (stored) return stored;
    }
    return initialProfile.surgeryLeg || 'left';
  });
  const [surgeryType, setSurgeryType] = useState<SurgeryType>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('surgeryType');
      if (stored) return getSafeSurgeryType(stored);
    }
    return getSafeSurgeryType(initialProfile.surgeryType);
  });
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ageGroup');
      if (stored) return getSafeAgeGroup(stored);
    }
    return getSafeAgeGroup(initialProfile.ageGroup);
  });
  const [weightBearing, setWeightBearing] = useState<string>(
    initialProfile.surgeryType === 'ACL_MENISCUS_REPAIR' ? 'NWB' : 'PWB'
  );
  const [maxFlexion, setMaxFlexion] = useState<number>(
    initialProfile.surgeryType === 'ACL_MENISCUS_REPAIR' ? 90 : 110
  );
  const [rehabGoal, setRehabGoal] = useState<string>('Đi lại bình thường & Trở lại thể thao');

  if (!isOpen) return null;

  const totalSteps = 4;

  const handleNext = () => {
    if (step === 1 && !name.trim()) {
      setName('Bệnh nhân');
    }
    if (step < totalSteps) {
      setStep((prev) => prev + 1);
    } else {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });
      try {
        localStorage.setItem('surgeryDate', surgeryDate);
        localStorage.setItem('surgeryType', surgeryType);
        localStorage.setItem('operatedLeg', surgeryLeg);
        localStorage.setItem('ageGroup', ageGroup);
        localStorage.setItem('axvyra_profile_completed', 'true');
      } catch {}

      const finishedProfile: UserProfile = {
        name: name.trim() || 'Bệnh nhân',
        surgeryDate,
        surgeryType,
        surgeryLeg,
        ageGroup,
        weightBearingRestriction: weightBearing,
        maxFlexionRestriction: maxFlexion,
        rehabGoal,
        completedOnboarding: true,
      };
      onComplete(finishedProfile);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep((prev) => prev - 1);
    } else if (onClose) {
      onClose();
    }
  };

  const previewStatus = getRehabStatus(surgeryDate, surgeryType, ageGroup);

  return (
    <div className="fixed sm:absolute inset-0 z-50 bg-[#0C0D11] text-white flex flex-col justify-between overflow-hidden animate-fade-in font-sans">
      {/* Top Header / Stepper Bar */}
      <div className="pt-4 px-4 pb-3 flex items-center justify-between border-b border-white/[0.08] bg-[#0C0D11]/95 backdrop-blur-xl shrink-0">
        {step > 0 ? (
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition"
            aria-label="Quay lại"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-9" />
        )}

        {/* Stepper Dots */}
        {step > 0 ? (
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  step === i
                    ? 'w-7 bg-white'
                    : step > i
                    ? 'w-2 bg-emerald-400'
                    : 'w-2 bg-white/20'
                }`}
              />
            ))}
          </div>
        ) : (
          <div className="text-[11px] font-medium text-emerald-400 tracking-widest uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            AXVYRA • Khởi tạo Phác đồ
          </div>
        )}

        {step > 0 ? (
          <span className="text-xs font-light text-slate-400">
            {step}/4
          </span>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* Scrollable Step Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 text-white">
        {/* STEP 0: HERO WELCOME */}
        {step === 0 && (
          <div className="flex flex-col items-center text-center space-y-4 pt-1">
            <div className="relative w-full h-56 rounded-[32px] overflow-hidden shadow-2xl bg-[#16181F] border border-white/[0.08] flex items-center justify-center">
              <Image
                src="/images/knee-hero.png"
                alt="AXVYRA Knee"
                fill
                className="object-cover scale-110 opacity-70"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0C0D11] via-[#0C0D11]/30 to-transparent" />
              
              <div className="absolute top-3 left-3 bg-[#16181F]/80 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full flex items-center gap-1.5 text-[10px] font-medium text-emerald-300">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Chuẩn Y Khoa ACL & Meniscus
              </div>

              <div className="absolute bottom-3 right-3 bg-[#16181F]/80 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full flex items-center gap-1.5 text-[10px] font-medium text-sky-300">
                <Activity className="w-3 h-3 text-sky-400" />
                Đo góc AI thời gian thực
              </div>
            </div>

            <div className="space-y-1.5 px-1">
              <div className="text-[10px] font-medium tracking-widest text-emerald-400 uppercase">
                AXVYRA — Rebuild. Rise. Return.
              </div>
              <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight leading-tight">
                Hành trình <span className="text-emerald-400">Phục Hồi</span>
                <br />
                Được cá nhân hóa cho bạn.
              </h1>
              <p className="text-xs text-slate-400 font-light leading-relaxed max-w-[340px] mx-auto pt-1">
                Đồng hành từ phòng mổ đến khi tự tin trở lại thể thao. Bảo vệ tối đa mối khâu sụn chêm và tái thiết sức mạnh cơ đùi.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 w-full pt-1">
              <div className="bg-[#16181F] border border-white/[0.08] rounded-2xl p-3 text-left">
                <div className="text-[10px] text-slate-400 font-light uppercase">Kiểm soát an toàn</div>
                <div className="text-xs font-medium text-white mt-0.5">Khóa góc & Tì đè</div>
              </div>
              <div className="bg-[#16181F] border border-white/[0.08] rounded-2xl p-3 text-left">
                <div className="text-[10px] text-slate-400 font-light uppercase">Kế hoạch hàng ngày</div>
                <div className="text-xs font-medium text-white mt-0.5">Bài tập + Phản hồi</div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: IDENTITY & OPERATED LEG */}
        {step === 1 && (
          <div className="space-y-4 pt-1 animate-fade-in">
            <div>
              <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-widest">
                Bước 1 • Thông tin bệnh nhân
              </span>
              <h2 className="text-2xl font-light text-white tracking-tight mt-0.5">
                Bạn tên là gì & phẫu thuật bên nào?
              </h2>
              <p className="text-xs text-slate-400 font-light mt-0.5">
                Thông tin dùng để cá nhân hóa phác đồ và phân biệt chân mổ.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-light text-slate-300 block">
                Họ và tên bệnh nhân:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Hoàng Long, Minh Tuấn..."
                  className="w-full bg-[#16181F] border border-white/10 focus:border-white/30 rounded-2xl p-3.5 pl-10 text-xs sm:text-sm font-normal text-white placeholder-slate-500 transition outline-none"
                  autoFocus
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="text-xs font-light text-slate-300 block">
                Khớp gối phẫu thuật:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSurgeryLeg('left')}
                  className={`p-4 rounded-2xl border text-center transition-all ${
                    surgeryLeg === 'left'
                      ? 'border-white bg-white text-slate-950 shadow-xl'
                      : 'border-white/[0.08] bg-[#16181F] text-slate-300 hover:border-white/20'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center font-medium text-base mb-1.5 ${
                    surgeryLeg === 'left' ? 'bg-slate-950 text-white' : 'bg-white/5 text-emerald-400 border border-white/10'
                  }`}>
                    L
                  </div>
                  <div className="text-xs font-medium">Gối Trái</div>
                  <div className={`text-[10px] ${surgeryLeg === 'left' ? 'text-slate-600' : 'text-slate-500'}`}>Left Knee</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSurgeryLeg('right')}
                  className={`p-4 rounded-2xl border text-center transition-all ${
                    surgeryLeg === 'right'
                      ? 'border-white bg-white text-slate-950 shadow-xl'
                      : 'border-white/[0.08] bg-[#16181F] text-slate-300 hover:border-white/20'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center font-medium text-base mb-1.5 ${
                    surgeryLeg === 'right' ? 'bg-slate-950 text-white' : 'bg-white/5 text-emerald-400 border border-white/10'
                  }`}>
                    R
                  </div>
                  <div className="text-xs font-medium">Gối Phải</div>
                  <div className={`text-[10px] ${surgeryLeg === 'right' ? 'text-slate-600' : 'text-slate-500'}`}>Right Knee</div>
                </button>
              </div>
            </div>

            {/* Nhóm độ tuổi */}
            <div className="space-y-2 pt-2 border-t border-white/[0.08]">
              <label className="text-xs font-light text-slate-300 block">
                Nhóm độ tuổi bệnh nhân:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'UNDER_30', label: '< 30 tuổi', desc: 'VĐV / Trẻ' },
                  { id: 'AGE_31_45', label: '31 - 45 tuổi', desc: 'Phong trào' },
                  { id: 'OVER_45', label: '> 45 tuổi', desc: 'Trung niên' },
                ].map((ag) => (
                  <button
                    key={ag.id}
                    type="button"
                    onClick={() => setAgeGroup(ag.id as AgeGroup)}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      ageGroup === ag.id
                        ? 'border-white bg-white text-slate-950 shadow-lg'
                        : 'border-white/[0.08] bg-[#16181F] text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <span className="text-xs font-medium block">{ag.label}</span>
                    <span className={`text-[10px] block mt-0.5 ${ageGroup === ag.id ? 'text-slate-600 font-normal' : 'text-slate-500 font-light'}`}>
                      {ag.desc}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 font-light italic pt-1">
                💡 {getAgeGroupDetails(ageGroup).clinicalNote}
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: PROCEDURE & CLINICAL RESTRICTIONS */}
        {step === 2 && (
          <div className="space-y-3.5 pt-1 animate-fade-in">
            <div>
              <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-widest">
                Bước 2 • Phẫu thuật & Giới hạn
              </span>
              <h2 className="text-2xl font-light text-white tracking-tight mt-0.5">
                Phương pháp can thiệp của bạn
              </h2>
              <p className="text-xs text-slate-400 font-light mt-0.5">
                Lựa chọn chính xác để khóa an toàn góc gập và tải trọng.
              </p>
            </div>

            <div className="space-y-2 pt-0.5">
              {(
                [
                  'ACL_MENISCUS_REPAIR',
                  'ACL_ONLY',
                  'ACL_MENISCUS_TRIM',
                ] as SurgeryType[]
              ).map((type) => {
                const details = SURGERY_DETAILS[type];
                const isSelected = surgeryType === type;
                return (
                  <div
                    key={type}
                    onClick={() => {
                      setSurgeryType(type);
                      if (type === 'ACL_MENISCUS_REPAIR') {
                        setWeightBearing('NWB');
                        setMaxFlexion(90);
                      }
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-white/30 bg-white/[0.08] shadow-lg ring-1 ring-white/20'
                        : 'border-white/[0.08] bg-[#16181F] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center border text-[9px] ${
                            isSelected
                              ? 'bg-emerald-400 border-emerald-400 text-slate-950'
                              : 'border-slate-500 bg-transparent'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="font-medium text-xs text-white">
                          {details.shortLabel}
                        </span>
                      </div>

                      {type === 'ACL_MENISCUS_REPAIR' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20 shrink-0">
                          Khóa ≤ 90° & NWB
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 font-light mt-2 leading-relaxed pl-6">
                      {details.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Custom Restrictions Inputs */}
            <div className="pt-2 border-t border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-light text-slate-300">Chỉ định tì đè (Bác sĩ dặn):</span>
                <span className="font-medium text-emerald-400">{weightBearing}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                {[
                  { id: 'NWB', label: 'Cấm tì (NWB)' },
                  { id: 'PWB', label: 'Tì 1 phần (PWB)' },
                  { id: 'FWB', label: 'Tì hoàn toàn (FWB)' },
                ].map((wb) => (
                  <button
                    key={wb.id}
                    type="button"
                    onClick={() => setWeightBearing(wb.id)}
                    className={`py-2 px-2 rounded-xl border text-center transition ${
                      weightBearing === wb.id
                        ? 'bg-white text-slate-950 font-medium'
                        : 'bg-[#16181F] text-slate-400 border-white/[0.08] hover:text-white'
                    }`}
                  >
                    {wb.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SURGERY DATE & GOALS */}
        {step === 3 && (
          <div className="space-y-4 pt-1 animate-fade-in">
            <div>
              <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-widest">
                Bước 3 • Mốc thời gian & Mục tiêu
              </span>
              <h2 className="text-2xl font-light text-white tracking-tight mt-0.5">
                Ngày phẫu thuật & Kỳ vọng
              </h2>
              <p className="text-xs text-slate-400 font-light mt-0.5">
                Xác định ngày mổ để xếp bài tập vào đúng tuần phục hồi.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-light text-slate-300 block">
                Ngày phẫu thuật:
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={surgeryDate}
                  onChange={(e) => setSurgeryDate(e.target.value)}
                  className="w-full bg-[#16181F] border border-white/10 focus:border-white/30 rounded-2xl p-3.5 pl-10 text-xs sm:text-sm font-normal text-white transition outline-none cursor-pointer [color-scheme:dark]"
                />
                <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              {[
                { label: 'Hôm nay', daysAgo: 0 },
                { label: '1 tuần trước', daysAgo: 7 },
                { label: '2 tuần trước', daysAgo: 14 },
                { label: '3 tuần trước', daysAgo: 21 },
                { label: '4 tuần trước', daysAgo: 28 },
                { label: '6 tuần trước', daysAgo: 42 },
              ].map((preset) => {
                const target = new Date(Date.now() - preset.daysAgo * 86400000)
                  .toISOString()
                  .split('T')[0];
                const isSelected = surgeryDate === target;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setSurgeryDate(target)}
                    className={`py-2 px-2 rounded-xl border text-center transition ${
                      isSelected
                        ? 'bg-white text-slate-950 font-medium shadow-sm'
                        : 'bg-[#16181F] hover:bg-white/[0.04] text-slate-400 border-white/[0.08]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Rehab Goal Input */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-light text-slate-300 block flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                Mục tiêu phục hồi của bạn:
              </label>
              <input
                type="text"
                value={rehabGoal}
                onChange={(e) => setRehabGoal(e.target.value)}
                placeholder="Ví dụ: Trở lại đá bóng, chạy marathon, đi lại không đau..."
                className="w-full bg-[#16181F] border border-white/10 focus:border-white/30 rounded-2xl p-3 text-xs text-white placeholder-slate-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* STEP 4: SUMMARY & CLINICAL VERIFICATION PREVIEW */}
        {step === 4 && (
          <div className="space-y-3.5 pt-1 animate-fade-in">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-white/[0.06] border border-white/10 text-emerald-400 rounded-full mx-auto flex items-center justify-center mb-1 shadow-lg">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-light text-white tracking-tight">
                Hồ sơ AXVYRA đã thiết lập!
              </h2>
              <p className="text-xs text-slate-400 font-light">
                Kế hoạch phục hồi gối của bệnh nhân {name}.
              </p>
            </div>

            <div className="bg-[#16181F] border border-white/[0.08] rounded-[28px] p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <span className="text-slate-400 font-light">Phẫu thuật:</span>
                <span className="font-medium text-white">
                  {surgeryLeg === 'left' ? 'Gối Trái (L)' : 'Gối Phải (R)'} • {getSurgeryDetails(surgeryType).shortLabel}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <span className="text-slate-400 font-light">Độ tuổi lâm sàng:</span>
                <span className="font-medium text-white">
                  {getAgeGroupDetails(ageGroup).label}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <span className="text-slate-400 font-light">Tiến độ:</span>
                <span className="font-medium text-emerald-400">
                  Ngày {previewStatus.currentDay} • Tuần {previewStatus.currentWeek} (GĐ {previewStatus.phase.phase})
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <span className="text-slate-400 font-light">Giới hạn gập gối:</span>
                <span
                  className={`font-medium px-2.5 py-0.5 rounded-full ${
                    previewStatus.isMeniscusRepairStrictLimit
                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  ≤ {maxFlexion}°
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-light">Mục tiêu cá nhân:</span>
                <span className="font-medium text-white truncate max-w-[180px]">
                  {rehabGoal}
                </span>
              </div>
            </div>

            {previewStatus.isMeniscusRepairStrictLimit && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2.5 leading-relaxed">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold text-amber-100">QUY TẮC SỤN CHÊM:</strong> Giữ nẹp thẳng 0°, đi 2 nạng không tì chân ({weightBearing}) và không gập quá 90° trong 6 tuần đầu.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Controls */}
      <div className="p-4 border-t border-white/[0.08] bg-[#0C0D11]/95 backdrop-blur-xl shrink-0 flex items-center gap-2.5">
        {step === 0 ? (
          <button
            onClick={handleNext}
            className="w-full py-3.5 px-6 bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-950 font-medium rounded-full text-xs sm:text-sm transition shadow-xl flex items-center justify-center gap-2"
          >
            <span>Bắt đầu thiết lập phác đồ</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <>
            <button
              onClick={handleBack}
              className="py-3 px-4 rounded-full border border-white/10 hover:bg-white/[0.06] active:scale-[0.98] text-slate-300 text-xs font-medium transition"
            >
              Quay lại
            </button>

            <button
              onClick={handleNext}
              className="flex-1 py-3 px-6 bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-950 font-medium rounded-full text-xs sm:text-sm transition shadow-xl flex items-center justify-center gap-1.5"
            >
              <span>{step === totalSteps ? 'Xác nhận & Vào Hành trình' : 'Tiếp tục'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}