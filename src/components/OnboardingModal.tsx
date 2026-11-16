'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldAlert,
  Calendar,
  Activity,
  Heart,
  User,
  ShieldCheck,
  ChevronRight,
  Flame,
  Check,
  Sliders,
  Target
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  SurgeryType,
  SURGERY_DETAILS,
  getRehabStatus,
  AgeGroup,
  AGE_GROUP_DETAILS,
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
  const [rehabGoal, setRehabGoal] = useState<string>('Đi lại bình thường & Trở lại thể thao nhẹ');

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
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
      try {
        localStorage.setItem('surgeryDate', surgeryDate);
        localStorage.setItem('surgeryType', surgeryType);
        localStorage.setItem('operatedLeg', surgeryLeg);
        localStorage.setItem('ageGroup', ageGroup);
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
    <div className="fixed sm:absolute inset-0 z-50 bg-white flex flex-col justify-between overflow-hidden animate-fade-in">
      {/* Top Header / Stepper Bar */}
      <div className="pt-3 px-4 pb-2.5 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur shrink-0">
        {step > 0 ? (
          <button
            onClick={handleBack}
            className="p-2 -ml-1 text-slate-500 hover:text-slate-900 rounded-full active:bg-slate-100 transition"
            aria-label="Quay lại"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-8" />
        )}

        {/* Stepper Dots */}
        {step > 0 ? (
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === i
                    ? 'w-6 bg-emerald-600'
                    : step > i
                    ? 'w-2.5 bg-emerald-300'
                    : 'w-2.5 bg-slate-200'
                }`}
              />
            ))}
          </div>
        ) : (
          <div className="text-xs font-bold text-emerald-700 tracking-wider uppercase">
            AXVYRA • Khởi tạo Phác đồ
          </div>
        )}

        {step > 0 ? (
          <span className="text-[11px] font-bold text-slate-400">
            {step}/4
          </span>
        ) : (
          <div className="w-8" />
        )}
      </div>

      {/* Scrollable Step Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 text-slate-800">
        {/* STEP 0: HERO WELCOME */}
        {step === 0 && (
          <div className="flex flex-col items-center text-center space-y-3.5 pt-1">
            <div className="relative w-full h-52 rounded-3xl overflow-hidden shadow-inner bg-gradient-to-b from-sky-50 via-teal-50 to-emerald-50 flex items-center justify-center border border-slate-100">
              <Image
                src="/images/knee-hero.png"
                alt="AXVYRA Knee"
                fill
                className="object-cover scale-105"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-transparent" />
              
              <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-md border border-white/60 shadow-sm px-2.5 py-1 rounded-full flex items-center gap-1 text-[10px] font-bold text-emerald-800">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Chuẩn Y Khoa ACL & Meniscus
              </div>

              <div className="absolute bottom-2.5 right-2.5 bg-white/90 backdrop-blur-md border border-white/60 shadow-sm px-2.5 py-1 rounded-full flex items-center gap-1 text-[10px] font-bold text-sky-800">
                <Activity className="w-3 h-3 text-sky-600" />
                Đo góc AI thời gian thực
              </div>
            </div>

            <div className="space-y-1.5 px-1">
              <div className="inline-block text-[10px] font-black tracking-widest text-emerald-600 uppercase">
                AXVYRA — Rebuild. Rise. Return.
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Hành trình <span className="text-emerald-600">Phục Hồi</span>
                <br />
                Được cá nhân hóa cho bạn.
              </h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                Đồng hành từ phòng mổ đến khi tự tin trở lại thể thao. Bảo vệ tối đa mối khâu sụn chêm và tái thiết sức mạnh cơ đùi.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full pt-1">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-2.5 text-left">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Kiểm soát an toàn</div>
                <div className="text-xs font-black text-slate-900 mt-0.5">Khóa góc & Tì đè</div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-2.5 text-left">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Kế hoạch hàng ngày</div>
                <div className="text-xs font-black text-slate-900 mt-0.5">Bài tập + Phản hồi</div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: IDENTITY & OPERATED LEG */}
        {step === 1 && (
          <div className="space-y-4 pt-1 animate-fade-in">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Bước 1 • Thông tin bệnh nhân
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-0.5">
                Bạn tên là gì & phẫu thuật bên nào?
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Thông tin dùng để cá nhân hóa phác đồ và phân biệt chân mổ.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Họ và tên bệnh nhân:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Hoàng Long, Minh Tuấn..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl p-3 pl-10 text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 transition outline-none"
                  autoFocus
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-slate-700 block">
                Khớp gối phẫu thuật:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSurgeryLeg('left')}
                  className={`p-3.5 rounded-2xl border text-center transition-all ${
                    surgeryLeg === 'left'
                      ? 'border-emerald-500 bg-emerald-50/80 shadow-sm ring-2 ring-emerald-500/30'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center font-black text-base mb-1.5 bg-white shadow-xs border border-slate-100 text-emerald-600">
                    L
                  </div>
                  <div className="text-xs font-black text-slate-900">Gối Trái</div>
                  <div className="text-[10px] text-slate-400">Left Knee</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSurgeryLeg('right')}
                  className={`p-3.5 rounded-2xl border text-center transition-all ${
                    surgeryLeg === 'right'
                      ? 'border-emerald-500 bg-emerald-50/80 shadow-sm ring-2 ring-emerald-500/30'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center font-black text-base mb-1.5 bg-white shadow-xs border border-slate-100 text-emerald-600">
                    R
                  </div>
                  <div className="text-xs font-black text-slate-900">Gối Phải</div>
                  <div className="text-[10px] text-slate-400">Right Knee</div>
                </button>
              </div>
            </div>

            {/* Nhóm độ tuổi */}
            <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 block">
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
                    className={`p-2.5 rounded-2xl border text-center transition-all ${
                      ageGroup === ag.id
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-800 font-bold ring-2 ring-emerald-500/25'
                        : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs font-black block">{ag.label}</span>
                    <span className="text-[9.5px] text-slate-500 block mt-0.5">{ag.desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 italic mt-0.5">
                💡 {getAgeGroupDetails(ageGroup).clinicalNote}
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: PROCEDURE & CLINICAL RESTRICTIONS */}
        {step === 2 && (
          <div className="space-y-3 pt-1 animate-fade-in">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Bước 2 • Phẫu thuật & Giới hạn
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-0.5">
                Phương pháp can thiệp của bạn
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
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
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/60 shadow-xs ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center border text-[9px] ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <span className="font-bold text-xs text-slate-900">
                          {details.shortLabel}
                        </span>
                      </div>

                      {type === 'ACL_MENISCUS_REPAIR' && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
                          Khóa &le; 90° & NWB
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed pl-6">
                      {details.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Custom Restrictions Inputs */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Chỉ định tì đè (Bác sĩ dặn):</span>
                <span className="font-black text-emerald-700">{weightBearing}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-bold">
                {[
                  { id: 'NWB', label: 'Cấm tì (NWB)' },
                  { id: 'PWB', label: 'Tì 1 phần (PWB)' },
                  { id: 'FWB', label: 'Tì hoàn toàn (FWB)' },
                ].map((wb) => (
                  <button
                    key={wb.id}
                    type="button"
                    onClick={() => setWeightBearing(wb.id)}
                    className={`py-1.5 px-2 rounded-xl border text-center transition ${
                      weightBearing === wb.id
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
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
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Bước 3 • Mốc thời gian & Mục tiêu
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-0.5">
                Ngày phẫu thuật & Kỳ vọng
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Xác định ngày mổ để xếp bài tập vào đúng tuần phục hồi.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Ngày phẫu thuật:
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={surgeryDate}
                  onChange={(e) => setSurgeryDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl p-3 pl-10 text-xs sm:text-sm font-semibold text-slate-900 transition outline-none cursor-pointer"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-medium">
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
                    className={`py-1.5 px-2 rounded-xl border text-center transition ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Rehab Goal Input */}
            <div className="space-y-1 pt-1">
              <label className="text-xs font-bold text-slate-700 block flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-emerald-600" />
                Mục tiêu phục hồi của bạn:
              </label>
              <input
                type="text"
                value={rehabGoal}
                onChange={(e) => setRehabGoal(e.target.value)}
                placeholder="Ví dụ: Trở lại đá bóng, chạy marathon, đi lại không đau..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl p-2.5 text-xs text-slate-900 placeholder-slate-400 outline-none"
              />
            </div>
          </div>
        )}

        {/* STEP 4: SUMMARY & CLINICAL VERIFICATION PREVIEW */}
        {step === 4 && (
          <div className="space-y-3 pt-1 animate-fade-in">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-1.5 shadow-inner">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black text-slate-900">
                Hồ sơ AXVYRA đã thiết lập!
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Kế hoạch phục hồi gối của bệnh nhân {name}.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                <span className="text-slate-500">Phẫu thuật:</span>
                <span className="font-bold text-slate-900">
                  {surgeryLeg === 'left' ? 'Gối Trái (L)' : 'Gối Phải (R)'} • {getSurgeryDetails(surgeryType).shortLabel}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                <span className="text-slate-500">Độ tuổi lâm sàng:</span>
                <span className="font-bold text-slate-900">
                  {getAgeGroupDetails(ageGroup).label}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                <span className="text-slate-500">Tiến độ:</span>
                <span className="font-bold text-emerald-700">
                  Ngày {previewStatus.currentDay} • Tuần {previewStatus.currentWeek} (Giai đoạn {previewStatus.phase.phase})
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                <span className="text-slate-500">Giới hạn gập gối:</span>
                <span
                  className={`font-black px-2 py-0.5 rounded-lg ${
                    previewStatus.isMeniscusRepairStrictLimit
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  &le; {maxFlexion}°
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Mục tiêu cá nhân:</span>
                <span className="font-bold text-slate-900 truncate max-w-[180px]">
                  {rehabGoal}
                </span>
              </div>
            </div>

            {previewStatus.isMeniscusRepairStrictLimit && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>QUY TẮC SỤN CHÊM:</strong> Giữ nẹp thẳng 0°, đi 2 nạng không tì chân ({weightBearing}) và không gập quá 90° trong 6 tuần đầu.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Controls */}
      <div className="p-3.5 border-t border-slate-100 bg-white shrink-0 flex items-center gap-2.5">
        {step === 0 ? (
          <button
            onClick={handleNext}
            className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-2xl text-xs sm:text-sm transition shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2"
          >
            <span>Bắt đầu thiết lập phác đồ</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <>
            <button
              onClick={handleBack}
              className="py-3 px-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-600 text-xs font-bold transition"
            >
              Quay lại
            </button>

            <button
              onClick={handleNext}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-2xl text-xs sm:text-sm transition shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1.5"
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
