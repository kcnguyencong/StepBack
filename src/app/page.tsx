'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  Bell,
  Layers,
  Dumbbell,
  BarChart2,
  Calendar,
  Compass,
  Play,
  CheckCircle2,
  Clock,
  Heart,
  ChevronRight,
  TrendingUp,
  Sparkles,
  ShieldAlert,
  RotateCcw,
  Pause,
  Award,
  Search,
  BookOpen,
  Camera,
  Activity,
  Check,
  Zap,
  Flame,
  Home
} from 'lucide-react';
import {
  SurgeryType,
  SURGERY_DETAILS,
  getRehabStatus,
  Exercise
} from '@/data/rehabProtocols';
import {
  RecoveryCase,
  DailyExerciseSession,
  KNOWLEDGE_ARTICLES,
  KnowledgeArticle
} from '@/data/axvyraDomain';
import { AxvyraStore, getOrCreateDefaultCase } from '@/lib/axvyraStore';
import WorkoutPlayer from '@/components/WorkoutPlayer';
import KneeAngleCamera, { AngleRecord } from '@/components/KneeAngleCamera';
import OnboardingModal, { UserProfile } from '@/components/OnboardingModal';
import SessionFeedbackModal from '@/components/SessionFeedbackModal';

type MainTab = 'home' | 'plan' | 'progress' | 'explore';

export default function AxvyraApp() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('home');

  // Recovery Case State
  const [recoveryCase, setRecoveryCase] = useState<RecoveryCase | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // Workout Session State
  const [activeWorkoutExercises, setActiveWorkoutExercises] = useState<Exercise[] | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [feedbackSessionTitle, setFeedbackSessionTitle] = useState<string>('');

  // Ice Timer State
  const [iceSeconds, setIceSeconds] = useState<number>(15 * 60);
  const [isIceRunning, setIsIceRunning] = useState<boolean>(false);

  // Quick Daily Log State
  const [painScore, setPainScore] = useState<number>(3);
  const [swellingLevel, setSwellingLevel] = useState<'none' | 'mild' | 'moderate' | 'severe'>('mild');
  const [dailyNotes, setDailyNotes] = useState<string>('');
  const [logSuccessNotice, setLogSuccessNotice] = useState<boolean>(false);

  // Explore search & category
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);

  // Load state on mount
  useEffect(() => {
    setMounted(true);
    let currentCase = AxvyraStore.getRecoveryCase();
    if (!currentCase) {
      currentCase = getOrCreateDefaultCase();
      AxvyraStore.saveRecoveryCase(currentCase);
      setShowOnboarding(true);
    }
    setRecoveryCase(currentCase);

    // Sync with Neon Serverless DB
    AxvyraStore.syncWithServer().then((serverCase) => {
      if (serverCase) setRecoveryCase({ ...serverCase });
    });
  }, []);

  // Compute live rehab clinical status
  const rehabStatus = useMemo(() => {
    if (!recoveryCase) return getRehabStatus(new Date(), 'ACL_MENISCUS_REPAIR');
    return getRehabStatus(recoveryCase.surgeryDate, recoveryCase.surgeryType);
  }, [recoveryCase]);

  // Ice Timer Tick
  useEffect(() => {
    let interval: any = null;
    if (isIceRunning) {
      interval = setInterval(() => {
        setIceSeconds((prev) => {
          if (prev <= 1) {
            setIsIceRunning(false);
            try {
              const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
              const ctx = new AudioCtx();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(600, ctx.currentTime);
              gain.gain.setValueAtTime(0.2, ctx.currentTime);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 1.2);
            } catch {}
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isIceRunning]);

  const resetIceTimer = () => {
    setIsIceRunning(false);
    setIceSeconds(15 * 60);
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Onboarding Completion
  const handleOnboardingComplete = (profile: UserProfile) => {
    const updated = getOrCreateDefaultCase(
      profile.name,
      profile.surgeryDate,
      profile.surgeryType,
      profile.surgeryLeg,
      {
        weightBearing: profile.weightBearingRestriction,
        maxFlexion: profile.maxFlexionRestriction,
      }
    );
    AxvyraStore.saveRecoveryCase(updated);
    setRecoveryCase(updated);
    setShowOnboarding(false);
  };

  // Start Session
  const handleStartTodaySession = (session: DailyExerciseSession) => {
    setActiveSessionId(session.id);
    setFeedbackSessionTitle(session.title);

    const exercisesForPlayer: Exercise[] = session.exercises.map((e) => ({
      id: e.exerciseId,
      name: e.title,
      vietnameseName: e.vietnameseName,
      category: 'activation',
      targetSets: e.targetSets,
      targetReps: e.targetReps,
      holdSec: e.holdSec,
      restSec: e.restSec,
      description: e.instructions[0] || '',
      instructions: e.instructions,
      safetyWarning: e.safetyNote,
      maxFlexionAngle: e.maxFlexionAngle,
    }));

    setActiveWorkoutExercises(exercisesForPlayer);
  };

  const handleWorkoutFinished = () => {
    setActiveWorkoutExercises(null);
    setShowFeedbackModal(true);
  };

  const handleSaveSessionFeedback = (feedback: {
    rpeScore: number;
    painDuringSession: number;
    notes: string;
  }) => {
    if (!activeSessionId) return;
    const updated = AxvyraStore.completeSession(activeSessionId, feedback);
    if (updated) setRecoveryCase({ ...updated });
    setShowFeedbackModal(false);
    setActiveSessionId(null);
  };

  const handleSaveQuickLog = () => {
    const todayStr = new Date().toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const updated = AxvyraStore.addDailyRecoveryLog({
      date: todayStr,
      painScore,
      swellingLevel,
      iceDone: iceSeconds < 15 * 60,
      functionalConfidence: 8,
      patientNotes: dailyNotes,
    });

    if (updated) setRecoveryCase({ ...updated });
    setLogSuccessNotice(true);
    setTimeout(() => setLogSuccessNotice(false), 3000);
  };

  const handleROMRecorded = (record: AngleRecord) => {
    const updated = AxvyraStore.addROMRecord({
      flexionAngle: record.flexionAngle,
      extensionAngle: record.internalAngle ? Math.max(0, 180 - record.internalAngle) : 0,
      leg: record.leg,
      isSafe: record.isSafe,
      safeLimit: record.safeLimit,
      source: record.source === 'live' ? 'camera_ai' : 'photo',
    });
    if (updated) setRecoveryCase({ ...updated });
  };

  const filteredArticles = useMemo(() => {
    return KNOWLEDGE_ARTICLES.filter((art) => {
      const matchCat = selectedCategory === 'all' || art.category === selectedCategory;
      const matchSearch =
        art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        art.summary.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [searchQuery, selectedCategory]);

  if (!mounted || !recoveryCase) {
    return (
      <div className="min-h-screen bg-[#F2F7F9] text-slate-800 flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
          <Activity className="w-5 h-5 animate-spin" />
          Đang tải AXVYRA...
        </div>
      </div>
    );
  }

  const todaySession = recoveryCase.dailySessions[0] || null;
  const latestROM = recoveryCase.romHistory[0] || null;

  return (
    <div className="min-h-screen bg-[#F2F7F9] text-slate-800 flex flex-col justify-between font-sans relative select-none">
      {/* Dynamic Island & Phone Top Bar */}
      <div className="pt-3 px-6 flex items-center justify-between text-xs font-semibold text-slate-800 z-30 select-none">
        <span className="font-bold text-sm">9:41</span>
        <div className="w-24 h-5 bg-black rounded-full mx-auto" />
        <div className="flex items-center gap-1 text-slate-700">
          <span className="text-[10px] font-bold">5G</span>
          <div className="w-4 h-2.5 border border-slate-700 rounded-xs p-0.5 flex items-center">
            <div className="w-full h-full bg-slate-700 rounded-2xs" />
          </div>
        </div>
      </div>

      {/* Main App Bar (Logo & Notification) */}
      <div className="px-5 pt-3 pb-1 flex items-center justify-between z-20">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowOnboarding(true)}>
          {/* Stylized Green Brand Triangle Logo */}
          <div className="w-5 h-5 relative flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
              <path
                d="M12 3L22 20H2L12 3Z"
                fill="#84CC16"
                stroke="#10B981"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M12 8L18 19H6L12 8Z"
                fill="#10B981"
              />
            </svg>
          </div>
          <span className="font-black text-lg tracking-wider text-slate-900">
            AXVYRA
          </span>
        </div>

        <button
          onClick={() => setShowOnboarding(true)}
          className="relative w-9 h-9 rounded-full bg-white shadow-xs border border-slate-200/80 flex items-center justify-center text-slate-700 hover:text-slate-900 transition"
          aria-label="Thông báo & Hồ sơ"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
        </button>
      </div>

      {/* Main Scrollable View */}
      <main className="flex-1 px-4 pt-2 pb-28 space-y-3.5 overflow-y-auto relative z-10">
        {/* ========================================================================= */}
        {/* TAB 1: HOME (MATCHING THE UPLOADED DESIGN IMAGE)                          */}
        {/* ========================================================================= */}
        {activeTab === 'home' && (
          <div className="space-y-3.5 animate-fade-in">
            {/* Patient Header Greeting & Glowing 3D Knee Hero Banner */}
            <div className="relative pt-1 pb-1">
              {/* Background 3D Knee Asset placed on the right */}
              <div className="absolute right-[-14px] top-[-10px] w-48 h-48 opacity-90 pointer-events-none select-none z-0">
                <Image
                  src="/images/knee-hero.png"
                  alt="AXVYRA Knee"
                  fill
                  className="object-contain"
                  priority
                />
              </div>

              {/* Greeting Line */}
              <div className="relative z-10 flex items-center gap-2.5 mb-2">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0 bg-emerald-100 flex items-center justify-center">
                  <Image
                    src="/images/knee-hero.png"
                    alt="Minh Avatar"
                    width={40}
                    height={40}
                    className="object-cover scale-150"
                  />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 leading-tight">
                    Chào {recoveryCase.patientName || 'Minh'}!
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Ngày {rehabStatus.currentDay} sau phẫu thuật {SURGERY_DETAILS[recoveryCase.surgeryType].shortLabel}
                  </p>
                </div>
              </div>

              {/* Main Headline styled like the image: "Your Comeback Starts Here." */}
              <div className="relative z-10 max-w-[270px]">
                <h1 className="text-[25px] font-black text-slate-900 leading-[1.15] tracking-tight">
                  Your <span className="text-[#208B9F] italic font-serif font-black">Comeback</span>
                  <br />
                  Starts Here.
                </h1>
                <p className="text-[11.5px] text-slate-500 font-medium mt-1 leading-snug">
                  Mỗi ngày một bước tiến, gần hơn với phong độ của bạn.
                </p>
              </div>
            </div>

            {/* Critical Safety Alert Banner if Meniscus Repair */}
            {rehabStatus.isMeniscusRepairStrictLimit && (
              <div className="p-3.5 rounded-3xl bg-rose-50 border border-rose-200 text-xs text-rose-900 shadow-xs flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-rose-950 font-bold">CẢNH BÁO BẢO VỆ SỤN CHÊM:</strong> 6 tuần đầu tuyệt đối KHÔNG gập gối quá 90° và KHÔNG tì chân mổ ({recoveryCase.weightBearingStatus}).
                </div>
              </div>
            )}

            {/* CARD 1: HÀNH TRÌNH PHỤC HỒI (EXACT REPLICA OF DESIGN) */}
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100/90 space-y-3">
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Layers className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="font-bold text-[13px] text-slate-900">
                    Hành trình phục hồi
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('progress')}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                >
                  <span>Tuần {rehabStatus.currentWeek} / 16</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Progress Content: Circular % & 5-Step Roadmap */}
              <div className="flex items-center gap-3 pt-1">
                {/* Left Radial Gauge */}
                <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90 transform">
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      className="text-slate-100"
                      strokeWidth="6"
                      stroke="currentColor"
                      fill="transparent"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      className="text-emerald-500"
                      strokeWidth="6"
                      strokeDasharray={2 * Math.PI * 32}
                      strokeDashoffset={2 * Math.PI * 32 * (1 - 0.62)}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-base font-black text-slate-900">62%</span>
                    <span className="text-[7.5px] font-bold text-slate-400 uppercase leading-none mt-0.5">
                      Kế hoạch
                    </span>
                  </div>
                </div>

                {/* Right Horizontal Roadmap (5 steps) */}
                <div className="flex-1 relative pb-1">
                  {/* Connecting Line */}
                  <div className="absolute top-2.5 left-2 right-2 h-0.5 bg-slate-200 z-0" />
                  <div
                    className="absolute top-2.5 left-2 h-0.5 bg-emerald-500 z-0 transition-all duration-500"
                    style={{ width: '50%' }}
                  />

                  <div className="relative z-10 grid grid-cols-5 text-center gap-1">
                    {/* Node 1: Hậu phẫu */}
                    <div className="flex flex-col items-center">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <span className="text-[9px] font-semibold text-slate-600 mt-1 leading-tight">
                        Hậu phẫu
                      </span>
                    </div>

                    {/* Node 2: Vận động sớm */}
                    <div className="flex flex-col items-center">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <span className="text-[9px] font-semibold text-slate-600 mt-1 leading-tight">
                        Vận động sớm
                      </span>
                    </div>

                    {/* Node 3: Tăng cường (Active) */}
                    <div className="flex flex-col items-center">
                      <div className="w-5 h-5 rounded-full bg-white border-2 border-emerald-500 flex items-center justify-center shadow-xs">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      </div>
                      <span className="text-[9px] font-bold text-slate-900 mt-1 leading-tight">
                        Tăng cường
                      </span>
                    </div>

                    {/* Node 4: Chạy & Nhảy */}
                    <div className="flex flex-col items-center">
                      <div className="w-5 h-5 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center" />
                      <span className="text-[9px] font-medium text-slate-400 mt-1 leading-tight">
                        Chạy & Nhảy
                      </span>
                    </div>

                    {/* Node 5: Trở lại thể thao */}
                    <div className="flex flex-col items-center">
                      <div className="w-5 h-5 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center" />
                      <span className="text-[9px] font-medium text-slate-400 mt-1 leading-tight">
                        Trở lại thể thao
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: BÀI TẬP HÔM NAY (EXACT REPLICA OF DESIGN) */}
            {todaySession && (
              <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100/90 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                      <Dumbbell className="w-4 h-4 text-teal-600" />
                    </div>
                    <span className="font-bold text-[13px] text-slate-900">
                      Bài tập hôm nay
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('plan')}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                  >
                    <span>Ước tính {todaySession.estimatedMinutes} phút • {todaySession.exercises.length} bài tập</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Content: Thumbnail, Title, Start Button */}
                <div className="flex items-center gap-3 bg-slate-50/60 p-2.5 rounded-2xl border border-slate-100">
                  {/* Exercise Video Thumbnail */}
                  <div
                    onClick={() => handleStartTodaySession(todaySession)}
                    className="relative w-24 h-16 rounded-xl overflow-hidden bg-slate-800 shrink-0 cursor-pointer group shadow-xs"
                  >
                    <Image
                      src="/images/knee-hero.png"
                      alt="Exercise Thumbnail"
                      fill
                      className="object-cover opacity-80 group-hover:scale-105 transition"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-md">
                        <Play className="w-3 h-3 fill-current ml-0.5 text-slate-800" />
                      </div>
                    </div>
                  </div>

                  {/* Title & Desc */}
                  <div className="flex-1 min-w-0 pr-1">
                    <h3 className="text-xs font-bold text-slate-900 truncate">
                      Buổi tập ngày {rehabStatus.currentDay}
                    </h3>
                    <p className="text-[10.5px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                      Tăng sức mạnh gối và kiểm soát vận động
                    </p>
                  </div>

                  {/* Start Button */}
                  <button
                    onClick={() => handleStartTodaySession(todaySession)}
                    className="py-2 px-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white font-bold text-xs shadow-sm shadow-emerald-500/20 flex items-center gap-1 shrink-0 transition"
                  >
                    <span>Bắt đầu</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* CARD 3: TIẾN BỘ GẦN ĐÂY (EXACT REPLICA WITH 3 SPARKLINE CARDS) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-[13px] text-slate-900">
                    Tiến bộ gần đây
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('progress')}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                >
                  <span>Xem chi tiết</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 3 Metric Cards Grid */}
              <div className="grid grid-cols-3 gap-2">
                {/* Metric 1: ROM Gối */}
                <div className="bg-white rounded-3xl p-3 border border-slate-100/90 shadow-sm flex flex-col justify-between overflow-hidden relative">
                  <div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                      <Compass className="w-3.5 h-3.5 text-emerald-600" />
                      <span>ROM gối</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-base font-black text-slate-900">
                        {latestROM ? `${latestROM.flexionAngle}°` : '128°'}
                      </span>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded-md">
                        ↑ +8°
                      </span>
                    </div>
                  </div>

                  {/* Green Sparkline Curve */}
                  <div className="w-full h-7 mt-2">
                    <svg viewBox="0 0 100 30" className="w-full h-full">
                      <defs>
                        <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0 25 Q25 22 50 15 T100 5 L100 30 L0 30 Z"
                        fill="url(#greenGradient)"
                      />
                      <path
                        d="M0 25 Q25 22 50 15 T100 5"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </div>

                {/* Metric 2: Sức mạnh */}
                <div className="bg-white rounded-3xl p-3 border border-slate-100/90 shadow-sm flex flex-col justify-between overflow-hidden relative">
                  <div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                      <Zap className="w-3.5 h-3.5 text-sky-600" />
                      <span>Sức mạnh</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-base font-black text-slate-900">76%</span>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded-md">
                        ↑ +12%
                      </span>
                    </div>
                  </div>

                  {/* Blue Sparkline Curve */}
                  <div className="w-full h-7 mt-2">
                    <svg viewBox="0 0 100 30" className="w-full h-full">
                      <defs>
                        <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0 26 Q30 20 60 18 T100 8 L100 30 L0 30 Z"
                        fill="url(#blueGradient)"
                      />
                      <path
                        d="M0 26 Q30 20 60 18 T100 8"
                        fill="none"
                        stroke="#0ea5e9"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </div>

                {/* Metric 3: Khả năng vận động */}
                <div className="bg-white rounded-3xl p-3 border border-slate-100/90 shadow-sm flex flex-col justify-between overflow-hidden relative">
                  <div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600 truncate">
                      <Activity className="w-3.5 h-3.5 text-purple-600" />
                      <span>Khả năng</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-base font-black text-slate-900">7.8</span>
                      <span className="text-[8.5px] text-slate-400">/10</span>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded-md">
                        ↑ +1.6
                      </span>
                    </div>
                  </div>

                  {/* Purple Sparkline Curve */}
                  <div className="w-full h-7 mt-2">
                    <svg viewBox="0 0 100 30" className="w-full h-full">
                      <defs>
                        <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0 28 Q35 22 65 14 T100 6 L100 30 L0 30 Z"
                        fill="url(#purpleGradient)"
                      />
                      <path
                        d="M0 28 Q35 22 65 14 T100 6"
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick 15-Minute Ice Timer */}
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Chườm đá lạnh (15 Phút)</h3>
                  <p className="text-[10px] text-slate-500">Giảm sưng đau, chống phản ứng viêm</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-base font-black tabular-nums text-sky-600 font-mono">
                  {formatTimer(iceSeconds)}
                </span>
                <button
                  onClick={() => setIsIceRunning(!isIceRunning)}
                  className={`py-1.5 px-3 rounded-full text-xs font-bold transition ${
                    isIceRunning ? 'bg-amber-500 text-white' : 'bg-sky-600 text-white'
                  }`}
                >
                  {isIceRunning ? 'Dừng' : 'Bắt đầu'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PLAN (KẾ HOẠCH BÀI TẬP)                                           */}
        {/* ========================================================================= */}
        {activeTab === 'plan' && (
          <div className="space-y-3.5 animate-fade-in">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Kế hoạch phục hồi • Phase {rehabStatus.phase.phaseNumber}
              </span>
              <h1 className="text-xl font-black text-slate-900 mt-0.5">
                Lịch Tập Theo Tuần
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Chỉ thực hiện các bài tập được phân quyền bởi bác sĩ và phác đồ.
              </p>
            </div>

            {/* Day Selector Strip */}
            <div className="bg-white rounded-3xl p-2.5 border border-slate-100 shadow-sm flex items-center justify-between text-center">
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <div
                  key={d}
                  className={`p-2 rounded-2xl flex flex-col items-center flex-1 cursor-pointer transition ${
                    d === 1
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-[8.5px] uppercase tracking-wider">T.{d + 1}</span>
                  <span className="text-xs font-black mt-0.5">{d}</span>
                </div>
              ))}
            </div>

            {/* Session Detail */}
            {todaySession && (
              <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xs font-bold text-emerald-700 uppercase">
                      Buổi tập hôm nay
                    </h2>
                    <h3 className="text-sm font-black text-slate-900 mt-0.5">
                      {todaySession.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => handleStartTodaySession(todaySession)}
                    className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full text-xs flex items-center gap-1 shadow-sm transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Tập ngay</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {todaySession.exercises.map((item, idx) => (
                    <div key={item.exerciseId} className="py-3 first:pt-1 last:pb-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold flex items-center justify-center border border-emerald-200">
                            {idx + 1}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900">
                            {item.vietnameseName}
                          </h4>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {item.targetSets} hiệp × {item.targetReps} lần
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 pl-7 leading-relaxed">
                        {item.instructions[0]}
                      </p>
                      {item.safetyNote && (
                        <div className="mt-1 pl-7 text-[10px] text-rose-600 font-semibold">
                          ⚠️ {item.safetyNote}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PROGRESS (TIẾN ĐỘ & CAMERA AI)                                     */}
        {/* ========================================================================= */}
        {activeTab === 'progress' && (
          <div className="space-y-3.5 animate-fade-in">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Theo dõi phục hồi • Camera AI
              </span>
              <h1 className="text-xl font-black text-slate-900 mt-0.5">
                Tiến Độ & Biên Độ Góc Gối
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhận diện góc gập duỗi qua MediaPipe PoseLandmarker chuẩn xác.
              </p>
            </div>

            {/* AI Knee Camera Module */}
            <div className="bg-slate-900 rounded-3xl p-3 shadow-md border border-slate-800">
              <KneeAngleCamera
                safeMaxFlexion={recoveryCase.maxSafeFlexion}
                selectedLeg={recoveryCase.surgeryLeg}
                onRecordSaved={handleROMRecorded}
              />
            </div>

            {/* Milestone Timeline */}
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 space-y-2.5">
              <h2 className="text-xs font-black text-slate-900 uppercase">
                Cột Mốc Phục Hồi Lâm Sàng
              </h2>
              <div className="space-y-2">
                {recoveryCase.milestones.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{m.title}</div>
                      <div className="text-[10.5px] text-slate-500 mt-0.5">{m.targetCriteria}</div>
                    </div>
                    <span
                      className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                        m.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : m.status === 'IN_PROGRESS'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {m.status === 'CONFIRMED'
                        ? 'Đã duyệt'
                        : m.status === 'IN_PROGRESS'
                        ? 'Đang tập'
                        : 'Chờ'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: EXPLORE (KHÁM PHÁ & KIẾN THỨC)                                     */}
        {/* ========================================================================= */}
        {activeTab === 'explore' && (
          <div className="space-y-3.5 animate-fade-in">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Thư viện kiến thức • Y khoa
              </span>
              <h1 className="text-xl font-black text-slate-900 mt-0.5">
                Cẩm Nang Phục Hồi Khớp Gối
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Kiến thức chính xác từ chuyên gia phục hồi chức năng và chấn thương chỉnh hình.
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm bài viết, câu hỏi, lưu ý..."
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl p-3 pl-10 text-xs font-medium text-slate-900 placeholder-slate-400 outline-none shadow-xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'safety', label: 'An toàn & R.I.C.E' },
                { id: 'protocol', label: 'Phác đồ ACL' },
                { id: 'nutrition', label: 'Dinh dưỡng' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`py-1.5 px-3 rounded-full font-bold whitespace-nowrap transition ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Selected Article Detail */}
            {selectedArticle ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3">
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="text-xs text-emerald-700 font-bold flex items-center gap-1 hover:underline mb-1"
                >
                  &larr; Quay lại danh sách
                </button>
                <h2 className="text-base font-black text-slate-900">
                  {selectedArticle.title}
                </h2>
                <div className="text-[11px] text-slate-400">
                  {selectedArticle.readTime}
                </div>

                {selectedArticle.importantNotice && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-bold">
                    ⚠️ {selectedArticle.importantNotice}
                  </div>
                )}

                <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
                  {selectedArticle.content.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredArticles.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => setSelectedArticle(art)}
                    className="p-4 bg-white hover:bg-slate-50/80 border border-slate-100 rounded-3xl cursor-pointer transition shadow-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {art.category === 'safety' ? 'An toàn' : 'Phác đồ'}
                      </span>
                      <span className="text-[10px] text-slate-400">{art.readTime}</span>
                    </div>
                    <h3 className="text-xs font-black text-slate-900">
                      {art.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {art.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Full-Screen Workout Player Modal */}
      {activeWorkoutExercises && (
        <WorkoutPlayer
          exercises={activeWorkoutExercises}
          onClose={() => setActiveWorkoutExercises(null)}
          onFinishedWorkout={handleWorkoutFinished}
        />
      )}

      {/* Post-Session Feedback Modal */}
      <SessionFeedbackModal
        isOpen={showFeedbackModal}
        sessionTitle={feedbackSessionTitle}
        onSaveFeedback={handleSaveSessionFeedback}
        onClose={() => setShowFeedbackModal(false)}
      />

      {/* Clinical Onboarding Modal */}
      <OnboardingModal
        initialProfile={{
          name: recoveryCase.patientName,
          surgeryDate: recoveryCase.surgeryDate,
          surgeryType: recoveryCase.surgeryType,
          surgeryLeg: recoveryCase.surgeryLeg,
          completedOnboarding: true,
        }}
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
        onClose={() => setShowOnboarding(false)}
      />

      {/* FLOATING BOTTOM DOCK WITH 4 TABS (EXACT REPLICA OF DESIGN) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-2 pt-1 pointer-events-none max-w-[430px] mx-auto bg-gradient-to-t from-white/95 via-white/80 to-transparent">
        <nav className="w-full bg-white/95 backdrop-blur-md border border-slate-100 shadow-lg shadow-slate-200/50 rounded-full py-1.5 px-2 flex items-center justify-between pointer-events-auto">
          {/* Tab 1: Trang chủ (Active State) */}
          <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-1.5 py-2 px-3.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'home'
                ? 'bg-[#E8F8F0] text-[#059669]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Home className="w-4 h-4 fill-current" />
            <span className="text-[11px]">Trang chủ</span>
          </button>

          {/* Tab 2: Kế hoạch */}
          <button
            onClick={() => setActiveTab('plan')}
            className={`flex flex-col items-center justify-center py-1 px-3 text-xs font-bold transition-all ${
              activeTab === 'plan'
                ? 'bg-[#E8F8F0] text-[#059669] rounded-full py-2 px-3.5 flex-row gap-1.5'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Kế hoạch</span>
          </button>

          {/* Tab 3: Tiến độ */}
          <button
            onClick={() => setActiveTab('progress')}
            className={`flex flex-col items-center justify-center py-1 px-3 text-xs font-bold transition-all ${
              activeTab === 'progress'
                ? 'bg-[#E8F8F0] text-[#059669] rounded-full py-2 px-3.5 flex-row gap-1.5'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Tiến độ</span>
          </button>

          {/* Tab 4: Khám phá */}
          <button
            onClick={() => setActiveTab('explore')}
            className={`flex flex-col items-center justify-center py-1 px-3 text-xs font-bold transition-all ${
              activeTab === 'explore'
                ? 'bg-[#E8F8F0] text-[#059669] rounded-full py-2 px-3.5 flex-row gap-1.5'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Khám phá</span>
          </button>
        </nav>

        {/* iPhone Home Indicator Bar */}
        <div className="w-32 h-1 bg-black/80 rounded-full mx-auto mt-2" />
      </div>
    </div>
  );
}
